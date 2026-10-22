import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ChevronDown,
  Crown,
  Gift,
  Mic,
  MicOff,
  Armchair,
  Gamepad2,
  X,
  Settings,
  Shield,
  Lock,
  VolumeX,
  Grid,
  Edit3,
  UserX,
  Image as ImageIcon
} from 'lucide-react';
import {
  getProfile,
  getRoom,
  leaveRoomSeat,
  sendGift,
  takeRoomSeat,
  getGiftCatalog,
  updateRoomNotice,
  setRoomPassword,
  kickRoomUser,
} from '../api.js';
import { useAuth } from '../../context/AuthContext.jsx';
import FloatingPlayer from '../components/FloatingPlayer.jsx';
import socket from '../socket.js';

const ICE_SERVERS = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
];

export default function LiveRoomPage({
  roomId,
  isMinimized = false,
  onMinimize = () => {},
  onRestore = () => {},
  onClose = () => {},
}) {
  const { user } = useAuth();
  const [room, setRoom] = useState(null);
  const [profile, setProfile] = useState(null);
  const [messages, setMessages] = useState([]);
  const [chatDraft, setChatDraft] = useState('');
  const [micEnabled, setMicEnabled] = useState(true);
  const [giftsOpen, setGiftsOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [announcementModal, setAnnouncementModal] = useState(false);
  const [passwordModal, setPasswordModal] = useState(false);
  const [gifts, setGifts] = useState([]);
  const [isFollowed, setIsFollowed] = useState(false);
  const [announcementDraft, setAnnouncementDraft] = useState('');
  const [passwordDraft, setPasswordDraft] = useState('');
  const [micMode, setMicMode] = useState('free'); // 'free' or 'apply'
  const [giftAnimation, setGiftAnimation] = useState(null);

  const localStreamRef = useRef(null);
  const peersRef = useRef(new Map());
  const autoJoinAttemptedRef = useRef(false);

  const profileId = String(profile?._id || profile?.id || profile?.userId || '');
  const authenticatedUserId = String(user?._id || user?.id || user?.userId || profileId);

  // 1. Fetch Room, Profile, & Catalog
  useEffect(() => {
    let active = true;
    getRoom(roomId).then((data) => {
      if (active) {
        setRoom(data);
        setAnnouncementDraft(data?.notice || 'Welcome to our room!');
        setMicMode(data?.micMode || 'free');
      }
    }).catch(console.error);

    getProfile().then((data) => { if (active) setProfile(data); }).catch(console.error);
    getGiftCatalog().then((data) => { if (active && Array.isArray(data)) setGifts(data); }).catch(console.error);

    return () => { active = false; };
  }, [roomId]);

  // 2. WebRTC & Socket Real-Time Listeners
  useEffect(() => {
    socket.auth = { token: localStorage.getItem('token') || '' };
    if (!socket.connected) socket.connect();

    // Listen for Real-Time Messages
    socket.on('chat_message', (newMsg) => {
      setMessages((prev) => [...prev, newMsg]);
    });

    // Listen for Real-Time Notice / Announcement Updates
    socket.on('notice_updated', ({ notice }) => {
      setRoom((prev) => prev ? { ...prev, notice } : prev);
    });

    // Listen for Gift Animation Stream
    socket.on('gift_sent', (giftData) => {
      setGiftAnimation(giftData);
      setTimeout(() => setGiftAnimation(null), 4000);
    });

    // Listen for Mic Mode Change
    socket.on('mic_mode_changed', ({ mode }) => {
      setMicMode(mode);
    });

    // Listen for Mute All Event
    socket.on('all_mics_closed', () => {
      if (localStreamRef.current) {
        localStreamRef.current.getAudioTracks().forEach(t => t.enabled = false);
        setMicEnabled(false);
      }
    });

    // WebRTC Signaling
    socket.on('user_joined_voice', async ({ socketId }) => {
      if (!localStreamRef.current) return;
      const peer = new RTCPeerConnection({ iceServers: ICE_SERVERS });
      peersRef.current.set(socketId, peer);

      localStreamRef.current.getTracks().forEach(track => peer.addTrack(track, localStreamRef.current));

      peer.onicecandidate = (e) => {
        if (e.candidate) socket.emit('ice_candidate', { target: socketId, candidate: e.candidate });
      };

      const offer = await peer.createOffer();
      await peer.setLocalDescription(offer);
      socket.emit('voice_offer', { target: socketId, offer });
    });

    return () => {
      socket.off('chat_message');
      socket.off('notice_updated');
      socket.off('gift_sent');
      socket.off('mic_mode_changed');
      socket.off('all_mics_closed');
      socket.off('user_joined_voice');
    };
  }, [roomId]);

  // 3. Audio Stream & Room Join
  const joinRoomAudio = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      localStreamRef.current = stream;
      socket.emit('join_room', { roomId, userId: authenticatedUserId });
    } catch (err) {
      console.error("Audio access error:", err);
    }
  };

  useEffect(() => {
    if (!room || !profile || autoJoinAttemptedRef.current) return;
    autoJoinAttemptedRef.current = true;
    void joinRoomAudio();
  }, [room, profile]);

  const leaveRoom = () => {
    if (socket.connected) socket.emit('leave_room', { roomId });
    socket.disconnect();
    localStreamRef.current?.getTracks().forEach((track) => track.stop());
    onClose();
  };

  // 4. FIX: 25 SEATS GRID (0 to 24)
  const roomSeats = useMemo(() => Array.from({ length: 25 }, (_, seatIndex) =>
    room?.seats?.find((seat) => seat.seatIndex === seatIndex) || { seatIndex, userId: null },
  ), [room]);

  const changeSeat = async (seat) => {
    try {
      const isOwnSeat = String(seat.userId?._id || seat.userId?.id || seat.userId || '') === profileId;
      if (isOwnSeat) {
        await leaveRoomSeat(roomId, seat.seatIndex);
      } else {
        await takeRoomSeat(roomId, seat.seatIndex);
      }
      setRoom(await getRoom(roomId));
    } catch (err) {
      console.error("Seat Change Error:", err);
    }
  };

  // Chat Emit
  const sendChatMessage = (e) => {
    e.preventDefault();
    if (!chatDraft.trim()) return;
    const msgData = {
      id: `${Date.now()}-${Math.random()}`,
      username: profile?.username || 'User',
      text: chatDraft.trim(),
      roomId
    };
    socket.emit('chat_message', msgData);
    setChatDraft('');
  };

  // Announcement Update API + Socket
  const handleSaveNotice = async () => {
    try {
      await updateRoomNotice(roomId, announcementDraft);
      socket.emit('update_notice', { roomId, notice: announcementDraft });
      setRoom((prev) => prev ? { ...prev, notice: announcementDraft } : prev);
      setAnnouncementModal(false);
    } catch (err) {
      console.error("Notice error:", err);
    }
  };

  // Mic Mode Toggle
  const toggleMicMode = () => {
    const nextMode = micMode === 'free' ? 'apply' : 'free';
    setMicMode(nextMode);
    socket.emit('change_mic_mode', { roomId, mode: nextMode });
  };

  // Close All Mics
  const handleCloseAllMics = () => {
    socket.emit('close_all_mics', { roomId });
    setMenuOpen(false);
  };

  // Password Set
  const handleSetPassword = async () => {
    try {
      await setRoomPassword(roomId, passwordDraft);
      setPasswordModal(false);
      setMenuOpen(false);
    } catch (err) {
      console.error("Password error:", err);
    }
  };

  // Send Gift API + Socket
  const handleSendGift = async (giftId) => {
    try {
      const giftRes = await sendGift({ roomId, receiverId: room?.ownerId?._id, giftId, quantity: 1 });
      socket.emit('send_gift', { roomId, gift: giftRes });
      setGiftsOpen(false);
    } catch (err) {
      console.error("Gift error:", err);
    }
  };

  if (isMinimized) {
    return (
      <FloatingPlayer
        title={room?.title || 'Live Room'}
        micEnabled={micEnabled}
        onRestore={onRestore}
        onToggleMicrophone={() => setMicEnabled(!micEnabled)}
        onClose={leaveRoom}
      />
    );
  }

  const host = room?.ownerId && typeof room.ownerId === 'object' ? room.ownerId : null;
  const isHost = String(host?._id || '') === profileId;

  return (
    <main style={{
      position: 'fixed',
      inset: 0,
      width: '100vw',
      height: '100vh',
      backgroundColor: '#090a10',
      color: '#ffffff',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'space-between',
      zIndex: 999999,
      fontFamily: 'sans-serif'
    }}>
      {/* Visual Background */}
      <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(circle at 50% 15%, #1e1b4b 0%, #08090e 80%)', zIndex: 0 }} />

      {/* Gift Animation Banner Overlay */}
      {giftAnimation && (
        <div style={{ position: 'absolute', top: '20%', left: '50%', transform: 'translateX(-50%)', backgroundColor: 'rgba(236, 72, 153, 0.9)', padding: '10px 20px', borderRadius: '9999px', zIndex: 100, display: 'flex', alignItems: 'center', gap: '8px', boxShadow: '0 0 20px #ec4899', animation: 'bounce 1s infinite' }}>
          <span>🎁</span>
          <span style={{ fontWeight: 'bold', fontSize: '12px' }}>{giftAnimation.senderName} sent {giftAnimation.giftName}!</span>
        </div>
      )}

      {/* Header */}
      <header style={{ position: 'relative', zIndex: 10, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', backgroundColor: 'rgba(0,0,0,0.5)', padding: '4px 10px', borderRadius: '9999px', border: '1px solid rgba(255,255,255,0.1)' }}>
          {host?.avatar ? (
            <img src={host.avatar} alt="" style={{ width: '32px', height: '32px', borderRadius: '50%', objectFit: 'cover' }} />
          ) : (
            <span style={{ width: '32px', height: '32px', borderRadius: '50%', backgroundColor: '#8b5cf6', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold' }}>
              {host?.username?.[0]?.toUpperCase() || 'M'}
            </span>
          )}
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{ fontSize: '11px', fontWeight: 'bold' }}>{host?.username || room?.title || 'Live Room'}</span>
            <span style={{ fontSize: '9px', color: '#9ca3af' }}>ID: {String(roomId).slice(0, 6)}</span>
          </div>

          <button onClick={() => setIsFollowed(!isFollowed)} style={{ backgroundColor: isFollowed ? '#10b981' : '#ec4899', color: '#fff', border: 'none', borderRadius: '9999px', padding: '3px 8px', fontSize: '10px', cursor: 'pointer', marginLeft: '4px', fontWeight: 'bold' }}>
            {isFollowed ? '✓' : '+ Follow'}
          </button>
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

      {/* 25 Voice Seats Grid (5 Columns x 5 Rows) */}
      <section style={{ position: 'relative', zIndex: 5, flex: 1, width: '100%', maxWidth: '480px', margin: '0 auto', padding: '8px 12px', overflowY: 'auto' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '12px 6px', justifyItems: 'center' }}>
          {roomSeats.map((seat, seatIndex) => {
            const isHostSeat = seatIndex === 0;
            const seatedUser = seat.userId && typeof seat.userId === 'object' ? seat.userId : null;

            return (
              <div key={seatIndex} onClick={() => changeSeat(seat)} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', cursor: 'pointer' }}>
                <div style={{
                  position: 'relative',
                  width: isHostSeat ? '50px' : '40px',
                  height: isHostSeat ? '50px' : '40px',
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: seatedUser ? '#1f2937' : 'rgba(255, 255, 255, 0.08)',
                  border: isHostSeat ? '2px solid #f59e0b' : seatedUser ? '2px solid #3b82f6' : '1px solid rgba(255, 255, 255, 0.15)',
                }}>
                  {seatedUser ? (
                    <img src={seatedUser.avatar || "/default-avatar.png"} alt="" style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} />
                  ) : (
                    isHostSeat ? <Crown size={20} color="#f59e0b" /> : <Armchair size={15} color="rgba(255, 255, 255, 0.4)" />
                  )}

                  {isHostSeat && (
                    <span style={{ position: 'absolute', top: '-8px', fontSize: '8px', backgroundColor: '#f59e0b', color: '#000', padding: '1px 4px', borderRadius: '4px', fontWeight: 'bold' }}>HOST</span>
                  )}
                </div>

                <span style={{ fontSize: '9px', color: 'rgba(255, 255, 255, 0.8)', marginTop: '3px', textAlign: 'center', width: '48px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {seatedUser ? seatedUser.username : (isHostSeat ? 'Host' : seatIndex + 1)}
                </span>
              </div>
            );
          })}
        </div>

        {/* Dynamic Notice & Real-time Chat Cards */}
        <div style={{ marginTop: '12px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <div style={{ backgroundColor: 'rgba(0, 0, 0, 0.4)', backdropFilter: 'blur(8px)', padding: '6px 10px', borderRadius: '10px', border: '1px solid rgba(255, 255, 255, 0.1)' }}>
            <span style={{ color: '#f59e0b', fontWeight: 'bold', fontSize: '10px' }}>🔔 System</span>
            <p style={{ color: '#d1d5db', margin: '2px 0 0 0', fontSize: '9px' }}>Please protect your privacy and stay safe.</p>
          </div>

          <div style={{ backgroundColor: 'rgba(0, 0, 0, 0.4)', backdropFilter: 'blur(8px)', padding: '6px 10px', borderRadius: '10px', border: '1px solid rgba(255, 255, 255, 0.1)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <span style={{ color: '#f59e0b', fontWeight: 'bold', fontSize: '10px' }}>📣 Announcement</span>
              <p style={{ color: '#fff', margin: '2px 0 0 0', fontSize: '10px' }}>{room?.notice || 'Welcome to our room!'}</p>
            </div>
            {isHost && (
              <button onClick={() => setAnnouncementModal(true)} style={{ backgroundColor: 'transparent', border: 'none', color: '#ec4899', cursor: 'pointer' }}>
                <Edit3 size={14} />
              </button>
            )}
          </div>

          {/* Real-time Socket Chat Stream */}
          <div style={{ maxHeight: '75px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '10px' }}>
            {messages.slice(-5).map((msg) => (
              <div key={msg.id} style={{ color: '#fff', backgroundColor: 'rgba(0,0,0,0.3)', padding: '4px 8px', borderRadius: '6px', width: 'fit-content' }}>
                <span style={{ fontWeight: 'bold', color: '#f472b6' }}>{msg.username}:</span> {msg.text}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer Controls */}
      <footer style={{ position: 'relative', zIndex: 10, padding: '8px 12px', backgroundColor: 'rgba(0, 0, 0, 0.85)', backdropFilter: 'blur(10px)', display: 'flex', alignItems: 'center', gap: '8px' }}>
        <form onSubmit={sendChatMessage} style={{ flex: 1, display: 'flex', alignItems: 'center' }}>
          <input
            type="text"
            placeholder="Say Hello..."
            value={chatDraft}
            onChange={(e) => setChatDraft(e.target.value)}
            style={{ flex: 1, backgroundColor: 'rgba(255, 255, 255, 0.1)', border: 'none', borderRadius: '9999px', padding: '8px 12px', color: '#fff', fontSize: '11px', outline: 'none' }}
          />
        </form>

        <button onClick={() => setMicEnabled(!micEnabled)} style={{ backgroundColor: 'rgba(255, 255, 255, 0.1)', border: 'none', padding: '8px', borderRadius: '50%', color: '#fff', cursor: 'pointer' }}>
          {micEnabled ? <Mic size={15} /> : <MicOff size={15} color="#f87171" />}
        </button>

        <button onClick={() => setMenuOpen(true)} style={{ backgroundColor: 'rgba(255, 255, 255, 0.1)', border: 'none', padding: '8px', borderRadius: '50%', color: '#fff', cursor: 'pointer' }}>
          <Grid size={15} />
        </button>

        <button onClick={() => setGiftsOpen(true)} style={{ background: 'linear-gradient(135deg, #a855f7, #ec4899)', border: 'none', padding: '8px', borderRadius: '50%', color: '#fff', cursor: 'pointer' }}>
          <Gift size={15} />
        </button>
      </footer>

      {/* Room Menu Sheet */}
      {menuOpen && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.75)', zIndex: 9999999, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
          <div style={{ backgroundColor: '#161722', padding: '16px', borderTopLeftRadius: '20px', borderTopRightRadius: '20px', color: '#fff' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <span style={{ fontWeight: 'bold', fontSize: '14px' }}>Room Tools & Settings</span>
              <X size={18} style={{ cursor: 'pointer' }} onClick={() => setMenuOpen(false)} />
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.05)', padding: '10px', borderRadius: '10px', marginBottom: '10px' }}>
              <span style={{ fontSize: '12px' }}>Mic Mode</span>
              <button onClick={toggleMicMode} style={{ backgroundColor: '#a855f7', color: '#fff', border: 'none', padding: '4px 10px', borderRadius: '9999px', fontSize: '10px', cursor: 'pointer' }}>
                {micMode === 'free' ? 'Free Mic' : 'Apply Mic'}
              </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px' }}>
              <div onClick={handleCloseAllMics} style={{ backgroundColor: 'rgba(255,255,255,0.05)', padding: '10px', borderRadius: '10px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', cursor: 'pointer' }}>
                <VolumeX size={18} color="#f87171" />
                <span style={{ fontSize: '10px' }}>Close All Mic</span>
              </div>
              <div onClick={() => setPasswordModal(true)} style={{ backgroundColor: 'rgba(255,255,255,0.05)', padding: '10px', borderRadius: '10px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', cursor: 'pointer' }}>
                <Lock size={18} color="#f59e0b" />
                <span style={{ fontSize: '10px' }}>Set Password</span>
              </div>
              <div style={{ backgroundColor: 'rgba(255,255,255,0.05)', padding: '10px', borderRadius: '10px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', cursor: 'pointer' }}>
                <Shield size={18} color="#3b82f6" />
                <span style={{ fontSize: '10px' }}>Room Admin</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit Announcement Modal */}
      {announcementModal && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.8)', zIndex: 99999999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
          <div style={{ backgroundColor: '#181924', padding: '16px', borderRadius: '16px', width: '100%', maxWidth: '360px' }}>
            <span style={{ fontWeight: 'bold', fontSize: '13px' }}>Edit Announcement</span>
            <textarea
              rows={3}
              value={announcementDraft}
              onChange={(e) => setAnnouncementDraft(e.target.value)}
              style={{ width: '100%', marginTop: '10px', backgroundColor: 'rgba(255,255,255,0.08)', border: 'none', borderRadius: '8px', color: '#fff', padding: '8px', fontSize: '11px', outline: 'none' }}
            />
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '12px' }}>
              <button onClick={() => setAnnouncementModal(false)} style={{ backgroundColor: 'transparent', color: '#aaa', border: 'none', cursor: 'pointer', fontSize: '11px' }}>Cancel</button>
              <button onClick={handleSaveNotice} style={{ backgroundColor: '#ec4899', color: '#fff', border: 'none', padding: '6px 14px', borderRadius: '6px', fontSize: '11px', cursor: 'pointer' }}>Save</button>
            </div>
          </div>
        </div>
      )}

      {/* Gift Modal Popup */}
      {giftsOpen && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.7)', zIndex: 9999999, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
          <div style={{ backgroundColor: '#181924', padding: '16px', borderTopLeftRadius: '20px', borderTopRightRadius: '20px', maxHeight: '50vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <span style={{ fontWeight: 'bold', fontSize: '13px' }}>Send Gift 🎁</span>
              <X size={18} style={{ cursor: 'pointer' }} onClick={() => setGiftsOpen(false)} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px' }}>
              {gifts.map((g) => (
                <div key={g._id} onClick={() => handleSendGift(g._id)} style={{ backgroundColor: 'rgba(255,255,255,0.05)', padding: '8px', borderRadius: '10px', display: 'flex', flexDirection: 'column', alignItems: 'center', cursor: 'pointer' }}>
                  <span style={{ fontSize: '20px' }}>🎁</span>
                  <span style={{ fontSize: '10px', marginTop: '2px' }}>{g.name || 'Gift'}</span>
                  <span style={{ fontSize: '9px', color: '#f59e0b' }}>💎 {g.coinsPrice || 10}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </main>
  );
}