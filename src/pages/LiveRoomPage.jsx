import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, Crown, Mic, MicOff, X } from 'lucide-react';
import {
  getProfile,
  getRoom,
  leaveRoomSeat,
  takeRoomSeat,
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
  const localStreamRef = useRef(null);
  const autoJoinAttemptedRef = useRef(false);

  const profileId = String(profile?._id || profile?.id || profile?.userId || '');
  const authenticatedUserId = String(user?._id || user?.id || user?.userId || profileId);

  useEffect(() => {
    let active = true;
    getRoom(roomId)
      .then((data) => {
        if (active) setRoom(data);
      })
      .catch(() => {});
    getProfile()
      .then((data) => {
        if (active) setProfile(data);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [roomId]);

  const joinRoom = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      localStreamRef.current = stream;
      socket.auth = { token: localStorage.getItem('token') || '' };
      socket.connect();
      socket.emit('join_room', { roomId, userId: authenticatedUserId });
    } catch (err) {
      console.error('Mic access or join room error:', err);
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

  const roomSeats = useMemo(
    () =>
      Array.from({ length: 24 }, (_, seatIndex) =>
        room?.seats?.find((seat) => seat.seatIndex === seatIndex) || { seatIndex, userId: null }
      ),
    [room]
  );

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
      console.error('Error changing seat:', err);
    }
  };

  // YEROO MINIMIZED TA'U -> FLOATING PLAYER CIRCLE QOFA RENDERING GODHI
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

  return (
    <main
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: '#0f0f13',
        color: '#ffffff',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        zIndex: 9999,
        fontFamily: 'sans-serif',
      }}
    >
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: 'radial-gradient(circle at top, #2a1b4e 0%, #0f0f13 70%)',
          zIndex: 0,
        }}
      />

      {/* Header */}
      <header
        style={{
          position: 'relative',
          zIndex: 10,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '12px 16px',
          width: '100%',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            backgroundColor: 'rgba(0,0,0,0.5)',
            padding: '6px 12px',
            borderRadius: '9999px',
            border: '1px solid rgba(255,255,255,0.1)',
          }}
        >
          {host?.avatar ? (
            <img
              src={host.avatar}
              alt=""
              style={{ width: '36px', height: '36px', borderRadius: '50%', objectFit: 'cover' }}
            />
          ) : (
            <span
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '50%',
                backgroundColor: '#8b5cf6',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 'bold',
              }}
            >
              {host?.username?.[0]?.toUpperCase() || 'M'}
            </span>
          )}
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{ fontSize: '12px', fontWeight: 'bold' }}>
              {host?.username || room?.title || 'Live Room'}
            </span>
            <span style={{ fontSize: '10px', color: '#9ca3af' }}>ID: {String(roomId).slice(0, 6)}</span>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button
            onClick={onMinimize}
            style={{
              backgroundColor: 'rgba(0,0,0,0.5)',
              color: '#fff',
              border: 'none',
              padding: '8px',
              borderRadius: '50%',
              cursor: 'pointer',
            }}
          >
            <ChevronDown size={18} />
          </button>
          <button
            onClick={leaveRoom}
            style={{
              backgroundColor: '#ef4444',
              color: '#fff',
              border: 'none',
              padding: '8px',
              borderRadius: '50%',
              cursor: 'pointer',
            }}
          >
            <X size={18} />
          </button>
        </div>
      </header>

      {/* 24 Circle Seats Grid */}
      <section
        style={{
          position: 'relative',
          zIndex: 5,
          flex: 1,
          width: '100%',
          maxWidth: '480px',
          margin: '0 auto',
          padding: '12px',
          overflowY: 'auto',
        }}
      >
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(5, 1fr)',
            gap: '14px 6px',
            justifyItems: 'center',
          }}
        >
          {roomSeats.map((seat, seatIndex) => {
            const isHostSeat = seatIndex === 0;
            const seatedUser = seat.userId && typeof seat.userId === 'object' ? seat.userId : null;

            return (
              <div
                key={seatIndex}
                onClick={() => changeSeat(seat)}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  cursor: 'pointer',
                }}
              >
                <div
                  style={{
                    position: 'relative',
                    width: '46px',
                    height: '46px',
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: seatedUser ? '#1f2937' : 'rgba(255, 255, 255, .1)',
                    border: seatedUser
                      ? '2px solid #f59e0b'
                      : '1px dashed rgba(255, 255, 255, 0.3)',
                  }}
                >
                  {seatedUser ? (
                    <img
                      src={seatedUser.avatar || '/default-avatar.png'}
                      alt=""
                      style={{
                        width: '100%',
                        height: '100%',
                        borderRadius: '50%',
                        objectFit: 'cover',
                      }}
                    />
                  ) : (
                    <span style={{ color: '#d1d5db', fontSize: '12px', fontWeight: 'bold' }}>
                      {isHostSeat ? <Crown size={14} color="#f59e0b" /> : seatIndex + 1}
                    </span>
                  )}
                </div>

                {/* SINGLE TEXT LABEL ONLY */}
                <span
                  style={{
                    fontSize: '10px',
                    color: 'rgba(255, 255, 255, 0.8)',
                    marginTop: '4px',
                    textAlign: 'center',
                    width: '50px',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {seatedUser ? seatedUser.username : isHostSeat ? 'Host' : seatIndex + 1}
                </span>
              </div>
            );
          })}
        </div>
      </section>

      {/* Footer Controls */}
      <footer
        style={{
          position: 'relative',
          zIndex: 10,
          padding: '12px 16px',
          backgroundColor: 'rgba(0,0,0,0.7)',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          width: '100%',
        }}
      >
        <input
          type="text"
          placeholder="Say Hello..."
          value={chatDraft}
          onChange={(e) => setChatDraft(e.target.value)}
          style={{
            flex: 1,
            backgroundColor: 'rgba(255, 255, 255, 0.1)',
            border: 'none',
            borderRadius: '9999px',
            padding: '8px 14px',
            color: '#fff',
            fontSize: '12px',
            outline: 'none',
          }}
        />
        <button
          onClick={() => setMicEnabled(!micEnabled)}
          style={{
            backgroundColor: 'rgba(255, 255, 255, 0.1)',
            border: 'none',
            padding: '10px',
            borderRadius: '50%',
            color: '#fff',
            cursor: 'pointer',
          }}
        >
          {micEnabled ? <Mic size={16} /> : <MicOff size={16} color="#f87171" />}
        </button>
      </footer>
    </main>
  );
}