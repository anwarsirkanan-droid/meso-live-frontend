import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, Crown, Gift, Mic, MicOff, Armchair, Gamepad2, X, Volume2, VolumeX } from 'lucide-react';
import {
  getProfile,
  getRoom,
  leaveRoomSeat,
  sendGift,
  takeRoomSeat,
  getGiftCatalog,
} from '../api.js';
import { useAuth } from '../../context/AuthContext.jsx';
import FloatingPlayer from '../components/FloatingPlayer.jsx';
import socket from '../socket.js';

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
  const [gifts, setGifts] = useState([]);
  const [isFollowed, setIsFollowed] = useState(false);
  const localStreamRef = useRef(null);
  const autoJoinAttemptedRef = useRef(false);

  const profileId = String(profile?._id || profile?.id || profile?.userId || '');
  const authenticatedUserId = String(user?._id || user?.id || user?.userId || profileId);

  useEffect(() => {
    let active = true;
    getRoom(roomId).then((data) => { if (active) setRoom(data); }).catch(() => {});
    getProfile().then((data) => { if (active) setProfile(data); }).catch(() => {});
    getGiftCatalog().then((data) => { if (active && Array.isArray(data)) setGifts(data); }).catch(() => {});
    return () => { active = false; };
  }, [roomId]);

  const joinRoom = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      localStreamRef.current = stream;
      socket.auth = { token: localStorage.getItem('token') || '' };
      socket.connect();
      socket.emit('join_room', { roomId, userId: authenticatedUserId });
    } catch (err) {
      console.error("Mic/Join Error:", err);
    }
  };

  useEffect(() => {
    if (!room || !profile || autoJoinAttemptedRef.current) return;
    autoJoinAttemptedRef.current = true;
    void joinRoom();
  }, [room, profile]);

  const leaveRoom = () => {
    if (socket.connected) socket.emit('leave-room', roomId);
    socket.disconnect();
    localStreamRef.current?.getTracks().forEach((track) => track.stop());
    onClose();
  };

  const roomSeats = useMemo(() => Array.from({ length: 24 }, (_, seatIndex) =>
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
      console.error("Change Seat Error:", err);
    }
  };

  const handleFollow = () => {
    setIsFollowed(!isFollowed);
    socket.emit('user_follow', { targetUserId: room?.ownerId?._id, roomId });
  };

  const handleSendGift = async (giftId) => {
    try {
      await sendGift({ roomId, receiverId: room?.ownerId?._id, giftId, quantity: 1 });
      setGiftsOpen(false);
    } catch (err) {
      console.error("Gift Error:", err);
    }
  };

  const sendChatMessage = (e) => {
    e.preventDefault();
    if (!chatDraft.trim()) return;
    setMessages((prev) => [...prev, { id: Date.now(), username: profile?.username || 'You', text: chatDraft }]);
    setChatDraft('');
  };

  // 1. FLOATING CIRCLE PLAYER (YEROO MINIMIZED TA'U)
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

  // 2. FULL ROOM VIEW
  return (
    <main style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
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
      {/* Background Gradient */}
      <div style={{
        position: 'absolute',
        inset: 0,
        background: 'radial-gradient(circle at 50% 15%, #1e1b4b 0%, #08090e 80%)',
        zIndex: 0
      }} />

      {/* Room Header */}
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
          backgroundColor: 'rgba(0,0,0,0.5)',
          padding: '4px 10px',
          borderRadius: '9999px',
          border: '1px solid rgba(255,255,255,0.1)'
        }}>
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

          <button onClick={handleFollow} style={{
            backgroundColor: isFollowed ? '#10b981' : '#ec4899',
            color: '#fff',
            border: 'none',
            borderRadius: '9999px',
            padding: '3px 8px',
            fontSize: '10px',
            cursor: 'pointer',
            marginLeft: '4px',
            fontWeight: 'bold'
          }}>
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

      {/* 24 Voice Seats Grid (Poppo / BoloUp Style) */}
      <section style={{ position: 'relative', zIndex: 5, flex: 1, width: '100%', maxWidth: '480px', margin: '0 auto', padding: '12px', overflowY: 'auto' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '16px 8px', justifyItems: 'center' }}>
          {roomSeats.map((seat, seatIndex) => {
            const isHostSeat = seatIndex === 0;
            const seatedUser = seat.userId && typeof seat.userId === 'object' ? seat.userId : null;

            return (
              <div key={seatIndex} onClick={() => changeSeat(seat)} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', cursor: 'pointer' }}>
                <div style={{
                  position: 'relative',
                  width: isHostSeat ? '54px' : '44px',
                  height: isHostSeat ? '54px' : '44px',
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: seatedUser ? '#1f2937' : 'rgba(255, 255, 255, 0.08)',
                  border: isHostSeat 
                    ? '2px solid #f59e0b' 
                    : seatedUser ? '2px solid #3b82f6' : '1px solid rgba(255, 255, 255, 0.15)',
                  boxShadow: isHostSeat ? '0 0 12px rgba(245, 158, 11, 0.4)' : 'none'
                }}>
                  {seatedUser ? (
                    <img src={seatedUser.avatar || "/default-avatar.png"} alt="" style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} />
                  ) : (
                    /* ICON INSIDE CIRCLE ONLY (No duplicate text numbers inside) */
                    isHostSeat ? (
                      <Crown size={22} color="#f59e0b" />
                    ) : (
                      <Armchair size={18} color="rgba(255, 255, 255, 0.4)" />
                    )
                  )}

                  {isHostSeat && (
                    <span style={{ position: 'absolute', top: '-8px', fontSize: '9px', backgroundColor: '#f59e0b', color: '#000', padding: '1px 4px', borderRadius: '4px', fontWeight: 'bold' }}>HOST</span>
                  )}
                </div>

                {/* SINGLE TEXT LABEL UNDERNEATH */}
                <span style={{ fontSize: '10px', color: 'rgba(255, 255, 255, 0.8)', marginTop: '4px', textAlign: 'center', width: '52px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {seatedUser ? seatedUser.username : (isHostSeat ? 'Host' : seatIndex + 1)}
                </span>
              </div>
            );
          })}
        </div>

        {/* Floating Chat Message Stream */}
        <div style={{ marginTop: '20px', maxHeight: '110px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '4px', backgroundColor: 'rgba(0,0,0,0.3)', padding: '8px 12px', borderRadius: '12px', fontSize: '11px' }}>
          {messages.slice(-5).map((msg) => (
            <div key={msg.id} style={{ color: '#fff' }}>
              <span style={{ fontWeight: 'bold', color: '#f472b6' }}>{msg.username}:</span> {msg.text}
            </div>
          ))}
        </div>
      </section>

      {/* Footer Controls: Chat, Mic, Game, Gift */}
      <footer style={{
        position: 'relative',
        zIndex: 10,
        padding: '12px 16px',
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        backdropFilter: 'blur(10px)',
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        width: '100%'
      }}>
        <form onSubmit={sendChatMessage} style={{ flex: 1, display: 'flex', alignItems: 'center' }}>
          <input
            type="text"
            placeholder="Say Hello..."
            value={chatDraft}
            onChange={(e) => setChatDraft(e.target.value)}
            style={{ flex: 1, backgroundColor: 'rgba(255, 255, 255, 0.1)', border: 'none', borderRadius: '9999px', padding: '8px 14px', color: '#fff', fontSize: '12px', outline: 'none' }}
          />
        </form>

        <button onClick={() => setMicEnabled(!micEnabled)} style={{ backgroundColor: 'rgba(255, 255, 255, 0.1)', border: 'none', padding: '10px', borderRadius: '50%', color: '#fff', cursor: 'pointer' }}>
          {micEnabled ? <Mic size={16} /> : <MicOff size={16} color="#f87171" />}
        </button>

        <button onClick={() => alert('Mini Games Center')} style={{ backgroundColor: 'rgba(255, 255, 255, 0.1)', border: 'none', padding: '10px', borderRadius: '50%', color: '#f59e0b', cursor: 'pointer' }}>
          <Gamepad2 size={16} />
        </button>

        <button onClick={() => setGiftsOpen(true)} style={{ background: 'linear-gradient(135deg, #a855f7, #ec4899)', border: 'none', padding: '10px', borderRadius: '50%', color: '#fff', cursor: 'pointer' }}>
          <Gift size={16} />
        </button>
      </footer>

      {/* Gift Modal Popup */}
      {giftsOpen && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.7)', zIndex: 9999999, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
          <div style={{ backgroundColor: '#181924', padding: '16px', borderTopLeftRadius: '20px', borderTopRightRadius: '20px', maxHeight: '50vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <span style={{ fontWeight: 'bold', fontSize: '14px' }}>Send Gift 🎁</span>
              <X size={18} style={{ cursor: 'pointer' }} onClick={() => setGiftsOpen(false)} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px' }}>
              {gifts.map((g) => (
                <div key={g._id} onClick={() => handleSendGift(g._id)} style={{ backgroundColor: 'rgba(255,255,255,0.05)', padding: '10px', borderRadius: '12px', display: 'flex', flexDirection: 'column', alignItems: 'center', cursor: 'pointer' }}>
                  <span style={{ fontSize: '24px' }}>🎁</span>
                  <span style={{ fontSize: '11px', marginTop: '4px' }}>{g.name || 'Gift'}</span>
                  <span style={{ fontSize: '10px', color: '#f59e0b' }}>💎 {g.coinsPrice || 10}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </main>
  );
}