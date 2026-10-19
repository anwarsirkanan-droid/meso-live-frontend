import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { getRoom } from '../api.js';
import { Card, Page } from '../components/UI.jsx';

export default function LiveRoomPage() {
  const { roomId } = useParams();
  const [room, setRoom] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

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

  const host = room?.ownerId && typeof room.ownerId === 'object' ? room.ownerId : null;
  const hostName = host?.username;

  return (
    <Page
      title={room?.title || 'Live room'}
      eyebrow={room?.category ? room.category.toUpperCase() : `ROOM ${roomId}`}
    >
      {loading && (
        <div className="rooms-loading" role="status" aria-label="Loading room">
          <span className="loading-spinner" />
          <span className="muted">Loading room…</span>
        </div>
      )}

      {!loading && error && <div className="notice-error" role="alert">{error}</div>}

      {!loading && !error && room && (
        <Card className="live-stage">
          {room.isLive ? (
            <span className="live-pill"><i /> LIVE NOW</span>
          ) : (
            <span className="count-badge">OFFLINE</span>
          )}
          {host?.avatar ? (
            <img className="host-orb host-avatar-image" src={host.avatar} alt="" />
          ) : (
            <div className="host-orb host-avatar-fallback" aria-label={hostName || 'Host'}>
              {hostName ? hostName.slice(0, 1).toUpperCase() : '?'}
            </div>
          )}
          <h2>{hostName || 'Host unavailable'}</h2>
          <p className="muted">{room.title}</p>
          <p className="muted">
            {Number.isFinite(room.currentListenersCount) ? room.currentListenersCount : 0} listening
          </p>
          <div className="room-controls">
            <Link className="button button-danger" to="/">Leave room</Link>
          </div>
        </Card>
      )}
    </Page>
  );
}
