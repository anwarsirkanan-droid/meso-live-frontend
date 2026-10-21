import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { CalendarDays, ChevronDown, Globe2, Mic, Search, Trophy, X } from 'lucide-react';
import { io } from 'socket.io-client';
import { createRoom, getRoom, getRooms, globalSearch } from '../api.js';
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

const HOT_FILTERS = [
  'For You', 'Ethiopia', 'Africa (EN)', 'Philippines', 'Indonesia',
  'Africa (FR)', 'South Asia', 'Southeast Asia', 'Middle East', 'Eastern Europe',
];

const LANGUAGE_FILTERS = [
  'English', 'Français', 'Português', 'Indonesian', 'አማርኛ',
  'العربية', 'Filipino', 'မြန်မာဘာသာ', 'हिन्दी', 'नेपाली',
];

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
  const [creatingRoom, setCreatingRoom] = useState(false);
  const [activeTab, setActiveTab] = useState('party');
  const [activeRegion, setActiveRegion] = useState('');
  const [activeLanguage, setActiveLanguage] = useState('');
  const [filterOpen, setFilterOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [globalResults, setGlobalResults] = useState({ users: [], agencies: [], rooms: [] });
  const [globalSearchLoading, setGlobalSearchLoading] = useState(false);
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
    let fetchingRooms = false;
    const roomStatusSocket = io(API_URL, {
      auth: { token: localStorage.getItem('token') || '' },
    });
    const refreshRooms = async () => {
      if (!active || fetchingRooms) return;
      fetchingRooms = true;
      try {
        const data = await getRooms({
          tab: activeTab,
          region: activeRegion,
          language: activeLanguage,
          search: searchQuery.trim(),
        });
        if (active) {
          setRooms(Array.isArray(data) ? data : []);
          setError('');
        }
      } catch (requestError) {
        if (active) setError(requestError.response?.data?.message || 'Could not load live rooms. Please try again.');
      } finally {
        fetchingRooms = false;
        if (active) setLoading(false);
      }
    };
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
      refreshRooms();
    };
    const onRoomListUpdated = () => refreshRooms();
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
    roomStatusSocket.on('room_list_updated', onRoomListUpdated);
    window.addEventListener('mesolive-room-updated', onRoomUpdated);
    window.addEventListener('mesolive-room-status-changed', onLocalRoomStatusChanged);
    setLoading(true);
    setError('');
    const searchTimer = window.setTimeout(refreshRooms, searchQuery.trim() ? 250 : 0);
    const refreshInterval = window.setInterval(refreshRooms, 5000);
    window.addEventListener('focus', refreshRooms);

    return () => {
      active = false;
      window.clearTimeout(searchTimer);
      window.clearInterval(refreshInterval);
      window.removeEventListener('focus', refreshRooms);
      roomStatusSocket.off('room-status-changed', onRoomStatusChanged);
      roomStatusSocket.off('room_list_updated', onRoomListUpdated);
      window.removeEventListener('mesolive-room-updated', onRoomUpdated);
      window.removeEventListener('mesolive-room-status-changed', onLocalRoomStatusChanged);
      roomStatusSocket.disconnect();
    };
  }, [activeLanguage, activeRegion, activeTab, ownRoomId, searchQuery, updateRoomStatus]);

  useEffect(() => {
    const query = searchQuery.trim();
    if (!searchOpen || !query) {
      setGlobalResults({ users: [], agencies: [], rooms: [] });
      setGlobalSearchLoading(false);
      return undefined;
    }
    let active = true;
    setGlobalSearchLoading(true);
    const timer = window.setTimeout(() => {
      globalSearch(query)
        .then((data) => {
          if (active) setGlobalResults({ users: data.users || [], agencies: data.agencies || [], rooms: data.rooms || [] });
        })
        .catch(() => {
          if (active) setGlobalResults({ users: [], agencies: [], rooms: [] });
        })
        .finally(() => {
          if (active) setGlobalSearchLoading(false);
        });
    }, 250);
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [searchOpen, searchQuery]);

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
    const allRooms = rooms;
    const normalizedQuery = searchQuery.trim().toLowerCase();
    const matchesSearch = (room) => !normalizedQuery || [room.title, room.name, room.category, room.host?.username, room.ownerId?.username]
      .filter(Boolean).some((value) => String(value).toLowerCase().includes(normalizedQuery));
    return allRooms.filter(matchesSearch);
  }, [rooms, searchQuery]);

  const openGoLive = async () => {
    if (ownRoomId) {
      navigate(`/room/${encodeURIComponent(ownRoomId)}`);
      return;
    }
    setCreatingRoom(true);
    setError('');
    try {
      const currentUsername = user?.username || ownRoom?.host?.username || 'My';
      const result = await createRoom({
        title: `${currentUsername}'s Live Room`,
        category: 'For You',
        region: user?.region || user?.country || '',
        language: user?.language || '',
      });
      const room = result?.room || result;
      const roomId = room?._id || room?.id || room?.roomId;
      if (!roomId) throw new Error('The server did not return a room ID.');
      updateRoom(room);
      navigate(`/room/${encodeURIComponent(String(roomId))}`);
    } catch (requestError) {
      setError(requestError.response?.data?.message || requestError.message || 'Could not create your live room.');
    } finally {
      setCreatingRoom(false);
    }
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

    const joinLiveRoom = () => {
      if (live && roomId) navigate(`/live/${encodeURIComponent(roomId)}`);
    };

    return (
      <article
        key={roomId}
        className={`card room-card${pinned ? ' is-pinned-room' : ''}${live ? ' is-live' : ''}`}
        onClick={joinLiveRoom}
        onKeyDown={(event) => {
          if ((event.key === 'Enter' || event.key === ' ') && live && roomId) {
            event.preventDefault();
            joinLiveRoom();
          }
        }}
        role={live && roomId ? 'link' : undefined}
        tabIndex={live && roomId ? 0 : undefined}
        aria-label={live && roomId ? `Join ${roomName}` : undefined}
      >
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
      </article>
    );
  };

  return (
    <Page title="Party" hideHeading>
      <section className="party-header" aria-label="Party navigation and filters">
        <div className="party-tabs" role="tablist" aria-label="Home feed">
          {[
            ['follow', 'Follow'],
            ['party', 'Party'],
          ].map(([tab, label]) => (
            <button className={activeTab === tab ? 'is-active' : ''} type="button" role="tab" aria-selected={activeTab === tab} key={tab} onClick={() => setActiveTab(tab)}>{label}</button>
          ))}
        </div>
        <button className="party-search-button" type="button" aria-label={searchOpen ? 'Close search' : 'Search rooms'} onClick={() => setSearchOpen((open) => !open)}>
          <Search size={20} aria-hidden="true" />
        </button>
        {searchOpen && <>
          <input className="party-search-input" value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); setSearchOpen(true); } }} placeholder="Search User ID, Host, Agency ID, or Room ID" aria-label="Search User ID, Host, Agency ID, or Room ID" autoFocus />
          {searchQuery.trim() && <div className="global-search-results" role="region" aria-label="Global search results">
            {globalSearchLoading && <p className="muted global-search-status">Searching…</p>}
            {!globalSearchLoading && !globalResults.users.length && !globalResults.agencies.length && !globalResults.rooms.length && <p className="muted global-search-status">No matching users, agencies, or live rooms.</p>}
            {!globalSearchLoading && globalResults.users.length > 0 && <section className="global-search-section"><h3>Users / Hosts</h3>{globalResults.users.map((result) => <div className="global-search-result" key={`user-${result.id}`}><span className="global-search-avatar">{result.avatar ? <img src={result.avatar} alt="" /> : (result.nickname || 'U').slice(0, 1).toUpperCase()}</span><span className="global-search-copy"><strong>{result.nickname || result.username}</strong><small>ID: {result.customId || result.userId || result.id}{result.agencyName ? ` · ${result.agencyName}` : ''}</small></span>{result.isHost && <span className="profile-pill profile-host-badge">Host</span>}<button className="button button-secondary button-small" type="button" onClick={() => { setSearchOpen(false); navigate(result.roomId ? `/room/${encodeURIComponent(String(result.roomId))}` : `/profile/${encodeURIComponent(String(result.userId || result.id))}`); }}>{result.roomId ? 'Enter Room' : 'View Profile'}</button></div>)}</section>}
            {!globalSearchLoading && globalResults.agencies.length > 0 && <section className="global-search-section"><h3>Agencies</h3>{globalResults.agencies.map((result) => <div className="global-search-result global-search-static" key={`agency-${result.id}`}><span className="global-search-avatar">A</span><span className="global-search-copy"><strong>{result.name}</strong><small>Agency ID: {result.agencyId}</small></span></div>)}</section>}
            {!globalSearchLoading && globalResults.rooms.length > 0 && <section className="global-search-section"><h3>Live Rooms</h3>{globalResults.rooms.map((result) => <div className="global-search-result" key={`room-${result.id}`}><span className="global-search-avatar">{result.avatar ? <img src={result.avatar} alt="" /> : '🎙️'}</span><span className="global-search-copy"><strong>{result.title}</strong><small>Room ID: {result.roomId}</small></span><button className="button button-primary button-small" type="button" onClick={() => { setSearchOpen(false); navigate(`/room/${encodeURIComponent(String(result.roomId || result.id))}`); }}>Enter</button></div>)}</section>}
          </div>}
        </>}
        {activeTab === 'party' && <div className="party-filters" role="tablist" aria-label="Region filters">
          <button className={!activeRegion && !activeLanguage ? 'is-active' : ''} type="button" role="tab" aria-selected={!activeRegion && !activeLanguage} onClick={() => { setActiveRegion(''); setActiveLanguage(''); }}><span className="filter-fire" aria-hidden="true">🔥</span> For You</button>
          <button className={activeRegion === 'Ethiopia' ? 'is-active' : ''} type="button" role="tab" aria-selected={activeRegion === 'Ethiopia'} onClick={() => { setActiveRegion('Ethiopia'); setActiveLanguage(''); }}>🇪🇹 Ethiopia</button>
          <button className={activeRegion === 'Africa (EN)' ? 'is-active' : ''} type="button" role="tab" aria-selected={activeRegion === 'Africa (EN)'} onClick={() => { setActiveRegion('Africa (EN)'); setActiveLanguage(''); }}>🇪🇹🇳🇬🇬🇭 Africa (EN)</button>
          <button className="party-filter-trigger" type="button" onClick={() => setFilterOpen(true)} aria-haspopup="dialog" aria-expanded={filterOpen} aria-label="Open region and language filters"><ChevronDown size={17} aria-hidden="true" /></button>
        </div>}
      </section>

      {filterOpen && (
        <div className="filter-modal-backdrop" role="presentation" onClick={() => setFilterOpen(false)}>
          <section className="filter-modal" role="dialog" aria-modal="true" aria-labelledby="filter-modal-title" onClick={(event) => event.stopPropagation()}>
            <div className="filter-modal-header">
              <div><p className="eyebrow">DISCOVER</p><h2 id="filter-modal-title">Filter rooms</h2></div>
              <button className="filter-modal-close" type="button" onClick={() => setFilterOpen(false)} aria-label="Close filters"><X size={18} /></button>
            </div>
            <div className="filter-modal-section">
              <p className="filter-modal-label">HOT</p>
              <div className="filter-option-grid">
                {HOT_FILTERS.map((label) => {
                  const selected = label === 'For You' ? !activeRegion : activeRegion === label;
                  return <button className={selected ? 'is-selected' : ''} type="button" key={label} onClick={() => { setActiveRegion(label === 'For You' ? '' : label); setFilterOpen(false); }}>{label}</button>;
                })}
              </div>
            </div>
            <div className="filter-modal-section">
              <p className="filter-modal-label">LANGUAGE</p>
              <div className="filter-option-grid">
                {LANGUAGE_FILTERS.map((label) => <button className={activeLanguage === label ? 'is-selected' : ''} type="button" key={label} onClick={() => { setActiveLanguage(activeLanguage === label ? '' : label); setFilterOpen(false); }}>{label}</button>)}
              </div>
            </div>
            {(activeRegion || activeLanguage) && <button className="button button-secondary filter-clear" type="button" onClick={() => { setActiveRegion(''); setActiveLanguage(''); setFilterOpen(false); }}>Clear filters</button>}
          </section>
        </div>
      )}

      <section className="party-promos" aria-label="Promotions">
        <article className="party-promo party-promo-rank"><Trophy size={25} aria-hidden="true" /><div><strong>Rank</strong><span>Climb the leaderboard</span></div><b>→</b></article>
        <article className="party-promo party-promo-event"><CalendarDays size={25} aria-hidden="true" /><div><strong>Event</strong><span>Join the next challenge</span></div><b>→</b></article>
      </section>

      <section className="hero-card">
        <div>
          <p className="eyebrow">{ownRoomId ? 'YOUR LIVE ROOM IS READY' : 'YOUR NEXT CONVERSATION STARTS HERE'}</p>
          <h2>{ownRoomId ? <>Your room.<br />Your community.</> : <>Find your people.<br />Join the moment.</>}</h2>
          <p className="muted">{ownRoomId ? 'Your room stays on Home — go live whenever you are ready.' : 'Drop into a live room and make a new connection.'}</p>
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

    </Page>
  );
}
