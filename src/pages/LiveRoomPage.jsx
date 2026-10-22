import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, Crown, Gift, Mic, MicOff, X } from 'lucide-react';
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
  const [announcement, setAnnouncement] = useState(() => localStorage.getItem(`room:${roomId}:announcement`) || '');
  const [messages, setMessages] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem(`room:${roomId}:chat`) || '[]');
    } catch {
      return [];
    }
  });
  const [chatDraft, setChatDraft] = useState('');
  const [status, setStatus] = useState('idle');
  const [micEnabled, setMicEnabled] = useState(true);
  const [remotePeers, setRemotePeers] = useState([]);
  const localStreamRef = useRef(null);
  const audioContextRef = useRef(null);
  const animationFrameRef = useRef(null);
  const disconnectingRef = useRef(false);
  const roomActiveRef = useRef(true);
  const requestRoomJoinRef = useRef(null);
  const autoJoinAttemptedRef = useRef(false);
  const hostRef = useRef(false);

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
    let active = true;
    getRoom(roomId)
      .then((data) => { if (active) setRoom(data); })
      .catch(() => {});
    getProfile()
      .then((data) => { if (active) setProfile(data); })
      .catch(() => {});
    return () => { active = false; };
  }, [roomId]);

  useEffect(() => {
    const onRoomUpdated = (updatedRoom) => {
      if (String(updatedRoom?._id) !== String(roomId)) return;
      setRoom(updatedRoom);
      if (hostRef.current && typeof updatedRoom.isLive === 'boolean') {
        updateRoomStatus(roomId, updatedRoom.isLive);
      }
    };
    socket.on('room_updated', onRoomUpdated);
    return () => { socket.off('room_updated', onRoomUpdated); };
  }, [roomId, updateRoomStatus]);

  useEffect(() => {
    roomActiveRef.current = true;
    const peers = new Map();

    const createPeer = (peerId) => {
      const existing = peers.get(peerId);
      if (existing) return existing;
      const connection = new RTCPeerConnection({ iceServers: ICE_SERVERS });
      if (localStreamRef.current) {
        localStreamRef.current.getAudioTracks().forEach((track) => connection.addTrack(track, localStreamRef.current));
      }
      peers.set(peerId, connection);
      return connection;
    };

    const onUserJoined = async (payload) => {
      const peerId = getPeerId(payload);
      if (!peerId || peerId === socket.id || peers.has(peerId) || !localStreamRef.current) return;
      try {
        const connection = createPeer(peerId);
        const offer = await connection.createOffer();
        await connection.setLocalDescription(offer);
        socket.emit('offer', { roomId, target: peerId, offer: connection.localDescription });
      } catch (err) {}
    };

    socket.on('user-joined', onUserJoined);
    return () => {
      socket.off('user-joined', onUserJoined);
      peers.forEach((conn) => conn.close());
      peers.clear();
    };
  }, [roomId]);

  const joinRoom = async () => {
    if (status === 'connecting' || status === 'connected') return;
    try {
      if (!navigator.mediaDevices?.getUserMedia) return;
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      localStreamRef.current = stream;
      socket.auth = { token: localStorage.getItem('token') || '' };
      socket.connect();
      socket.emit('join_room', { roomId, userId: authenticatedUserId });
      setStatus('connected');
    } catch (err) {
      setStatus('idle');
    }
  };

  useEffect(() => {
    if (!room || !profile || autoJoinAttemptedRef.current) return;
    autoJoinAttemptedRef.current = true;
    void joinRoom();
  }, [room, profile]);

  const leaveRoom = () => {
    if (hostRef.current) updateRoomStatus(roomId, false);
    if (socket.connected) socket.emit('leave-room', roomId);
    socket.disconnect();
    localStreamRef.current?.getTracks().forEach((track) => track.stop());
    localStreamRef.current = null;
    onClose();
  };

  const sendChatMessage = (event) => {
    event.preventDefault();
    if (!chatDraft.trim()) return;
    setMessages((prev) => [...prev, { id: Date.now(), username: profile?.username || 'You', text: chatDraft }]);
    setChatDraft('');
  };

  const toggleMicrophone = () => {
    const enabled = !micEnabled;
    localStreamRef.current?.getAudioTracks().forEach((track) => { track.enabled = enabled; });
    setMicEnabled(enabled);
  };

  const currentUserId = String(profile?._id || profile?.id || '');
  const host = room?.ownerId && typeof room.ownerId === 'object' ? room.ownerId : null;

  const roomSeats = useMemo(() => Array.from({ length: 24 }, (_, seatIndex) =>
    room?.seats?.find((seat) => seat.seatIndex === seatIndex) || { seatIndex, userId: null },
  ), [room]);

  const changeSeat = async (seat) => {
    try {
      const isOwnSeat = String(seat.userId?._id || seat.userId?.id || seat.userId || '') === currentUserId;
      if (isOwnSeat) {
        await leaveRoomSeat(roomId, seat.seatIndex);
      } else {
        await takeRoomSeat(roomId, seat.seatIndex);
      }
      setRoom(await getRoom(roomId));
    } catch (err) {}
  };

  // IF MINIMIZED -> Show Only Small Floating Player Card
  if (isMinimized) {
    return (
      <FloatingPlayer
        title={room?.title || 'Live Room'}
        status={status}
        micEnabled={micEnabled}
        onRestore={onRestore}
        onToggleMicrophone={toggleMicrophone}
        onClose={leaveRoom}
      />
    );
  }

  // FULL ROOM INTERFACE
  return (
    <main style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: '#0f0f13',
      color: '#ffffff',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'space-between',
      zIndex: 9999, // Covers screen fully only when NOT minimized
      fontFamily: 'sans-serif'
    }}>
      {/* Background Overlay */}
      <div style={{
        position: 'absolute',
        inset: 0,
        background: 'radial-gradient(circle at top, #2a1b4e 0%, #0f0f13 70%)',
        zIndex: 0
      }} />

      {/* Header */}
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
          {host?.avatar ? (
            <img src={host.avatar} alt="" style={{ width: '36px', height: '36px', borderRadius: '50%', objectFit: 'cover' }} />
          ) : (
            <span style={{ width: '36px', height: '36px', borderRadius: '50%', backgroundColor: '#8b5cf6', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold' }}>
              {host?.username?.[0]?.toUpperCase() || 'M'}
            </span>
          )}
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{ fontSize: '12px', fontWeight: 'bold' }}>{host?.username || room?.title || 'Live Room'}</span>
            <span style={{ fontSize: '10px', color: '#9ca3af' }}>ID: {String(roomId).slice(0, 6)}</span>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button onClick={onMinimize} style={{ backgroundColor: 'rgba(0,0,0,0.5)', color: '#fff', border: 'none', padding: '8px', borderRadius: '50%', cursor: 'pointer' }}>
            <ChevronDown size={18} />
          </button>
          <button onClick={leaveRoom} style={{ backgroundColor: '#ef4444', color: '#fff', border: 'none', padding: '8px', borderRadius: '50%', cursor: 'pointer' }}>
            <X size={18} />
          </button>
        </div>
      </header>

      {/* 24 Circle Voice Seats Grid */}
      <section style={{
        position: 'relative',
        zIndex: 5,
        flex: 1,
        width: '100%',
        maxWidth: '480px',
        margin: '0 auto',
        padding: '12px',
        overflowY: 'auto'
      }}>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(5, 1fr)',
          gap: '12px 6px',
          justifyItems: 'center'
        }}>
          {roomSeats.map((seat, seatIndex) => {
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
                  width: '46px',
                  height: '46px',
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: seatedUser ? '#1f2937' : 'rgba(255, 255, 255, 0.1)',
                  border: seatedUser ? '2px solid #f59e0b' : '1px dashed rgba(255, 255, 255, 0.3)'
                }}>
                  {seatedUser ? (
                    <img 
                      src={seatedUser.avatar || "/default-avatar.png"} 
                      alt="" 
                      style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} 
                    />
                  ) : (
                    <span style={{ color: '#d1d5db', fontSize: '12px', fontWeight: 'bold' }}>
                      {isHostSeat ? <Crown size={14} color="#f59e0b" /> : (seatIndex + 1)}
                    </span>
                  )}
                </div>

                {/* Clean Label underneath - Single text without duplication */}
                <span style={{ fontSize: '10px', color: 'rgba(255, 255, 255, 0.8)', marginTop: '4px', textAlign: 'center', width: '50px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {seatedUser ? (seatedUser.username || 'User') : (isHostSeat ? 'Host' : (seatIndex + 1))}
                </span>
              </div>
            );
          })}
        </div>

        {/* Chat Stream */}
        <div style={{ marginTop: '16px', maxHeight: '100px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '4px', backgroundColor: 'rgba(0,0,0,0.3)', padding: '8px', borderRadius: '8px', fontSize: '11px' }}>
          {messages.slice(-5).map((msg) => (
            <div key={msg.id} style={{ color: '#fff' }}>
              <span style={{ fontWeight: 'bold', color: '#f472b6' }}>{msg.username}:</span> {msg.text}
            </div>
          ))}
        </div>
      </section>

      {/* Footer Controls */}
      <footer style={{
        position: 'relative',
        zIndex: 10,
        padding: '12px 16px',
        backgroundColor: 'rgba(0, 0, 0, 0.7)',
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        width: '100%'
      }}>
        <form onSubmit={sendChatMessage} style={{ flex: 1, display: 'flex', alignItems: 'center', backgroundColor: 'rgba(255, 255, 255, 0.1)', borderRadius: '9999px', padding: '6px 12px' }}>
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
      </footer>
    </main>
  );
}