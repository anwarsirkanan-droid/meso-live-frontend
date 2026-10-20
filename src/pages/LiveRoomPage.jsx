import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Crown, Gamepad2, Gift, Mic, MicOff, Share2, X } from 'lucide-react';
import {
  getGiftCatalog,
  getProfile,
  getRoom,
  leaveRoomSeat,
  sendGift,
  takeRoomSeat,
} from '../api.js';
import { useAuth } from '../../context/AuthContext.jsx';
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

export default function LiveRoomPage({
  roomId,
  isMinimized = false,
  onMinimize = () => {},
  onRestore = () => {},
  onClose = () => {},
}) {
  const { updateRoomStatus } = useAuth();
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
  const hostRef = useRef(false);
  const handlePlaybackBlocked = useCallback(() => setPlaybackBlocked(true), []);
  const isHost = Boolean(profile && room?.ownerId) &&
    String(profile._id || profile.id || '') ===
      String(room.ownerId?._id || room.ownerId?.id || room.ownerId || '');
  hostRef.current = isHost;

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
  const visibleGifts = useMemo(() => {
    const matchingNames = GIFT_CATEGORY_NAMES[giftCategory];
    return gifts.filter((gift) => {
      const category = String(gift.category || gift.type || '').toLowerCase();
      return category === giftCategory.toLowerCase() ||
        matchingNames.some((name) => name.toLowerCase() === String(gift.name).toLowerCase());
    });
  }, [giftCategory, gifts]);
  const selectedGift = gifts.find((gift) => gift._id === selectedGiftId);
  const selectedGiftTotal = Number(selectedGift?.coinPrice || 0) * giftQuantity *
    (selectedReceiverId === 'all'
      ? roomSeats.filter((seat) => seat.userId && String(
          seat.userId?._id || seat.userId?.id || seat.userId,
        ) !== currentUserId).length
      : 1);

  return (
    <main className={`live-room-page${isMinimized ? ' is-minimized' : ''}`}>
      {isMinimized && (
        <div className="live-room-background-bar">
          <span className={`live-room-background-dot is-${status}`} />
          <span className="live-room-background-title">{room?.title || 'Meso Live room'}</span>
          <span className="live-room-background-status">{statusLabel}</span>
          <button
            className="room-mini-control"
            type="button"
            onClick={toggleMicrophone}
            disabled={!localStreamRef.current}
            aria-label={micEnabled ? 'Mute microphone' : 'Unmute microphone'}
          >
            {micEnabled ? <Mic size={17} /> : <MicOff size={17} />}
          </button>
          <button className="room-mini-control" type="button" onClick={onRestore} aria-label="Return to room">
            Return
          </button>
          <button className="room-mini-control room-mini-close" type="button" onClick={leaveRoom} aria-label="Leave room">
            <X size={17} />
          </button>
        </div>
      )}
      <header className="live-room-header">
        <div className="live-room-heading">
          <div className="live-room-host-identity">
            {host?.avatar || host?.profilePicture
              ? <img className="live-room-host-avatar" src={host.avatar || host.profilePicture} alt="" />
              : <span className="live-room-host-avatar live-room-host-avatar-fallback">{hostName?.[0]?.toUpperCase() || 'M'}</span>}
            <div>
              <p className="eyebrow">{room?.category ? room.category.toUpperCase() : 'LIVE ROOM'}</p>
              <h1>{room?.title || 'Live room'}</h1>
              <p className="live-room-id">ROOM ID · {roomId}</p>
            </div>
          </div>
          <p className="muted live-room-host">
            {room?.isLive && <span className="live-pill"><i /> LIVE NOW</span>}
            {hostName ? `Hosted by ${hostName}` : 'Join the conversation'}
            <span className={`live-room-connection is-${status}`} role="status">{statusLabel}</span>
          </p>
        </div>
        <div className="live-room-header-right">
          <div className="live-room-stats">
            <span>👥 {Number(room?.membersCount) || 0} listening</span>
            <span>🪙 {(Number(room?.totalCoins || room?.coins) || 0).toLocaleString()} room coins</span>
            <span><Gamepad2 size={15} /> {Number(room?.miniGamesCount) || 0} games</span>
          </div>
          <div className="room-controls live-room-header-controls">
            {joined ? (
              <button
                className="button button-secondary"
                type="button"
                onClick={toggleMicrophone}
                aria-pressed={!micEnabled}
              >
                {micEnabled ? 'Mute microphone' : 'Unmute microphone'}
              </button>
            ) : (
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
            )}
            {joined && (
              <div className="room-mic-meter" aria-label={`Microphone level ${micLevel}%`}>
                <span style={{ width: `${micLevel}%` }} />
              </div>
            )}
            <button className="button button-secondary" type="button" onClick={shareRoom} aria-label="Share room">
              <Share2 size={16} /> Share
            </button>
            <button className="button button-secondary" type="button" onClick={onMinimize} aria-label="Minimize room">
              Minimize
            </button>
            <button className="button button-danger room-close-button" type="button" onClick={leaveRoom} aria-label="Close room">
              <X size={17} />
            </button>
          </div>
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
                  const crown = seat.isCrownMic === true || seat.seatIndex < 4;
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
                      <span className="mic-seat-icon" aria-hidden="true">{crown ? <Crown size={17} /> : occupied ? '🎙️' : '+'}</span>
                      <span className="mic-seat-name">{occupied ? seatLabel : `Mic ${seat.seatIndex + 1}`}</span>
                      {crown && <span className="mic-seat-popularity" aria-label="VIP popular seat">🔥</span>}
                      {seat.isLocked && <span className="mic-seat-lock" aria-label="Locked">🔒</span>}
                    </button>
                  );
                })}
              </div>
              {ownSeat && (
                <p className="muted room-panel-hint">You are on {ownSeat.isCrownMic ? 'the Crown Mic' : `Mic ${ownSeat.seatIndex + 1}`}.</p>
              )}
            </section>
          </div>
          <section className="room-announcement card">
            <div className="room-announcement-heading">
              <div>
                <p className="eyebrow">ROOM ANNOUNCEMENT</p>
                {announcementOpen && !editingAnnouncement && (
                  <p>{announcement || 'Welcome in! Say hello and enjoy the room.'}</p>
                )}
              </div>
              <div className="room-announcement-actions">
                {isHost && (
                  <button
                    className="button button-quiet button-small"
                    type="button"
                    onClick={() => {
                      setAnnouncementDraft(announcement);
                      setEditingAnnouncement((current) => !current);
                    }}
                  >
                    {editingAnnouncement ? 'Cancel' : 'Edit'}
                  </button>
                )}
                <button
                  className="button button-quiet button-small"
                  type="button"
                  onClick={() => setAnnouncementOpen((current) => !current)}
                  aria-expanded={announcementOpen}
                >
                  {announcementOpen ? 'Collapse' : 'Expand'}
                </button>
              </div>
            </div>
            {editingAnnouncement && (
              <form className="room-announcement-form" onSubmit={saveAnnouncement}>
                <input
                  aria-label="Room announcement"
                  maxLength={240}
                  value={announcementDraft}
                  onChange={(event) => setAnnouncementDraft(event.target.value)}
                  placeholder="Share an update with the room"
                />
                <button className="button button-primary button-small" type="submit">Save</button>
              </form>
            )}
          </section>
          <section className="card room-chat-panel" aria-labelledby="room-chat-title">
            <div className="section-heading">
              <div>
                <p className="eyebrow">REAL-TIME ACTIVITY</p>
                <h2 id="room-chat-title">Room chat</h2>
              </div>
              <span className="count-badge">{messages.length} messages</span>
            </div>
            <div className="room-chat-feed" role="log" aria-live="polite" aria-relevant="additions">
              {messages.length === 0 && <p className="muted">Say hello to get the conversation started.</p>}
              {messages.map((message) => (
                <p className={message.system ? 'room-chat-message is-system' : 'room-chat-message'} key={message.id}>
                  <strong>{message.username}</strong>
                  <span>{message.text.split(/(@[\w.-]+)/g).map((part, index) =>
                    part.startsWith('@')
                      ? <strong className="room-chat-mention" key={`${message.id}-${index}`}>{part}</strong>
                      : part,
                  )}</span>
                </p>
              ))}
            </div>
          </section>
          <div className="room-bottom-controls">
            <form className="room-bottom-chat" onSubmit={sendChatMessage}>
              <input
                aria-label="Say hello in room chat"
                maxLength={500}
                placeholder="Say Hello… use @ to mention someone"
                value={chatDraft}
                onChange={(event) => setChatDraft(event.target.value)}
              />
              <button className="room-emoji-control" type="button" onClick={() => chooseEmoji('😊')} aria-label="Add emoji">😊</button>
              <button className="button button-primary" type="submit" disabled={!chatDraft.trim()}>Send</button>
            </form>
            <button className="room-bottom-control" type="button" onClick={toggleMicrophone} disabled={!joined} aria-label={micEnabled ? 'Mute microphone' : 'Unmute microphone'}>
              {micEnabled ? <Mic size={18} /> : <MicOff size={18} />}
              {micEnabled ? 'Mute' : 'Unmute'}
            </button>
            <Link className="room-bottom-control" to="/games/dice">
              <Gamepad2 size={18} /> Games
            </Link>
            <button className="room-bottom-control is-gift" type="button" onClick={() => setGiftsOpen(true)}>
              <Gift size={18} /> Gifts
            </button>
          </div>
          <div className="room-floating-widgets">
            <button type="button" onClick={() => setGiftFeedback('PK battles are coming soon.')}>⚔️ PK Battle</button>
            <Link to="/profile">🎁 Daily rewards</Link>
            <Link to="/profile">🏆 Room ranking</Link>
          </div>
        </>
      )}
      {giftsOpen && (
        <div className="room-modal-overlay" role="presentation" onMouseDown={(event) => {
          if (event.target === event.currentTarget && !giftBusy) setGiftsOpen(false);
        }}>
          <aside className="card room-gifts-panel room-gift-modal" aria-labelledby="room-gifts-title" role="dialog" aria-modal="true">
            <div className="section-heading">
              <div>
                <p className="eyebrow">GIFT STORE · COMBO</p>
                <h2 id="room-gifts-title">Send a gift</h2>
              </div>
              <button className="button button-quiet button-small" type="button" onClick={() => setGiftsOpen(false)} disabled={giftBusy} aria-label="Close gift store">
                <X size={17} />
              </button>
            </div>
            <span className="count-badge">{(Number(profile?.coins) || 0).toLocaleString()} coins available</span>
            {giftError && <p className="form-error" role="alert">{giftError}</p>}
            {giftFeedback && <p className="success-message" role="status">{giftFeedback}</p>}
            <label className="field room-gift-recipient">
              <span>Recipient</span>
              <select value={selectedReceiverId} onChange={(event) => setSelectedReceiverId(event.target.value)}>
                <option value="all">All occupied mic seats</option>
                {giftRecipients.map((recipient) => (
                  <option key={recipient.id} value={recipient.id}>{recipient.name}</option>
                ))}
              </select>
            </label>
            <div className="room-gift-categories" role="tablist" aria-label="Gift categories">
              {GIFT_CATEGORIES.map((category) => (
                <button
                  className={giftCategory === category ? 'is-active' : ''}
                  key={category}
                  type="button"
                  role="tab"
                  aria-selected={giftCategory === category}
                  onClick={() => setGiftCategory(category)}
                >
                  {category}
                </button>
              ))}
            </div>
            {visibleGifts.length ? (
              <div className="room-gift-grid">
                {visibleGifts.map((gift) => (
                  <button
                    className={`room-gift-option${selectedGiftId === gift._id ? ' is-selected' : ''}`}
                    key={gift._id}
                    type="button"
                    onClick={() => setSelectedGiftId(gift._id)}
                    aria-pressed={selectedGiftId === gift._id}
                  >
                    <span aria-hidden="true">{gift.icon}</span>
                    <strong>{gift.name}</strong>
                    <small>{Number(gift.coinPrice || 0).toLocaleString()} coins</small>
                  </button>
                ))}
              </div>
            ) : (
              <p className="muted room-panel-hint">
                {gifts.length ? `No ${giftCategory.toLowerCase()} gifts are in the server catalog.` : 'The server gift catalog is unavailable.'}
              </p>
            )}
            <label className="field room-gift-quantity">
              <span>Quantity</span>
              <select value={giftQuantity} onChange={(event) => setGiftQuantity(Number(event.target.value))}>
                {GIFT_QUANTITIES.map((quantity) => <option key={quantity} value={quantity}>{quantity}</option>)}
              </select>
            </label>
            <p className="room-gift-total">
              Total: <strong>{selectedGiftTotal.toLocaleString()} coins</strong>
              {selectedReceiverId === 'all' && <span> · all occupied seats</span>}
            </p>
            <button
              className="button button-primary button-full room-send-gift"
              type="button"
              onClick={giftSelectedUser}
              disabled={giftBusy || !selectedGiftId || !selectedReceiverId}
            >
              {giftBusy ? 'Sending gift…' : `Send ${giftQuantity} gift${giftQuantity === 1 ? '' : 's'}`}
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
      )}
    </main>
  );
}
