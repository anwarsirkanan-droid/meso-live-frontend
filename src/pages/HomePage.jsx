import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Mic, X } from 'lucide-react';
import { io } from 'socket.io-client';
import { getRoom, getRooms } from '../api.js';
import { Card, Page } from '../components/UI.jsx';
import { API_URL } from '../config.js';
import { useAuth } from '../../context/AuthContext.jsx';

const COUNTRY_FLAGS = {
  Australia: '🇦🇺',
  Brazil: '🇧🇷',
  Canada: '🇨🇦',
  China: '🇨🇳',
  Egypt: '🇪🇬',
  Ethiopia: '🇪🇹',
  France: '🇫🇷',
  Germany: '🇩🇪',
  Ghana: '🇬🇭',
  India: '🇮🇳',
  Indonesia: '🇮🇩',
  Ireland: '🇮🇪',
  Italy: '🇮🇹',
  Japan: '🇯🇵',
  Kenya: '🇰🇪',
  Mexico: '🇲🇽',
  Netherlands: '🇳🇱',
  'New Zealand': '🇳🇿',
  Nigeria: '🇳🇬',
  Pakistan: '🇵🇰',
  Philippines: '🇵🇭',
  Rwanda: '🇷🇼',
  'Saudi Arabia': '🇸🇦',
  'South Africa': '🇿🇦',
  'South Korea': '🇰🇷',
  Spain: '🇪🇸',
  Sweden: '🇸🇪',
  Turkey: '🇹🇷',
  Uganda: '🇺🇬',
  'United Arab Emirates': '🇦🇪',
  'United Kingdom': '🇬🇧',
  'United States': '🇺🇸',
};

function roomIdOf(room) {
  return String(room?._id || room?.id || '');
}

function isRoomLive(room) {
  return room?.isLive === true || String(room?.status || '').toLowerCase() === 'live';
}

function countryFlag(country) {
  if (!country) return '🌐';
  if (COUNTRY_FLAGS[country]) return COUNTRY_FLAGS[country];
  if (/^[A-Z]{2}$/i.test(country)) {
    const code = country.toUpperCase();
    return String.fromCodePoint(...[...code].map((letter) => 127397 + letter.charCodeAt(0)));
  }
  return COUNTRY_FLAGS[country] || '🌐';
}

function roomTags(room) {
  const fromList = Array.isArray(room?.tags) ? room.tags : Array.isArray(room?.categories) ? room.categories : [];
  if (fromList.length) return fromList.map((tag) => String(tag).trim()).filter(Boolean);
  return String(room?.category || '')
    .split(/[,/|]/)
    .map((tag) => tag.trim())
    .filter(Boolean);
}

function occupantList(room) {
  const fromSeats = (room?.seats || []).flatMap((seat) => {
    const person = seat?.userId && typeof seat.userId === 'object' ? seat.userId : null;
    return person ? [person] : [];
  });
  const extras = (room?.occupants || room?.members || []).filter((person) => person && typeof person === 'object');
  const seen = new Set();
  return [...fromSeats, ...extras].filter((person) => {
    const key = String(person._id || person.id || person.username || '');
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function avatarUrl(person) {
  return person?.avatar || person?.profilePicture || '';
}

export default function HomePage() {
  const { user, updateRoom, updateRoomStatus } = useAuth();
  const navigate = useNavigate();
  const [rooms, setRooms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showHostApplication, setShowHostApplication] = useState(false);
  const ownRoomId = user?.roomId ? String(user.roomId) : '';

  const ownRoom = useMemo(() => {
    if (!ownRoomId) {
      return {
        _id: 'default-host-room',
        title: 'My Host Room',
        category: 'Chat',
        country: user?.country,
        isLive: false,
        isDefaultHostRoom: true,
        host: { username: user?.username, avatar: user?.avatar || user?.profilePicture, country: user?.country },
      };
    }
    const host = user.room?.host || (
      user.room?.ownerId && typeof user.room.ownerId === 'object' ? user.room.ownerId : null
    ) || {
      username: user.username,
      avatar: user.avatar || user.profilePicture,
      country: user.country,
    };
    return {
      ...(user.room || {}),
      _id: ownRoomId,
      title: user.room?.title || user.roomName || 'My Live Room',
      category: user.room?.category,
      tags: user.room?.tags,
      country: user.room?.country || host.country || user.country,
      seats: user.room?.seats,
      membersCount: user.room?.membersCount,
      isLive: typeof user.room?.isLive === 'boolean'
        ? user.room.isLive
        : user.roomStatus === 'live',
      host,
    };
  }, [ownRoomId, user]);

  useEffect(() => {
    let active = true;
    const roomStatusSocket = io(API_URL, {
      auth: { token: localStorage.getItem('token') || '' },
    });
    const applyRoomStatus = ({ roomId, isLive } = {}) => {
      if (!roomId) return;
      const live = isLive === true || String(isLive || '').toLowerCase() === 'live';
      setRooms((current) => current.map((room) =>
        roomIdOf(room) === String(roomId) ? { ...room, isLive: live } : room,
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
      setRooms((current) => {
        const id = String(room._id);
        const exists = current.some((item) => roomIdOf(item) === id);
        if (!exists && id === ownRoomId) return [room, ...current];
        return current.map((item) => roomIdOf(item) === id ? { ...item, ...room } : item);
      });
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
  }, [ownRoomId, updateRoomStatus]);

  useEffect(() => {
    if (!ownRoomId) return undefined;
    let active = true;
    getRoom(ownRoomId)
      .then((data) => {
        if (!active || !data) return;
        const nextRoom = { ...data };
        delete nextRoom.isLive;
        delete nextRoom.status;
        updateRoom(nextRoom);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [ownRoomId, updateRoom]);

  const displayedRooms = useMemo(() => {
    const others = rooms.filter((room) => roomIdOf(room) !== ownRoomId);
    if (!ownRoom) return others;
    const fromApi = rooms.find((room) => roomIdOf(room) === ownRoomId);
    return [{
      ...fromApi,
      ...ownRoom,
      membersCount: fromApi?.membersCount ?? ownRoom.membersCount,
      seats: fromApi?.seats || ownRoom.seats,
      tags: ownRoom.tags || fromApi?.tags,
      country: ownRoom.country || fromApi?.country,
      isLive: ownRoom.isLive,
    }, ...others];
  }, [ownRoom, ownRoomId, rooms]);

  const openGoLive = () => {
    if (user?.isHost === true || user?.role === 'HOST') {
      if (ownRoomId) {
        navigate(`/live/${encodeURIComponent(ownRoomId)}`);
      } else {
        navigate('/profile');
      }
      return;
    }
    setShowHostApplication(true);
  };

  const renderRoomCard = (room, pinned = false) => {
    const roomId = roomIdOf(room);
    const host = room.host || room.ownerId || {};
    const roomName = room.title || room.name || 'Live room';
    const live = isRoomLive(room);
    const hostAvatar = avatarUrl(host);
    const occupants = occupantList(room).slice(0, 5);
    const extraOccupants = Math.max(0, occupantList(room).length - occupants.length);
    const tags = roomTags(room);
    const listeners = Number(room.membersCount) || occupants.length;
    const flag = countryFlag(room.country || host.country);

    return (
      <Card key={roomId} className={`room-card${pinned ? ' is-pinned-room' : ''}${live ? ' is-live' : ''}`}>
        {hostAvatar ? (
          <img className="avatar room-card-avatar" src={hostAvatar} alt="" />
        ) : (
          <div className="avatar room-card-avatar room-host-avatar-fallback" aria-label={host?.username || 'Host'}>
            {host?.username ? host.username.slice(0, 1).toUpperCase() : roomName.slice(0, 1).toUpperCase()}
          </div>
        )}
        <div className="room-card-main">
          <div className="room-card-title-row">
            <span className="room-card-flag" aria-hidden="true">{flag}</span>
            <h3>{roomName}</h3>
            {pinned && (
              <span className={`room-status-badge ${live ? 'is-live' : 'is-offline'}`}>
                {live ? 'LIVE' : 'OFFLINE'}
              </span>
            )}
          </div>
          {tags.length > 0 && (
            <div className="room-card-tags">
              {tags.map((tag) => (
                <span className="room-card-tag" key={`${roomId}-${tag}`}>{String(tag).toUpperCase()}</span>
              ))}
            </div>
          )}
          <div className="room-card-occupants" aria-label="People in this room">
            {occupants.length === 0 && <span className="muted">Waiting for listeners</span>}
            {occupants.map((person, index) => {
              const src = avatarUrl(person);
              return src ? (
                <img className="room-occupant-avatar" key={person._id || person.id || index} src={src} alt="" />
              ) : (
                <span className="room-occupant-avatar room-host-avatar-fallback" key={person._id || person.id || index}>
                  {(person.username || '?').slice(0, 1).toUpperCase()}
                </span>
              );
            })}
            {extraOccupants > 0 && <span className="room-occupant-more">+{extraOccupants}</span>}
          </div>
        </div>
        <div className={`room-card-listeners${live ? ' is-live' : ''}`}>
          <span className="room-equalizer" aria-hidden="true">
            <i /><i /><i /><i />
          </span>
          <strong>{listeners}</strong>
        </div>
        {pinned && (room.isDefaultHostRoom ? (
          <button className="button button-primary room-card-action" type="button" onClick={openGoLive}>
            Go Live
          </button>
        ) : (
          <Link className="button button-primary room-card-action" to={`/live/${encodeURIComponent(roomId)}`}>
            {live ? 'Join Room' : 'Go Live'}
          </Link>
        ))}
        {!pinned && (
          <Link className="room-card-hit" to={`/live/${encodeURIComponent(roomId)}`} aria-label={`Join ${roomName}`} />
        )}
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
          <p className="muted">{ownRoomId ? 'Your room stays on Home — go live whenever you are ready.' : 'Drop into a live room and make a new connection.'}</p>
          {ownRoomId && (
            <Link className="button button-primary home-own-room" to={`/live/${encodeURIComponent(ownRoomId)}`}>
              🎙️ {ownRoom?.isLive ? 'Join Room' : 'Go Live'}
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

      {!loading && !error && displayedRooms.length === 0 && (
        <Card className="rooms-empty-state">
          <p>No live hosts yet</p>
          <Link className="button button-secondary" to="/profile">Visit your profile</Link>
        </Card>
      )}

      {displayedRooms.length > 0 && (
        <div className="room-grid">
          {displayedRooms.map((room) => renderRoomCard(room, room.isDefaultHostRoom || roomIdOf(room) === ownRoomId))}
        </div>
      )}

      <Card className="feature-card">
        <div><p className="eyebrow">TAKE A BREAK</p><h2>Try your luck</h2><p className="muted">Play a quick round in a live room.</p></div>
        <Link className="button button-secondary" to="/games/dice">Open Game Center <span aria-hidden="true">→</span></Link>
      </Card>

      <button
        className="home-go-live-fab"
        type="button"
        onClick={openGoLive}
        aria-label={ownRoomId ? (ownRoom?.isLive ? 'My Room' : 'Go Live') : 'Go Live'}
      >
        <Mic size={24} aria-hidden="true" />
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
