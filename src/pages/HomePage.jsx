import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Mic, X } from 'lucide-react';
import { io } from 'socket.io-client';
import { getRooms } from '../api.js';
import { Card, Page } from '../components/UI.jsx';
import { API_URL } from '../config.js';
import { useAuth } from '../../context/AuthContext.jsx';

export default function HomePage() {
  const { user, updateRoomStatus } = useAuth();
  const navigate = useNavigate();
  const [rooms, setRooms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showHostApplication, setShowHostApplication] = useState(false);
  const ownRoomId = user?.roomId ? String(user.roomId) : '';
  const ownRoom = ownRoomId ? {
    ...(user.room || {}),
    _id: ownRoomId,
    title: user.room?.title || user.roomName || 'My Live Room',
    isLive: typeof user.room?.isLive === 'boolean'
      ? user.room.isLive
      : user.roomStatus === 'live',
    host: user.room?.host || (
      user.room?.ownerId && typeof user.room.ownerId === 'object'
        ? user.room.ownerId
        : null
    ) || {
      username: user.username,
      avatar: user.avatar || user.profilePicture,
    },
  } : null;

  useEffect(() => {
    let active = true;
    const roomStatusSocket = io(API_URL, {
      auth: { token: localStorage.getItem('token') || '' },
    });
    const applyRoomStatus = ({ roomId, isLive } = {}) => {
      if (!roomId) return;
      const live = isLive === true || String(isLive || '').toLowerCase() === 'live';
      setRooms((current) => current.map((room) =>
        String(room._id || room.id) === String(roomId) ? { ...room, isLive: live } : room,
      ));
    };
    const onRoomStatusChanged = (payload = {}) => {
      const { roomId, isLive } = payload;
      if (!roomId) return;
      updateRoomStatus(roomId, isLive === true || String(isLive || '').toLowerCase() === 'live');
      applyRoomStatus(payload);
    };
    const onRoomUpdated = (event) => {
      const room = event.detail;
      if (!room?._id) return;
      setRooms((current) => current.map((item) =>
        String(item._id || item.id) === String(room._id) ? { ...item, ...room } : item,
      ));
    };
    const onLocalRoomStatusChanged = (event) => applyRoomStatus(event.detail);

    roomStatusSocket.on('room-status-changed', onRoomStatusChanged);
    window.addEventListener('mesolive-room-updated', onRoomUpdated);
    window.addEventListener('mesolive-room-status-changed', onLocalRoomStatusChanged);
    getRooms()
      .then((data) => {
        if (active) {
          setRooms(Array.isArray(data) ? data : []);
        }
      })
      .catch((requestError) => {
        if (active) {
          setError(requestError.response?.data?.message || 'Could not load live rooms. Please try again.');
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
      roomStatusSocket.off('room-status-changed', onRoomStatusChanged);
      window.removeEventListener('mesolive-room-updated', onRoomUpdated);
      window.removeEventListener('mesolive-room-status-changed', onLocalRoomStatusChanged);
      roomStatusSocket.disconnect();
    };
  }, [updateRoomStatus]);

  const openGoLive = () => {
    if (user?.role === 'HOST') {
      if (ownRoomId) {
        navigate(`/live/${encodeURIComponent(ownRoomId)}`);
      } else {
        navigate('/profile');
      }
      return;
    }
    setShowHostApplication(true);
  };

  const otherRooms = rooms.filter((room) => String(room._id || room.id) !== ownRoomId);

  const renderRoomCard = (room, pinned = false) => {
    const roomId = String(room._id || room.id);
    const host = room.host || room.ownerId || {};
    const roomName = room.title || room.name || 'Live room';
    const live = room.isLive === true || String(room.status || '').toLowerCase() === 'live';
    const cover = room.cover || room.banner;
    return (
      <Card key={roomId} className={`room-card${pinned ? ' is-pinned-room' : ''}`}>
        {cover ? (
          <img className="room-art room-cover" src={cover} alt="" />
        ) : (
          <div className="room-art room-art-placeholder" aria-hidden="true">
            {roomName.slice(0, 1).toUpperCase()}
          </div>
        )}
        <div className="room-copy">
          {host?.avatar || host?.profilePicture ? (
            <img className="avatar room-host-avatar" src={host.avatar || host.profilePicture} alt="" />
          ) : (
            <div className="avatar room-host-avatar room-host-avatar-fallback" aria-label={host?.username || 'Host'}>
              {host?.username ? host.username.slice(0, 1).toUpperCase() : '?'}
            </div>
          )}
          <p className="muted room-host">HOSTED BY {host?.username || 'Unknown host'}</p>
          <h3>{roomName}</h3>
          <p className="room-card-status">
            <span className={`room-status-badge ${live ? 'is-live' : 'is-offline'}`}>
              {live ? 'LIVE' : 'OFFLINE'}
            </span>
            {room.category && ` · ${room.category}`}
            {` · ${Number(room.membersCount) || 0} listening`}
          </p>
          <Link className="button button-primary button-full" to={`/live/${encodeURIComponent(roomId)}`}>
            {pinned && !live ? 'Go Live' : pinned ? 'Join Room' : 'Join voice room'}
          </Link>
        </div>
      </Card>
    );
  };

  return (
    <Page
      title="Good evening"
      eyebrow="YOUR LIVE COMMUNITY"
    >
      <section className="hero-card">
        <div>
          <p className="eyebrow">{ownRoomId ? 'YOUR LIVE ROOM IS READY' : 'YOUR NEXT CONVERSATION STARTS HERE'}</p>
          <h2>{ownRoomId ? <>Your room.<br />Your community.</> : <>Find your people.<br />Join the moment.</>}</h2>
          <p className="muted">{ownRoomId ? 'Jump back in and reconnect with your listeners.' : 'Drop into a live room and make a new connection.'}</p>
          {ownRoomId && (
            <Link className="button button-primary home-own-room" to={`/live/${encodeURIComponent(ownRoomId)}`}>
              🎙️ Enter My Room
            </Link>
          )}
        </div>
        <span className="hero-art" aria-hidden="true">🎙️</span>
      </section>

      <div className="section-heading">
        <div><p className="eyebrow">HAPPENING NOW</p><h2>Live rooms</h2></div>
        <span className="live-pill"><i /> LIVE</span>
      </div>

      {ownRoom && <div className="room-grid home-pinned-room">{renderRoomCard(ownRoom, true)}</div>}

      {loading && (
        <div className="rooms-loading" role="status" aria-label="Loading live rooms">
          <span className="loading-spinner" />
          <span className="muted">Loading live rooms…</span>
        </div>
      )}

      {!loading && error && <div className="notice-error" role="alert">{error}</div>}

      {!loading && !error && otherRooms.length === 0 && !ownRoom && (
        <Card className="rooms-empty-state">
          <p>No live hosts yet</p>
          <Link className="button button-secondary" to="/profile">Visit your profile</Link>
        </Card>
      )}

      {!loading && !error && otherRooms.length > 0 && (
        <div className="room-grid">
          {otherRooms.map((room) => renderRoomCard(room))}
        </div>
      )}

      <Card className="feature-card">
        <div><p className="eyebrow">TAKE A BREAK</p><h2>Try your luck</h2><p className="muted">Play a quick round in a live room.</p></div>
        <Link className="button button-secondary" to="/games/dice">Open Game Center <span aria-hidden="true">→</span></Link>
      </Card>

      <button className="home-go-live-fab" type="button" onClick={openGoLive}>
        <Mic size={21} aria-hidden="true" />
        <span>Go Live</span>
      </button>

      {showHostApplication && (
        <div className="room-modal-overlay" role="presentation" onMouseDown={(event) => {
          if (event.target === event.currentTarget) setShowHostApplication(false);
        }}>
          <section className="card host-application-dialog" role="dialog" aria-modal="true" aria-labelledby="host-application-title">
            <button
              className="button button-quiet button-small host-application-close"
              type="button"
              onClick={() => setShowHostApplication(false)}
              aria-label="Close host application dialog"
            >
              <X size={18} />
            </button>
            <p className="eyebrow">BECOME A MESO LIVE HOST</p>
            <h2 id="host-application-title">Ready to host a room?</h2>
            <p className="muted">
              Host access must be enabled for your account before you can create a room. Visit your profile for account options.
            </p>
            <div className="host-application-actions">
              <button className="button button-secondary" type="button" onClick={() => setShowHostApplication(false)}>
                Maybe later
              </button>
              <Link className="button button-primary" to="/profile" onClick={() => setShowHostApplication(false)}>
                View Profile
              </Link>
            </div>
          </section>
        </div>
      )}

    </Page>
  );
}
