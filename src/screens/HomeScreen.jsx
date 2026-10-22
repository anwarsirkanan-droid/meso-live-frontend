import React, { useState, useEffect } from 'react';
import { getActiveRooms, createRoom } from '../api.js';

export default function HomeScreen({ onOpenRoom }) {
  const [liveRooms, setLiveRooms] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchLiveRooms();
  }, []);

  const fetchLiveRooms = async () => {
    try {
      const rooms = await getActiveRooms();
      setLiveRooms(Array.isArray(rooms) ? rooms : []);
    } catch (err) {
      console.error("Error fetching live rooms:", err);
    }
  };

  // Mic button ykn start live click yeroo godhamu room uumamee ni saaqama
  const handleStartLive = async () => {
    try {
      setLoading(true);
      const res = await createRoom({
        title: "Live Party Room",
        category: "For You"
      });
      const newRoomId = res?.room?._id || res?._id;
      if (newRoomId) {
        onOpenRoom(newRoomId);
        fetchLiveRooms();
      }
    } catch (err) {
      console.error("Failed to create room:", err);
      alert("Room uumuu hin danda'amne.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ position: 'relative', minHeight: '100vh', backgroundColor: '#090a10', color: '#fff', padding: '16px' }}>
      
      {/* Top Header / Categories */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
        <span style={{ fontWeight: 'bold', borderBottom: '2px solid #ec4899', paddingBottom: '4px' }}>Party</span>
      </div>

      <h3 style={{ fontSize: '18px', fontWeight: 'bold', marginBottom: '12px' }}>Live rooms</h3>

      {/* Active Live Rooms List or Fallback Card */}
      {liveRooms.length === 0 ? (
        <div style={{
          backgroundColor: '#161822',
          padding: '24px',
          borderRadius: '16px',
          textAlign: 'center',
          marginTop: '12px',
          border: '1px solid rgba(255,255,255,0.05)'
        }}>
          <p style={{ color: '#9ca3af', marginBottom: '12px', fontSize: '13px' }}>No live hosts yet</p>
          <button 
            onClick={handleStartLive}
            style={{
              backgroundColor: '#ec4899',
              color: '#fff',
              border: 'none',
              padding: '8px 18px',
              borderRadius: '9999px',
              cursor: 'pointer',
              fontWeight: 'bold',
              fontSize: '12px'
            }}
          >
            Start Live Now
          </button>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px' }}>
          {liveRooms.map((room) => (
            <div 
              key={room._id} 
              onClick={() => onOpenRoom(room._id)}
              style={{
                backgroundColor: '#161822',
                borderRadius: '12px',
                padding: '12px',
                cursor: 'pointer',
                border: '1px solid rgba(255,255,255,0.08)'
              }}
            >
              <div style={{ fontWeight: 'bold', fontSize: '14px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {room.title}
              </div>
              <div style={{ fontSize: '11px', color: '#ec4899', marginTop: '4px' }}>
                ● {room.host?.username || room.ownerId?.username || 'Host'}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Floating Purple/Pink Mic Button */}
      <button
        onClick={handleStartLive}
        disabled={loading}
        style={{
          position: 'fixed',
          bottom: '80px',
          right: '20px',
          width: '60px',
          height: '60px',
          borderRadius: '50%',
          background: 'linear-gradient(135deg, #a855f7, #ec4899)',
          border: 'none',
          boxShadow: '0 8px 24px rgba(236, 72, 153, 0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          zIndex: 99999
        }}
      >
        <span style={{ fontSize: '26px', color: '#fff' }}>
          {loading ? '⌛' : '🎤'}
        </span>
      </button>
    </div>
  );
}