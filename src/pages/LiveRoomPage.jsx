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

  const saveAnnouncement = (event) => {
    event.preventDefault();
    const text = announcementDraft.trim();
    localStorage.setItem(`room:${roomId}:announcement`, text);
    setAnnouncement(text);
    setEditingAnnouncement(false);
  };

  const shareRoom = async () => {
    const url = `${window.location.origin}/live/${encodeURIComponent(roomId)}`;
    try {
      if (navigator.share) {
        await navigator.share({ title: room?.title || 'Meso Live room', url });
      } else {
        await navigator.clipboard.writeText(url);
        setWarning('Room link copied to clipboard.');
      }
    } catch (shareError) {
      if (shareError.name !== 'AbortError') {
        setRoomActionError(`Could not share this room: ${shareError.message}`);
      }
    }
  };

  const chooseEmoji = (emoji) => setChatDraft((current) => `${current}${emoji}`);

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
    if (selectedReceiverId === 'all') return;
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

  const giftSelectedUser = async () => {
    setGiftBusy(true);
    setGiftError('');
    setGiftFeedback('');
    try {
      const activeSeatRecipients = roomSeats.flatMap((seat) => {
        const user = seat.userId && typeof seat.userId === 'object' ? seat.userId : null;
        const id = String(user?._id || user?.id || seat.userId || '');
        return id && id !== currentUserId ? [id] : [];
      });
      const receiverIds = selectedReceiverId === 'all'
        ? [...new Set(activeSeatRecipients)]
        : [selectedReceiverId];
      if (!receiverIds.length) throw new Error('There are no occupied seats to receive this gift.');
      let result;
      for (const receiverId of receiverIds) {
        result = await sendGift({
          roomId,
          receiverId,
          giftId: selectedGiftId,
          quantity: giftQuantity,
        });
      }
      if (result?.senderBalance != null) {
        setProfile((current) => current ? { ...current, coins: result.senderBalance } : current);
      }
      setGiftFeedback(result?.message || `Gift sent ${giftQuantity} time${giftQuantity === 1 ? '' : 's'}.`);
    } catch (requestError) {
      setGiftError(requestError.response?.data?.error || requestError.response?.data?.message || requestError.message);
    } finally {
      setGiftBusy(false);
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
    <main className={`live-room-page ${isMinimized ? 'is-minimized' : ''}`}>
      <div className="live-room-bg-overlay" />

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
      <header className="flex items-center justify-between p-3 absolute top-0 left-0 w-full z-10">
        <div className="flex items-center gap-2 bg-black/40 backdrop-blur-md px-3 py-1.5 rounded-full border border-white/10 text-white">
          {host?.avatar || host?.profilePicture ? (
            <img className="w-10 h-10 rounded-full border-2 border-yellow-400 object-cover" src={host.avatar || host.profilePicture} alt="" />
          ) : (
            <span className="w-10 h-10 rounded-full bg-purple-600 flex items-center justify-center font-bold text-white">
              {hostName?.[0]?.toUpperCase() || 'M'}
            </span>
          )}
          <div className="flex flex-col">
            <span className="text-xs font-bold truncate max-w-[90px]">{hostName || room?.title || 'Live Room'}</span>
            <span className="text-[10px] text-gray-300">ID: {hostPublicId || roomId.slice(0, 6)}</span>
          </div>
          <button className="bg-pink-500 hover:bg-pink-600 text-white p-1 rounded-full text-xs ml-1" title="Follow">
            +
          </button>
        </div>

        {/* Top Right Controls */}
        <div className="flex items-center gap-2">
          <div className="flex items-center bg-black/30 backdrop-blur-md px-2 py-1 rounded-full text-xs text-yellow-400">
            <span className="mr-1">👥</span>
            <span>{Number(room?.membersCount) || 1}</span>
          </div>

          <button onClick={onMinimize} className="p-2 bg-black/40 backdrop-blur-md rounded-full text-gray-300 hover:text-white">
            <ChevronDown size={16} />
          </button>
          <button onClick={leaveRoom} className="p-2 bg-red-500/80 backdrop-blur-md rounded-full text-white hover:bg-red-600">
            <X size={16} />
          </button>
        </div>
      </header>

      {/* Voice Seats Grid (Circle Layout) */}
      <section className="flex-1 w-full max-w-lg mx-auto px-4 pt-20 pb-4 overflow-y-auto z-0">
        <div className="grid grid-cols-5 gap-y-5 gap-x-2 justify-items-center">
          {roomSeats.slice(0, 20).map((seat, seatIndex) => {
            const isHostSeat = seatIndex === 0;
            const seatedUser = seat.userId && typeof seat.userId === 'object' ? seat.userId : null;

            return (
              <div
                key={seatIndex}
                onClick={() => changeSeat(seat)}
                className="flex flex-col items-center justify-center relative cursor-pointer group"
              >
                <div className={`relative w-12 h-12 rounded-full flex items-center justify-center transition-transform active:scale-95 ${
                  seatedUser 
                    ? 'border-2 border-yellow-400 bg-black/60' 
                    : 'bg-black/30 backdrop-blur-md border border-white/20 hover:border-white/50'
                }`}>
                  {seatedUser ? (
                    <>
                      <img 
                        src={seatedUser.avatar || seatedUser.profilePicture || "/default-avatar.png"} 
                        alt="" 
                        className="w-full h-full rounded-full object-cover" 
                      />
                      <div className="absolute bottom-0 right-0 bg-black/80 p-0.5 rounded-full text-[8px]">
                        <Mic size={10} className="text-green-400" />
                      </div>
                    </>
                  ) : (
                    <span className="text-gray-300 text-xs font-semibold">
                      {isHostSeat ? <Crown className="text-yellow-400" size={14} /> : (seatIndex + 1)}
                    </span>
                  )}

                  {isHostSeat && seatedUser && (
                    <span className="absolute -top-3 text-xs">👑</span>
                  )}
                </div>

                <span className="text-[10px] text-white/90 font-medium mt-1 truncate w-14 text-center">
                  {seatedUser ? (seatedUser.username || 'User') : (isHostSeat ? 'Host' : `${seatIndex + 1}`)}
                </span>
              </div>
            );
          })}
        </div>

        {/* Chat and Announcements */}
        <div className="mt-6 space-y-2">
          {announcement && (
            <div className="bg-black/40 backdrop-blur-md p-2 rounded-xl text-xs text-white border border-white/10">
              <span className="text-yellow-400 font-bold">Announcement:</span> {announcement}
            </div>
          )}

          <div className="max-h-36 overflow-y-auto space-y-1 text-xs bg-black/20 backdrop-blur-sm p-2 rounded-xl">
            {messages.slice(-5).map((msg) => (
              <div key={msg.id || Math.random()} className="text-white/90">
                <span className="font-bold text-pink-400">{msg.username}:</span> {msg.text}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Bottom Control Bar */}
      <footer className="p-3 bg-black/40 backdrop-blur-md flex items-center gap-2 w-full z-10">
        <form onSubmit={sendChatMessage} className="flex-1 flex items-center bg-white/10 rounded-full px-3 py-1.5 border border-white/10">
          <input
            type="text"
            placeholder="Say Hello..."
            value={chatDraft}
            onChange={(e) => setChatDraft(e.target.value)}
            className="bg-transparent text-white text-xs w-full focus:outline-none placeholder-gray-400"
          />
        </form>

        <button onClick={toggleMicrophone} className="p-2.5 bg-white/10 hover:bg-white/20 rounded-full text-white">
          {micEnabled ? <Mic size={16} /> : <MicOff size={16} className="text-red-400" />}
        </button>

        <button onClick={() => setGiftsOpen(true)} className="p-2.5 bg-gradient-to-r from-purple-500 to-pink-500 rounded-full text-white">
          <Gift size={16} />
        </button>
      </footer>
    </main>
  );
}