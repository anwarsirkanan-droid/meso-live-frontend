import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  getGiftCatalog,
  getProfile,
  getRoom,
  leaveRoomSeat,
  sendGift,
  takeRoomSeat,
} from '../api.js';
import { Card } from '../components/UI.jsx';
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
  const [profile, setProfile] = useState(null);
  const [gifts, setGifts] = useState([]);
  const [selectedGiftId, setSelectedGiftId] = useState('');
  const [selectedReceiverId, setSelectedReceiverId] = useState('');
  const [roomActionError, setRoomActionError] = useState('');
  const [giftError, setGiftError] = useState('');
  const [giftFeedback, setGiftFeedback] = useState('');
  const [roomActionBusy, setRoomActionBusy] = useState(false);
  const [giftBusy, setGiftBusy] = useState(false);
  const [giftFeed, setGiftFeed] = useState([]);
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
  const requestRoomJoinRef = useRef(null);
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
    let active = true;
    getProfile()
      .then((data) => {
        if (active) setProfile(data);
      })
      .catch((requestError) => {
        if (active) {
          setRoomActionError(requestError.response?.data?.message || requestError.message || 'Could not load your profile.');
        }
      });
    getGiftCatalog()
      .then((data) => {
        if (!active) return;
        const catalog = Array.isArray(data) ? data : [];
        setGifts(catalog);
        setSelectedGiftId(catalog[0]?._id || '');
      })
      .catch((requestError) => {
        if (active) {
          setGiftError(requestError.response?.data?.error || requestError.message || 'Could not load available gifts.');
        }
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    const onRoomUpdated = (updatedRoom) => {
      if (String(updatedRoom?._id) === String(roomId)) setRoom(updatedRoom);
    };
    const onGiftReceived = (gift) => {
      setGiftFeed((current) => [gift, ...current].slice(0, 5));
    };
    socket.on('room_updated', onRoomUpdated);
    socket.on('gift_received', onGiftReceived);
    return () => {
      socket.off('room_updated', onRoomUpdated);
      socket.off('gift_received', onGiftReceived);
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
      setError('');
      requestRoomJoin();
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
    let joinRequested = false;
    const requestRoomJoin = () => {
      if (joinRequested) return;
      joinRequested = true;
      setStatus('connecting');
      socket.timeout(10000).emit('join-room', roomId, (timeoutError, result) => {
        if (timeoutError) {
          joinRequested = false;
          setStatus('error');
          setError('The server did not confirm joining this room. Please try again.');
          localStreamRef.current?.getTracks().forEach((track) => track.stop());
          localStreamRef.current = null;
          return;
        }
        if (result?.error) {
          joinRequested = false;
          setStatus('error');
          setError(result.error);
          localStreamRef.current?.getTracks().forEach((track) => track.stop());
          localStreamRef.current = null;
          return;
        }
        setStatus('connected');
      });
    };
    requestRoomJoinRef.current = requestRoomJoin;
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
      requestRoomJoinRef.current = null;
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
        requestRoomJoinRef.current?.();
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

  const currentUserId = String(profile?._id || profile?.id || '');
  const ownerId = String(room?.ownerId?._id || room?.ownerId?.id || room?.ownerId || '');
  const host = room?.ownerId && typeof room.ownerId === 'object' ? room.ownerId : null;
  const roomSeats = useMemo(() => Array.from({ length: 25 }, (_, seatIndex) =>
    room?.seats?.find((seat) => seat.seatIndex === seatIndex) || { seatIndex, userId: null },
  ), [room]);
  const hasDesignatedCrownSeat = roomSeats.some((seat) => seat.isCrownMic);
  const ownSeat = roomSeats.find((seat) => {
    const seatedUserId = String(seat.userId?._id || seat.userId?.id || seat.userId || '');
    return currentUserId && seatedUserId === currentUserId;
  });
  const giftRecipients = useMemo(() => [
    ...(ownerId && ownerId !== currentUserId
      ? [{ id: ownerId, name: host?.username || 'Room host' }]
      : []),
    ...roomSeats.flatMap((seat) => {
      const user = seat.userId && typeof seat.userId === 'object' ? seat.userId : null;
      const id = String(user?._id || user?.id || seat.userId || '');
      if (!id || id === currentUserId || id === ownerId) return [];
      return [{ id, name: user?.username || `Mic ${seat.seatIndex + 1}` }];
    }),
  ], [currentUserId, host?.username, ownerId, roomSeats]);

  useEffect(() => {
    if (giftRecipients.length && !giftRecipients.some(({ id }) => id === selectedReceiverId)) {
      setSelectedReceiverId(giftRecipients[0].id);
    }
  }, [giftRecipients, selectedReceiverId]);

  const changeSeat = async (seat) => {
    setRoomActionBusy(true);
    setRoomActionError('');
    try {
      const isOwnSeat = String(seat.userId?._id || seat.userId?.id || seat.userId || '') === currentUserId;
      if (isOwnSeat) {
        await leaveRoomSeat(roomId, seat.seatIndex);
      } else {
        if (!['connecting', 'connected', 'reconnecting'].includes(status)) {
          void joinRoom();
        }
        await takeRoomSeat(roomId, seat.seatIndex);
      }
      setRoom(await getRoom(roomId));
    } catch (requestError) {
      setRoomActionError(requestError.response?.data?.message || requestError.response?.data?.error || requestError.message);
    } finally {
      setRoomActionBusy(false);
    }
  };

  const giftSelectedUser = async () => {
    setGiftBusy(true);
    setGiftError('');
    setGiftFeedback('');
    try {
      const result = await sendGift({
        roomId,
        receiverId: selectedReceiverId,
        giftId: selectedGiftId,
      });
      setProfile((current) => current ? { ...current, coins: result.senderBalance } : current);
      setGiftFeedback(result.message || 'Gift sent successfully.');
    } catch (requestError) {
      setGiftError(requestError.response?.data?.error || requestError.response?.data?.message || requestError.message);
    } finally {
      setGiftBusy(false);
    }
  };

  const hostName = host?.username;
  const joined = status === 'connected' || status === 'reconnecting';
  const connectedPeerCount = remotePeers.filter((peer) => peer.connected).length;
  const statusLabel = {
    idle: 'Ready to join',
    'requesting-microphone': 'Requesting microphone',
    connecting: 'Connecting to room',
    connected: connectedPeerCount ? 'Audio connected' : 'Connected · waiting for others',
    reconnecting: 'Reconnecting',
    error: 'Signaling error',
  }[status];

  return (
    <main className="live-room-page">
      <header className="live-room-header">
        <div className="live-room-heading">
          <p className="eyebrow">{room?.category ? room.category.toUpperCase() : `ROOM ${roomId}`}</p>
          <h1>{room?.title || 'Live room'}</h1>
          <p className="muted live-room-host">
            {room?.isLive && <span className="live-pill"><i /> LIVE NOW</span>}
            {hostName ? `Hosted by ${hostName}` : 'Join the conversation'}
            <span className={`live-room-connection is-${status}`} role="status">{statusLabel}</span>
          </p>
        </div>
        <div className="room-controls live-room-header-controls">
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
                {status === 'requesting-microphone'
                  ? 'Allow microphone…'
                  : status === 'connecting'
                    ? 'Connecting…'
                    : 'Join voice room'}
              </button>
              <button className="button button-quiet" type="button" onClick={() => navigate('/')}>
                Back
              </button>
            </>
          )}
          {joined && (
            <div className="room-mic-meter" aria-label={`Microphone level ${micLevel}%`}>
              <span style={{ width: `${micLevel}%` }} />
            </div>
          )}
        </div>
      </header>
      {loading && (
        <div className="rooms-loading" role="status" aria-label="Loading room">
          <span className="loading-spinner" />
          <span className="muted">Loading room…</span>
        </div>
      )}

      {!loading && error && <div className="notice-error" role="alert">{error}</div>}
      {!loading && warning && <div className="room-warning" role="status">{warning}</div>}
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

      {!loading && room && (
        <>
          <div className="live-room-layout">
            <section className="card room-seats-panel" aria-labelledby="room-seats-title">
              <div className="section-heading">
                <div>
                  <p className="eyebrow">TAKE THE FLOOR</p>
                  <h2 id="room-seats-title">Mic seats</h2>
                </div>
                <span className="count-badge">{roomSeats.filter((seat) => seat.userId).length} / 25</span>
              </div>
              <p className="muted room-panel-hint">Tap an open seat to join the conversation. Tap your seat to leave it.</p>
              {roomActionError && <p className="form-error" role="alert">{roomActionError}</p>}
              <div className="mic-seat-grid">
                {roomSeats.map((seat) => {
                  const user = seat.userId && typeof seat.userId === 'object' ? seat.userId : null;
                  const seatUserId = String(user?._id || user?.id || seat.userId || '');
                  const occupied = Boolean(seatUserId);
                  const isMine = occupied && seatUserId === currentUserId;
                  const crown = seat.isCrownMic === true || (!hasDesignatedCrownSeat && seat.seatIndex === 0);
                  const disabled = roomActionBusy || (occupied && !isMine) || (seat.isLocked && !isMine);
                  const seatLabel = user?.username || (isMine ? 'You' : 'Occupied');
                  return (
                    <button
                      className={`mic-seat${occupied ? ' is-occupied' : ''}${isMine ? ' is-mine' : ''}${crown ? ' is-crown' : ''}${seat.isLocked ? ' is-locked' : ''}`}
                      key={seat.seatIndex}
                      type="button"
                      onClick={() => changeSeat(seat)}
                      disabled={disabled || !currentUserId}
                      aria-label={`${crown ? 'Crown mic, ' : ''}Mic ${seat.seatIndex + 1}, ${occupied ? seatLabel : seat.isLocked ? 'locked' : 'available'}`}
                      title={crown ? 'Crown Mic' : `Mic ${seat.seatIndex + 1}`}
                    >
                      <span className="mic-seat-icon" aria-hidden="true">{crown ? '👑' : occupied ? '🎙️' : '+'}</span>
                      <span className="mic-seat-name">{occupied ? seatLabel : `Mic ${seat.seatIndex + 1}`}</span>
                      {seat.isLocked && <span className="mic-seat-lock" aria-label="Locked">🔒</span>}
                    </button>
                  );
                })}
              </div>
              {ownSeat && (
                <p className="muted room-panel-hint">You are on {ownSeat.isCrownMic ? 'the Crown Mic' : `Mic ${ownSeat.seatIndex + 1}`}.</p>
              )}
            </section>

            <aside className="card room-gifts-panel" aria-labelledby="room-gifts-title">
              <div className="section-heading">
                <div>
                  <p className="eyebrow">SHOW SOME LOVE</p>
                  <h2 id="room-gifts-title">Send a gift</h2>
                </div>
                <span className="count-badge">{(Number(profile?.coins) || 0).toLocaleString()} coins</span>
              </div>
              {giftError && <p className="form-error" role="alert">{giftError}</p>}
              {giftFeedback && <p className="success-message" role="status">{giftFeedback}</p>}
              {giftRecipients.length > 0 ? (
                <label className="field room-gift-recipient">
                  <span>Send to</span>
                  <select value={selectedReceiverId} onChange={(event) => setSelectedReceiverId(event.target.value)}>
                    {giftRecipients.map((recipient) => (
                      <option key={recipient.id} value={recipient.id}>{recipient.name}</option>
                    ))}
                  </select>
                </label>
              ) : (
                <p className="muted room-panel-hint">There is no other participant to receive a gift yet.</p>
              )}
              {gifts.length > 0 ? (
                <div className="room-gift-grid">
                  {gifts.map((gift) => (
                    <button
                      className={`room-gift-option${selectedGiftId === gift._id ? ' is-selected' : ''}`}
                      key={gift._id}
                      type="button"
                      onClick={() => setSelectedGiftId(gift._id)}
                      aria-pressed={selectedGiftId === gift._id}
                    >
                      <span aria-hidden="true">{gift.icon}</span>
                      <strong>{gift.name}</strong>
                      <small>{gift.coinPrice.toLocaleString()} coins</small>
                    </button>
                  ))}
                </div>
              ) : (
                !giftError && <p className="muted room-panel-hint">No gifts are available right now.</p>
              )}
              <button
                className="button button-primary button-full room-send-gift"
                type="button"
                onClick={giftSelectedUser}
                disabled={giftBusy || !selectedGiftId || !selectedReceiverId}
              >
                {giftBusy ? 'Sending gift…' : 'Send selected gift'}
              </button>
              {giftFeed.length > 0 && (
                <div className="room-gift-feed" aria-live="polite">
                  <h3>Recent gifts</h3>
                  {giftFeed.map((gift, index) => (
                    <p key={`${gift.timestamp || ''}-${index}`}>
                      {gift.giftIcon} {gift.senderName} sent {gift.giftName} to {gift.receiverName}
                    </p>
                  ))}
                </div>
              )}
            </aside>
          </div>
        </>
      )}
    </main>
  );
}
