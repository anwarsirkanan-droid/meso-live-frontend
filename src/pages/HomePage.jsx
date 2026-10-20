import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { io } from 'socket.io-client';
import { getRooms } from '../api.js';
import { Card, Page } from '../components/UI.jsx';
import { API_URL } from '../config.js';
import { useAuth } from '../../context/AuthContext.jsx';

export default function HomePage() {
  const { user } = useAuth();
  const [rooms, setRooms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const inactiveRoomIds = useRef(new Set());

  useEffect(() => {
    let active = true;
    const roomStatusSocket = io(API_URL, {
      auth: { token: localStorage.getItem('token') || '' },
    });
    const refreshRooms = () => {
      getRooms()
        .then((data) => {
          if (active) {
            const activeRooms = Array.isArray(data)
              ? data.filter((room) => !inactiveRoomIds.current.has(String(room._id)))
              : [];
            setRooms(activeRooms);
            setError('');
          }
        })
        .catch((requestError) => {
          if (active) {
            setError(requestError.response?.data?.message || 'Could not refresh live rooms. Please try again.');
          }
        });
    };
    const onRoomStatusChanged = ({ roomId, isLive } = {}) => {
      if (!roomId) return;
      if (isLive === false) {
        inactiveRoomIds.current.add(String(roomId));
        setRooms((current) => current.filter((room) => String(room._id) !== String(roomId)));
        return;
      }
      if (isLive === true) {
        inactiveRoomIds.current.delete(String(roomId));
        refreshRooms();
      }
    };

    roomStatusSocket.on('room-status-changed', onRoomStatusChanged);
    getRooms()
      .then((data) => {
        if (active) {
          setRooms(Array.isArray(data)
            ? data.filter((room) => !inactiveRoomIds.current.has(String(room._id)))
            : []);
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
      roomStatusSocket.disconnect();
    };
  }, []);

  const ownRoomId = user?.hasActiveRoom && user?.roomId ? String(user.roomId) : '';

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

      {loading && (
        <div className="rooms-loading" role="status" aria-label="Loading live rooms">
          <span className="loading-spinner" />
          <span className="muted">Loading live rooms…</span>
        </div>
      )}

      {!loading && error && <div className="notice-error" role="alert">{error}</div>}

      {!loading && !error && rooms.length === 0 && (
        <Card className="rooms-empty-state">
          <p>No live hosts yet</p>
          <Link className="button button-secondary" to="/profile">Visit your profile</Link>
        </Card>
      )}

      {!loading && !error && rooms.length > 0 && (
        <div className="room-grid">
          {rooms.map((room) => {
            const roomName = room.title;
            const host = room.host;
            const cover = room.cover;
            const memberCount = room.membersCount;
            return (
              <Card key={room._id} className="room-card">
                {cover ? (
                  <img className="room-art room-cover" src={cover} alt="" />
                ) : (
                  <div className="room-art room-art-placeholder" aria-hidden="true">
                    {roomName.slice(0, 1).toUpperCase()}
                  </div>
                )}
                <div className="room-copy">
                  {host?.avatar ? (
                    <img className="avatar room-host-avatar" src={host.avatar} alt="" />
                  ) : (
                    <div className="avatar room-host-avatar room-host-avatar-fallback" aria-label={host?.username || 'Host'}>
                      {host?.username ? host.username.slice(0, 1).toUpperCase() : '?'}
                    </div>
                  )}
                  <p className="muted room-host">HOSTED BY {host?.username || 'Unknown host'}</p>
                  <h3>{roomName}</h3>
                  <p className="muted">
                    {room.category} · {memberCount} listening · {room.isLive ? 'Live' : 'Offline'}
                  </p>
                  <Link className="button button-primary button-full" to={`/live/${encodeURIComponent(room._id)}`}>
                    {String(room._id) === ownRoomId ? 'Go to Room' : 'Join voice room'}
                  </Link>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <Card className="feature-card">
        <div><p className="eyebrow">TAKE A BREAK</p><h2>Try your luck</h2><p className="muted">Play a quick round in a live room.</p></div>
        <Link className="button button-secondary" to="/games/dice">Open Game Center <span aria-hidden="true">→</span></Link>
      </Card>

    </Page>
  );
}
