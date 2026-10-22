import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronDown, Crown, Gamepad2, Gift, Mic, MicOff, Share2, X } from 'lucide-react';
import {
  getGiftCatalog,
  getProfile,
  getRoom,
  leaveRoomSeat,
  sendGift,
  takeRoomSeat,
} from '../api.js';
import { useAuth } from '../../context/AuthContext.jsx';
import FloatingPlayer from '../components/FloatingPlayer.jsx';
import socket from '../socket.js';

const GIFT_CATEGORIES = ['Hot', 'Lucky', 'Luxury', 'Intimacy'];
const GIFT_QUANTITIES = [1, 10, 33, 77, 100, 200, 500];
const GIFT_CATEGORY_NAMES = {
  Hot: ['Lucky Bag', 'Light Stick'],
  Lucky: ['Lollipop', 'Diamond', 'Gold Bar'],
  Luxury: ['Titanic', 'Sky Romance', 'Cyber Catwoman'],
  Intimacy: ['CP Rose', 'CP Bird', 'CP Ring'],
};

const turnUrls = (import.meta.env.VITE_TURN_URLS || '')
  .split(',')
  .map((url) => url.trim())
  .filter(Boolean);

const ICE_SERVERS = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  ...(turnUrls.length
    ? [{
        urls: turnUrls,
        ...(import.meta.env.VITE_TURN_USERNAME ? { username: import.meta.env.VITE_TURN_USERNAME } : {}),
        ...(import.meta.env.VITE_TURN_CREDENTIAL ? { credential: import.meta.env.VITE_TURN_CREDENTIAL } : {}),
      }]
    : []),
  {
    urls: 'turn:openrelay.metered.ca:80',
    username: 'openrelayproject',
    credential: 'openrelayproject',
  },
  {
    urls: 'turn:openrelay.metered.ca:443',
    username: 'openrelayproject',
    credential: 'openrelayproject',
  },
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

export default function LiveRoomPage({
  roomId,
  isMinimized = false,
  onMinimize = () => {},
  onRestore = () => {},
  onClose = () => {},
}) {
  const { user, updateRoom, updateRoomStatus } = useAuth();
  const [room, setRoom] = useState(null);
  const [profile, setProfile] = useState(null);
  const [gifts, setGifts] = useState([]);
  const [selectedGiftId, setSelectedGiftId] = useState('');
  const [selectedReceiverId, setSelectedReceiverId] = useState('all');
  const [roomActionError, setRoomActionError] = useState('');
  const [giftError, setGiftError] = useState('');
  const [giftFeedback, setGiftFeedback] = useState('');
  const [giftCategory, setGiftCategory] = useState('Hot');
  const [giftQuantity, setGiftQuantity] = useState(1);
  const [giftsOpen, setGiftsOpen] = useState(false);
  const [announcement, setAnnouncement] = useState(() => localStorage.getItem(`room:${roomId}:announcement`) || '');
  const [announcementOpen, setAnnouncementOpen] = useState(true);
  const [editingAnnouncement, setEditingAnnouncement] = useState(false);
  const [announcementDraft, setAnnouncementDraft] = useState('');
  const [messages, setMessages] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem(`room:${roomId}:chat`) || '[]');
    } catch {
      return [];
    }
  });
  const [chatDraft, setChatDraft] = useState('');
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
  const autoJoinAttemptedRef = useRef(false);
  const hostRef = useRef(false);
  const handlePlaybackBlocked = useCallback(() => setPlaybackBlocked(true), []);
  const profileId = String(profile?._id || profile?.id || profile?.userId || '');
  const authenticatedUserId = String(user?._id || user?.id || user?.userId || profileId);
  const roomOwnerId = String(room?.ownerId?._id || room?.ownerId?.id || room?.ownerId || '');
  const isHost = Boolean(profile && room) && (roomOwnerId
    ? profileId === roomOwnerId
    : String(profile.roomId || profile.room?._id || '') === String(roomId));
  hostRef.current = isHost;

  useEffect(() => {
    if (!isHost || !room) return;
    updateRoom({
      ...room,
      isLive: status === 'connected' || status === 'reconnecting',
    });
  }, [isHost, room, status, updateRoom]);

  useEffect(() => {
    setAnnouncement(localStorage.getItem(`room:${roomId}:announcement`) || '');
    try {
      setMessages(JSON.parse(localStorage.getItem(`room:${roomId}:chat`) || '[]'));
    } catch {
      setMessages([]);
    }
  }, [roomId]);

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
      if (String(updatedRoom?._id) !== String(roomId)) return;
      setRoom(updatedRoom);
      if (hostRef.current && typeof updatedRoom.isLive === 'boolean') {
        updateRoomStatus(roomId, updatedRoom.isLive);
      }
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
  }, [roomId, updateRoomStatus]);

  useEffect(() => {
    roomActiveRef.current = true;
    const peers = new Map();
    const pendingCandidates = new Map();
    const restartTimers = new Map();
    const restartAttempts = new Map();

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
        const timer = restartTimers.get(peerId);
        if (timer) window.clearTimeout(timer);
        restartTimers.delete(peerId);
        restartAttempts.delete(peerId);
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

    const restartPeerConnection = async (peerId) => {
      const connection = peers.get(peerId);
      if (!connection || connection.connectionState === 'connected' ||
          connection.connectionState === 'closed' || !localStreamRef.current) return;
      if (socket.id > peerId) return;

      const attempts = restartAttempts.get(peerId) || 0;
      if (attempts >= 5) {
        setError('Audio connection failed after several retries. Check your network and try again.');
        return;
      }
      restartAttempts.set(peerId, attempts + 1);

      try {
        if (connection.signalingState !== 'stable') {
          throw new Error('Peer signaling is still negotiating.');
        }
        connection.restartIce?.();
        const offer = await connection.createOffer({ iceRestart: true });
        await connection.setLocalDescription(offer);
        sendSignal('offer', peerId, 'offer', connection.localDescription);
      } catch (restartError) {
        const retryDelay = Math.min(1000 * (2 ** attempts), 10000);
        const timer = window.setTimeout(() => {
          restartTimers.delete(peerId);
          restartPeerConnection(peerId);
        }, retryDelay);
        restartTimers.set(peerId, timer);
        if (attempts === 0) {
          setError(`Audio connection interrupted; retrying. ${restartError.message}`);
        }
      }
    };

    const schedulePeerRestart = (peerId, delay = 0) => {
      if (restartTimers.has(peerId)) return;
      const timer = window.setTimeout(() => {
        restartTimers.delete(peerId);
        restartPeerConnection(peerId);
      }, delay);
      restartTimers.set(peerId, timer);
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
          schedulePeerRestart(peerId);
        } else if (connection.connectionState === 'disconnected') {
          schedulePeerRestart(peerId, 4000);
        } else if (connection.connectionState === 'connected') {
          const timer = restartTimers.get(peerId);
          if (timer) window.clearTimeout(timer);
          restartTimers.delete(peerId);
          restartAttempts.delete(peerId);
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
      restartTimers.forEach((timer) => window.clearTimeout(timer));
      restartTimers.clear();
      restartAttempts.clear();
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
      socket.timeout(10000).emit('join_room', { roomId, userId: authenticatedUserId }, (timeoutError, result) => {
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
        if (hostRef.current) updateRoomStatus(roomId, true);
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
      if (socket.connected && !disconnectingRef.current) socket.emit('leave-room', roomId);
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
  }, [authenticatedUserId, roomId]);

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

  useEffect(() => {
    if (loading || !room || !profile || autoJoinAttemptedRef.current) return;
    autoJoinAttemptedRef.current = true;
    void joinRoom();
  }, [loading, room, profile]);

  const leaveRoom = () => {
    if (hostRef.current) updateRoomStatus(roomId, false);
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
    onClose();
  };

  const addChatMessage = (message) => {
    setMessages((current) => {
      const next = [...current, message].slice(-100);
      localStorage.setItem(`room:${roomId}:chat`, JSON.stringify(next));
      return next;
    });
  };

  const sendChatMessage = (event) => {
    event.preventDefault();
    const text = chatDraft.trim();
    if (!text) return;
    addChatMessage({
      id: `${Date.now()}-${Math.random()}`,
      username: profile?.username || 'You',
      text,
      createdAt: new Date().toISOString(),
    });
    setChatDraft('');
  };

  const toggleMicrophone = () => {
    const enabled = !micEnabled;
    localStreamRef.current?.getAudioTracks().forEach((track) => {
      track.enabled = enabled;
    });
    setMicEnabled(enabled);
  };

  const currentUserId = String(profile?._id || profile?.id || '');
  const ownerId = String(room?.ownerId?._id || room?.ownerId?.id || room?.ownerId || '');
  const host = room?.ownerId && typeof room.ownerId === 'object' ? room.ownerId : null;
  
  // Updated to 24 seats (0 to 23)
  const roomSeats = useMemo(() => Array.from({ length: 24 }, (_, seatIndex) =>
    room?.seats?.find((seat) => seat.seatIndex === seatIndex) || { seatIndex, userId: null },
  ), [room]);

  const changeSeat = async (seat) => {
    setRoomActionBusy(true);
    setRoomActionError('');
    try {
      const isOwnSeat = String(seat.userId?._id || seat.userId?.id || seat.userId || '') === currentUserId;
      if (isOwnSeat) {
        await leaveRoomSeat(roomId, seat.seatIndex);
        addChatMessage({
          id: `${Date.now()}-leave`,
          username: 'Room',
          text: `${profile?.username || 'A listener'} left Mic ${seat.seatIndex + 1}.`,
          system: true,
          createdAt: new Date().toISOString(),
        });
      } else {
        if (!['connecting', 'connected', 'reconnecting'].includes(status)) {
          void joinRoom();
        }
        await takeRoomSeat(roomId, seat.seatIndex);
        addChatMessage({
          id: `${Date.now()}-join`,
          username: 'Room',
          text: `${profile?.username || 'A listener'} joined Mic ${seat.seatIndex + 1}.`,
          system: true,
          createdAt: new Date().toISOString(),
        });
      }
      setRoom(await getRoom(roomId));
    } catch (requestError) {
      setRoomActionError(requestError.response?.data?.message || requestError.response?.data?.error || requestError.message);
    } finally {
      setRoomActionBusy(false);
    }
  };

  const hostName = host?.username;
  const hostPublicId = host?.publicId || host?.customId;
  const joined = status === 'connected' || status === 'reconnecting';
  const connectedPeerCount = remotePeers.filter((peer) => peer.connected).length;
  const statusLabel = {
    idle: 'Ready to join',
    'requesting-microphone': 'Requesting microphone',
    connecting: 'Connecting to room',
    connected: connectedPeerCount ? 'Audio connected' : 'Connected',
    reconnecting: 'Reconnecting',
    error: 'Signaling error',
  }[status];

  return (
    <main style={{
      position: 'relative',
      width: '100%',
      minHeight: '100vh',
      backgroundColor: '#0f0f13',
      color: '#ffffff',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'space-between',
      overflowX: 'hidden',
      fontFamily: 'sans-serif'
    }}>
      <div style={{
        position: 'absolute',
        inset: 0,
        background: 'radial-gradient(circle at top, #2a1b4e 0%, #0f0f13 70%)',
        zIndex: 0
      }} />

      {isMinimized && (
        <FloatingPlayer
          title={room?.title}
          status={statusLabel}
          micEnabled={micEnabled}
          onRestore={onRestore}
          onToggleMicrophone={toggleMicrophone}
          onClose={leaveRoom}
        />
      )}

      {/* Clean Header */}
      <header style={{
        position: 'relative',
        zIndex: 10,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '12px 16px',
        width: '100%'
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          padding: '6px 12px',
          borderRadius: '9999px',
          border: '1px solid rgba(255, 255, 255, 0.1)'
        }}>
          {host?.avatar || host?.profilePicture ? (
            <img src={host.avatar || host.profilePicture} alt="" style={{ width: '36px', height: '36px', borderRadius: '50%', objectFit: 'cover', border: '2px solid #f59e0b' }} />
          ) : (
            <span style={{ width: '36px', height: '36px', borderRadius: '50%', backgroundColor: '#8b5cf6', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold' }}>
              {hostName?.[0]?.toUpperCase() || 'M'}
            </span>
          )}
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{ fontSize: '12px', fontWeight: 'bold', maxWidth: '100px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {hostName || room?.title || 'Live Room'}
            </span>
            <span style={{ fontSize: '10px', color: '#9ca3af' }}>ID: {hostPublicId || String(roomId).slice(0, 6)}</span>
          </div>
          <button style={{ backgroundColor: '#ec4899', color: '#fff', border: 'none', borderRadius: '50%', width: '20px', height: '20px', fontSize: '12px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', marginLeft: '4px' }}>
            +
          </button>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{ backgroundColor: 'rgba(0,0,0,0.4)', padding: '4px 10px', borderRadius: '9999px', fontSize: '12px', color: '#f59e0b' }}>
            👥 {Number(room?.membersCount) || 1}
          </div>
          <button onClick={onMinimize} style={{ backgroundColor: 'rgba(0,0,0,0.5)', color: '#fff', border: 'none', padding: '8px', borderRadius: '50%', cursor: 'pointer' }}>
            <ChevronDown size={16} />
          </button>
          <button onClick={leaveRoom} style={{ backgroundColor: '#ef4444', color: '#fff', border: 'none', padding: '8px', borderRadius: '50%', cursor: 'pointer' }}>
            <X size={16} />
          </button>
        </div>
      </header>

      {/* Voice Seats Grid (5 Columns Layout - 24 Seats) */}
      <section style={{
        position: 'relative',
        zIndex: 5,
        flex: 1,
        width: '100%',
        maxWidth: '480px',
        margin: '0 auto',
        padding: '16px 12px',
        overflowY: 'auto'
      }}>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(5, 1fr)',
          gap: '16px 8px',
          justifyItems: 'center',
          alignItems: 'center'
        }}>
          {roomSeats.slice(0, 24).map((seat, seatIndex) => {
            const isHostSeat = seatIndex === 0;
            const seatedUser = seat.userId && typeof seat.userId === 'object' ? seat.userId : null;

            return (
              <div
                key={seatIndex}
                onClick={() => changeSeat(seat)}
                style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', cursor: 'pointer' }}
              >
                <div style={{
                  position: 'relative',
                  width: '48px',
                  height: '48px',
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: seatedUser ? '#1f2937' : 'rgba(255, 255, 255, 0.1)',
                  border: seatedUser ? '2px solid #f59e0b' : '1px dashed rgba(255, 255, 255, 0.3)'
                }}>
                  {seatedUser ? (
                    <>
                      <img 
                        src={seatedUser.avatar || seatedUser.profilePicture || "/default-avatar.png"} 
                        alt="" 
                        style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} 
                      />
                      <div style={{ position: 'absolute', bottom: 0, right: 0, backgroundColor: 'rgba(0,0,0,0.8)', padding: '2px', borderRadius: '50%' }}>
                        <Mic size={10} color="#10b981" />
                      </div>
                    </>
                  ) : (
                    <span style={{ color: '#d1d5db', fontSize: '11px', fontWeight: 'bold' }}>
                      {isHostSeat ? <Crown size={14} color="#f59e0b" /> : (seatIndex + 1)}
                    </span>
                  )}

                  {isHostSeat && seatedUser && (
                    <span style={{ position: 'absolute', top: '-10px', fontSize: '12px' }}>👑</span>
                  )}
                </div>

                <span style={{ fontSize: '10px', color: 'rgba(255, 255, 255, 0.9)', marginTop: '4px', textAlign: 'center', width: '56px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {seatedUser ? (seatedUser.username || 'User') : (isHostSeat ? 'Host' : `${seatIndex + 1}`)}
                </span>
              </div>
            );
          })}
        </div>

        {/* Floating Chat / Messages Section */}
        <div style={{ marginTop: '24px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {announcement && (
            <div style={{ backgroundColor: 'rgba(0, 0, 0, 0.5)', padding: '8px 12px', borderRadius: '12px', fontSize: '11px', border: '1px solid rgba(255,255,255,0.1)' }}>
              <span style={{ color: '#f59e0b', fontWeight: 'bold' }}>Announcement:</span> {announcement}
            </div>
          )}

          <div style={{ maxHeight: '120px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '4px', backgroundColor: 'rgba(0, 0, 0, 0.3)', padding: '8px 12px', borderRadius: '12px', fontSize: '11px' }}>
            {messages.slice(-5).map((msg) => (
              <div key={msg.id || Math.random()} style={{ color: '#fff' }}>
                <span style={{ fontWeight: 'bold', color: '#f472b6' }}>{msg.username}:</span> {msg.text}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Bottom Control Bar */}
      <footer style={{
        position: 'relative',
        zIndex: 10,
        padding: '12px 16px',
        backgroundColor: 'rgba(0, 0, 0, 0.6)',
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        width: '100%'
      }}>
        <form onSubmit={sendChatMessage} style={{ flex: 1, display: 'flex', alignItems: 'center', backgroundColor: 'rgba(255, 255, 255, 0.1)', borderRadius: '9999px', padding: '6px 12px', border: '1px solid rgba(255, 255, 255, 0.1)' }}>
          <input
            type="text"
            placeholder="Say Hello..."
            value={chatDraft}
            onChange={(e) => setChatDraft(e.target.value)}
            style={{ backgroundColor: 'transparent', border: 'none', outline: 'none', color: '#fff', fontSize: '12px', width: '100%' }}
          />
        </form>

        <button onClick={toggleMicrophone} style={{ backgroundColor: 'rgba(255, 255, 255, 0.1)', border: 'none', padding: '10px', borderRadius: '50%', color: '#fff', cursor: 'pointer' }}>
          {micEnabled ? <Mic size={16} /> : <MicOff size={16} color="#f87171" />}
        </button>

        <button onClick={() => setGiftsOpen(true)} style={{ background: 'linear-gradient(to right, #a855f7, #ec4899)', border: 'none', padding: '10px', borderRadius: '50%', color: '#fff', cursor: 'pointer' }}>
          <Gift size={16} />
        </button>
      </footer>
    </main>
  );
}