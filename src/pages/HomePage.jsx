import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { io } from 'socket.io-client';
import { createRoom, getRooms } from '../api.js';
import { Card, ErrorMessage, Field, Page } from '../components/UI.jsx';
import { API_URL } from '../config.js';

const CATEGORIES = ['Follow', 'Party', 'For You', 'Ethiopia', 'Rank'];

function RoomCreateDialog({ onClose, onCreated }) {
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('For You');
  const [banner, setBanner] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (event) => {
    event.preventDefault();
    setError('');
    setBusy(true);
    try {
      const result = await createRoom({ title, category, banner });
      const room = result?.room || result;
      if (!room?._id) throw new Error('The server did not return the created room.');
      onCreated(room);
    } catch (requestError) {
      setError(requestError.response?.data?.message || requestError.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="room-create-overlay" role="presentation" onMouseDown={(event) => {
      if (event.target === event.currentTarget && !busy) onClose();
    }}>
      <section className="card room-create-dialog" role="dialog" aria-modal="true" aria-labelledby="create-room-title">
        <div className="section-heading room-create-heading">
          <h2 id="create-room-title">Create a live room</h2>
          <button className="button button-quiet button-small" type="button" onClick={onClose} disabled={busy}>
            Close
          </button>
        </div>
        <form className="form-stack" onSubmit={submit}>
          <Field
            label="Room name"
            type="text"
            required
            maxLength={100}
            value={title}
            onChange={(event) => setTitle(event.target.value)}
          />
          <label className="field">
            <span>Category</span>
            <select value={category} onChange={(event) => setCategory(event.target.value)}>
              {CATEGORIES.map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
          </label>
          <Field
            label="Cover image URL (optional)"
            type="url"
            value={banner}
            onChange={(event) => setBanner(event.target.value)}
          />
          <ErrorMessage>{error}</ErrorMessage>
          <button className="button button-primary button-full" type="submit" disabled={busy}>
            {busy ? 'Creating room…' : 'Create Room'}
          </button>
        </form>
      </section>
    </div>
  );
}

export default function HomePage() {
  const [rooms, setRooms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showCreateDialog, setShowCreateDialog] = useState(false);
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

  const addCreatedRoom = async () => {
    setShowCreateDialog(false);
    try {
      const data = await getRooms();
      setRooms(Array.isArray(data) ? data : []);
      setError('');
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Room was created, but the live host list could not be refreshed.');
    }
  };

  return (
    <Page
      title="Good evening"
      eyebrow="YOUR LIVE COMMUNITY"
      actions={(
        <button
          className="button button-primary"
          type="button"
          onClick={() => setShowCreateDialog(true)}
        >
          Create Room
        </button>
      )}
    >
      <section className="hero-card">
        <div>
          <p className="eyebrow">YOUR NEXT CONVERSATION STARTS HERE</p>
          <h2>Find your people.<br />Join the moment.</h2>
          <p className="muted">Drop into a live room and make a new connection.</p>
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
          <button
            className="button button-primary"
            type="button"
            onClick={() => setShowCreateDialog(true)}
          >
            Create Room
          </button>
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
                  <Link className="button button-primary button-full" to={`/live/${room._id}`}>
                    Join voice room
                  </Link>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <Card className="feature-card">
        <div><p className="eyebrow">TAKE A BREAK</p><h2>Try your luck</h2><p className="muted">Play a quick round of dice.</p></div>
        <Link className="button button-secondary" to="/games/dice">Play dice <span aria-hidden="true">→</span></Link>
      </Card>

      {showCreateDialog && (
        <RoomCreateDialog
          onClose={() => setShowCreateDialog(false)}
          onCreated={addCreatedRoom}
        />
      )}
    </Page>
  );
}
