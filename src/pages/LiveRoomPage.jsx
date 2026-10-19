import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { getRoom } from '../api.js';
import { Card, Page } from '../components/UI.jsx';
import socket from '../socket.js';

const turnUrls = (import.meta.env.VITE_TURN_URLS || '')
  .split(',')
  .map((url) => url.trim())
  .filter(Boolean);

const ICE_SERVERS = [
  { urls: 'stun:stun.l.google.com:19302' },
  ...(turnUrls.length
    ? [{
        urls: turnUrls,
        ...(import.meta.env.VITE_TURN_USERNAME ? { username: import.meta.env.VITE_TURN_USERNAME } : {}),
        ...(import.meta.env.VITE_TURN_CREDENTIAL ? { credential: import.meta.env.VITE_TURN_CREDENTIAL } : {}),
      }]
    : []),
];

const getPeerId = (payload) => {
  if (typeof payload === 'string') return payload;
  return payload?.socketId || payload?.peerId || payload?.from || payload?.sender || payload?.userId || payload?.id;
};

const getSignal = (payload, key) =>
  payload?.[key] || payload?.description?.[key] || payload?.signal?.[key] ||
  (key === 'offer' || key === 'answer' ? payload?.description : undefined);

function RemoteAudio({ stream, onPlaybackBlocked }) {
  const audioRef = useRef(null);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return undefined;
    audio.srcObject = stream;
    audio.play().catch(() => onPlaybackBlocked());
    return () => {
      audio.srcObject = null;
    };
  }, [stream, onPlaybackBlocked]);

  return <audio className="remote-room-audio" ref={audioRef} autoPlay playsInline />;
}

export default function LiveRoomPage() {
  const { roomId } = useParams();
  const navigate = useNavigate();
  const [room, setRoom] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [warning, setWarning] = useState('');
  const [status, setStatus] = useState('idle');
  const [micEnabled, setMicEnabled] = useState(true);
  const [micLevel, setMicLevel] = useState(0);
  const [remotePeers, setRemotePeers] = useState([]);
  const [playbackBlocked, setPlaybackBlocked] = useState(false);
  const localStreamRef = useRef(null);
  const audioContextRef = useRef(null);
  const animationFrameRef = useRef(null);
  const disconnectingRef = useRef(false);
  const roomActiveRef = useRef(true);
  const handlePlaybackBlocked = useCallback(() => setPlaybackBlocked(true), []);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    getRoom(roomId)
      .then((data) => {
        if (active) setRoom(data);
      })
      .catch((requestError) => {
        if (active) {
          setError(requestError.response?.data?.message || 'Could not load this room. Please try again.');
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [roomId]);

  useEffect(() => {
    roomActiveRef.current = true;
    const peers = new Map();
    const pendingCandidates = new Map();

    const setPeerStream = (peerId, stream) => {
      const connected = peers.get(peerId)?.connectionState === 'connected';
      setRemotePeers((current) => {
        const existing = current.find((peer) => peer.id === peerId);
        if (existing) {
          return current.map((peer) => peer.id === peerId ? { ...peer, stream, connected } : peer);
        }
        return [...current, { id: peerId, stream, connected }];
      });
    };

    const updatePeerState = (peerId, connected) => {
      setRemotePeers((current) =>
        current.map((peer) => peer.id === peerId ? { ...peer, connected } : peer),
      );
    };

    const removePeer = (peerId) => {
      const connection = peers.get(peerId);
      if (connection) {
        connection.onicecandidate = null;
        connection.ontrack = null;
        connection.onconnectionstatechange = null;
        connection.close();
        peers.delete(peerId);
      }
      pendingCandidates.delete(peerId);
      setRemotePeers((current) => current.filter((peer) => peer.id !== peerId));
    };

    const sendSignal = (event, peerId, field, value) => {
      socket.emit(event, {
        roomId,
        target: peerId,
        to: peerId,
        from: socket.id,
        [field]: value,
      });
    };

    const createPeer = (peerId) => {
      const existing = peers.get(peerId);
      if (existing) return existing;

      const connection = new RTCPeerConnection({ iceServers: ICE_SERVERS });
      const stream = localStreamRef.current;
      if (stream) {
        stream.getAudioTracks().forEach((track) => connection.addTrack(track, stream));
      }

      connection.onicecandidate = (event) => {
        if (event.candidate && socket.connected) {
          sendSignal('ice-candidate', peerId, 'candidate', event.candidate);
        }
      };
      connection.ontrack = (event) => {
        const remoteStream = event.streams[0] || new MediaStream([event.track]);
        setPeerStream(peerId, remoteStream);
      };
      connection.onconnectionstatechange = () => {
        updatePeerState(peerId, connection.connectionState === 'connected');
        if (connection.connectionState === 'failed') {
          setError('Could not connect to a room participant. Check the network or configure a TURN server.');
        } else if (connection.connectionState === 'connected') {
          setError('');
        } else if (connection.connectionState === 'closed') {
          removePeer(peerId);
        }
      };
      peers.set(peerId, connection);
      return connection;
    };

    const applyPendingCandidates = async (peerId, connection) => {
      const candidates = pendingCandidates.get(peerId) || [];
      pendingCandidates.delete(peerId);
      for (const candidate of candidates) {
        await connection.addIceCandidate(new RTCIceCandidate(candidate));
      }
    };

    const onUserJoined = async (payload) => {
      const peerId = getPeerId(payload);
      if (!peerId || peerId === socket.id || peers.has(peerId) || !localStreamRef.current) return;
      try {
        const connection = createPeer(peerId);
        const offer = await connection.createOffer();
        await connection.setLocalDescription(offer);
        sendSignal('offer', peerId, 'offer', connection.localDescription);
      } catch (signalError) {
        setError(`Could not start an audio connection: ${signalError.message}`);
        removePeer(peerId);
      }
    };

    const onOffer = async (payload) => {
      const peerId = getPeerId(payload);
      const offer = getSignal(payload, 'offer');
      if (!peerId || peerId === socket.id || !offer || !localStreamRef.current) return;
      try {
        const connection = createPeer(peerId);
        await connection.setRemoteDescription(new RTCSessionDescription(offer));
        await applyPendingCandidates(peerId, connection);
        const answer = await connection.createAnswer();
        await connection.setLocalDescription(answer);
        sendSignal('answer', peerId, 'answer', connection.localDescription);
      } catch (signalError) {
        setError(`Could not answer an audio connection: ${signalError.message}`);
        removePeer(peerId);
      }
    };

    const onAnswer = async (payload) => {
      const peerId = getPeerId(payload);
      const answer = getSignal(payload, 'answer');
      const connection = peers.get(peerId);
      if (!peerId || !answer || !connection) return;
      try {
        await connection.setRemoteDescription(new RTCSessionDescription(answer));
        await applyPendingCandidates(peerId, connection);
      } catch (signalError) {
        setError(`Could not complete an audio connection: ${signalError.message}`);
        removePeer(peerId);
      }
    };

    const onIceCandidate = async (payload) => {
      const peerId = getPeerId(payload);
      const candidate = payload?.candidate || payload?.iceCandidate || payload?.signal?.candidate;
      if (!peerId || peerId === socket.id || !candidate) return;
      const connection = peers.get(peerId);
      if (!connection || !connection.remoteDescription) {
        pendingCandidates.set(peerId, [...(pendingCandidates.get(peerId) || []), candidate]);
        return;
      }
      try {
        await connection.addIceCandidate(new RTCIceCandidate(candidate));
      } catch (signalError) {
        setError(`Could not add a network candidate: ${signalError.message}`);
      }
    };

    const onConnect = () => {
      setStatus('connected');
      setError('');
      socket.emit('join-room', roomId);
    };
    const onDisconnect = () => {
      if (!disconnectingRef.current) setStatus('reconnecting');
      peers.forEach((connection) => connection.close());
      peers.clear();
      pendingCandidates.clear();
      setRemotePeers([]);
    };
    const onConnectError = (connectError) => {
      setStatus('error');
      setError(`Could not connect to room signaling: ${connectError.message}`);
    };
    const onUserLeft = (payload) => {
      const peerId = getPeerId(payload);
      if (peerId) removePeer(peerId);
    };

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('connect_error', onConnectError);
    socket.on('user-joined', onUserJoined);
    socket.on('offer', onOffer);
    socket.on('answer', onAnswer);
    socket.on('ice-candidate', onIceCandidate);
    socket.on('user-left', onUserLeft);
    socket.on('peer-left', onUserLeft);

    return () => {
      roomActiveRef.current = false;
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('connect_error', onConnectError);
      socket.off('user-joined', onUserJoined);
      socket.off('offer', onOffer);
      socket.off('answer', onAnswer);
      socket.off('ice-candidate', onIceCandidate);
      socket.off('user-left', onUserLeft);
      socket.off('peer-left', onUserLeft);
      if (socket.connected) socket.emit('leave-room', roomId);
      disconnectingRef.current = true;
      socket.disconnect();
      peers.forEach((connection) => connection.close());
      peers.clear();
      localStreamRef.current?.getTracks().forEach((track) => track.stop());
      localStreamRef.current = null;
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
      audioContextRef.current?.close();
      audioContextRef.current = null;
    };
  }, [roomId]);

  const startMicrophoneMeter = async (stream) => {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return;
    const audioContext = new AudioContextClass();
    audioContextRef.current = audioContext;
    await audioContext.resume();
    const analyser = audioContext.createAnalyser();
    analyser.fftSize = 256;
    audioContext.createMediaStreamSource(stream).connect(analyser);
    const samples = new Uint8Array(analyser.frequencyBinCount);
    const measure = () => {
      analyser.getByteTimeDomainData(samples);
      const amplitude = samples.reduce((total, sample) => total + Math.abs(sample - 128), 0) / samples.length;
      setMicLevel(Math.min(100, Math.round(amplitude * 2)));
      animationFrameRef.current = requestAnimationFrame(measure);
    };
    measure();
  };

  const joinRoom = async () => {
    if (status === 'connecting' || status === 'connected' || status === 'reconnecting') return;
    setError('');
    setWarning('');
    if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    audioContextRef.current?.close();
    audioContextRef.current = null;
    setMicLevel(0);
    setStatus('requesting-microphone');
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error('Microphone access requires a secure HTTPS connection and a supported browser.');
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      });
      if (!roomActiveRef.current) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      localStreamRef.current?.getTracks().forEach((track) => track.stop());
      localStreamRef.current = stream;
      setMicEnabled(true);
      try {
        await startMicrophoneMeter(stream);
      } catch (meterError) {
        setWarning(`Microphone audio is available, but its level meter could not start: ${meterError.message}`);
      }
      if (!roomActiveRef.current) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      socket.auth = { token: localStorage.getItem('token') || '' };
      disconnectingRef.current = false;
      setStatus('connecting');
      socket.connect();
      if (socket.connected) {
        setStatus('connected');
        socket.emit('join-room', roomId);
      }
    } catch (joinError) {
      localStreamRef.current?.getTracks().forEach((track) => track.stop());
      localStreamRef.current = null;
      if (!roomActiveRef.current) return;
      setStatus('idle');
      setError(joinError.message || 'Could not start room audio.');
    }
  };

  const leaveRoom = () => {
    disconnectingRef.current = true;
    if (socket.connected) {
      socket.emit('leave-room', roomId);
    }
    socket.disconnect();
    localStreamRef.current?.getTracks().forEach((track) => track.stop());
    localStreamRef.current = null;
    if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    audioContextRef.current?.close();
    audioContextRef.current = null;
    setRemotePeers([]);
    setMicLevel(0);
    setStatus('idle');
    navigate('/');
  };

  const toggleMicrophone = () => {
    const enabled = !micEnabled;
    localStreamRef.current?.getAudioTracks().forEach((track) => {
      track.enabled = enabled;
    });
    setMicEnabled(enabled);
  };

  const enableRemoteAudio = () => {
    document.querySelectorAll('audio.remote-room-audio').forEach((audio) => {
      audio.play()
        .then(() => setPlaybackBlocked(false))
        .catch((playError) => {
          setError(`Could not play incoming room audio: ${playError.message}`);
          setPlaybackBlocked(true);
        });
    });
  };

  const host = room?.ownerId && typeof room.ownerId === 'object' ? room.ownerId : null;
  const hostName = host?.username;
  const joined = status === 'connected' || status === 'reconnecting';
  const connectedPeerCount = remotePeers.filter((peer) => peer.connected).length;
  const statusLabel = {
    idle: 'Not connected',
    'requesting-microphone': 'Requesting microphone',
    connecting: 'Connecting to room',
    connected: connectedPeerCount ? 'Audio connected' : 'Connected · waiting for others',
    reconnecting: 'Reconnecting',
    error: 'Signaling error',
  }[status];

  return (
    <Page
      title={room?.title || 'Live room'}
      eyebrow={room?.category ? room.category.toUpperCase() : `ROOM ${roomId}`}
    >
      {loading && (
        <div className="rooms-loading" role="status" aria-label="Loading room">
          <span className="loading-spinner" />
          <span className="muted">Loading room…</span>
        </div>
      )}

      {!loading && error && <div className="notice-error" role="alert">{error}</div>}
      {!loading && warning && <div className="room-warning" role="status">{warning}</div>}

      {!loading && room && (
        <Card className="live-stage">
          {room.isLive ? (
            <span className="live-pill"><i /> LIVE NOW</span>
          ) : (
            <span className="count-badge">OFFLINE</span>
          )}
          {host?.avatar ? (
            <img className="host-orb host-avatar-image" src={host.avatar} alt="" />
          ) : (
            <div className="host-orb host-avatar-fallback" aria-label={hostName || 'Host'}>
              {hostName ? hostName.slice(0, 1).toUpperCase() : '?'}
            </div>
          )}
          <h2>{hostName || 'Host unavailable'}</h2>
          <p className="muted">{room.title}</p>
          <p className="muted room-audio-status" role="status">
            {statusLabel}{joined ? ` · ${connectedPeerCount} other${connectedPeerCount === 1 ? '' : 's'} connected` : ''}
          </p>
          {joined && (
            <div className="room-mic-meter" aria-label={`Microphone level ${micLevel}%`}>
              <span style={{ width: `${micLevel}%` }} />
            </div>
          )}
          <div className="room-controls">
            {joined ? (
              <>
                <button
                  className="button button-secondary"
                  type="button"
                  onClick={toggleMicrophone}
                  aria-pressed={!micEnabled}
                >
                  {micEnabled ? 'Mute microphone' : 'Unmute microphone'}
                </button>
                <button className="button button-danger" type="button" onClick={leaveRoom}>
                  Leave room
                </button>
              </>
            ) : (
              <>
                <button
                  className="button button-primary"
                  type="button"
                  onClick={joinRoom}
                  disabled={status === 'requesting-microphone' || status === 'connecting'}
                >
                  {status === 'requesting-microphone' ? 'Allow microphone…' : 'Join voice room'}
                </button>
                <button className="button button-quiet" type="button" onClick={() => navigate('/')}>
                  Back
                </button>
              </>
            )}
          </div>
          {playbackBlocked && (
            <button className="button button-secondary room-audio-enable" type="button" onClick={enableRemoteAudio}>
              Enable incoming audio
            </button>
          )}
          <div className="remote-room-audio-list" aria-hidden="true">
            {remotePeers.map((peer) => (
              <RemoteAudio key={peer.id} stream={peer.stream} onPlaybackBlocked={handlePlaybackBlocked} />
            ))}
          </div>
        </Card>
      )}
    </Page>
  );
}
