import React, { useState, useEffect, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import API from '../api';
import { AuthContext } from '../context/AuthContext';

export default function Home() {
  const [rooms, setRooms] = useState([]);
  const { user, logout } = useContext(AuthContext);
  const navigate = useNavigate();

  useEffect(() => {
    API.get('/room')
      .then((res) => setRooms(res.data))
      .catch((err) => console.error('Rooms fetch error:', err));
  }, []);

  return (
    <div style={{ background: '#0f0f15', color: '#fff', minHeight: '100vh', padding: '20px', fontFamily: 'sans-serif' }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #333', paddingBottom: '15px', alignItems: 'center' }}>
        <h1 style={{ margin: 0, color: '#e91e63' }}>🎙️ Meso Live Hub</h1>
        <div>
          <span style={{ fontSize: '16px', marginRight: '15px' }}>
            User: <strong>{user?.username}</strong> | 🪙 Coins: {user?.coins || 0}
          </span>
          <button onClick={logout} style={{ background: '#e53935', color: '#fff', border: 'none', padding: '8px 15px', borderRadius: '4px', cursor: 'pointer' }}>
            Logout
          </button>
        </div>
      </header>

      <main style={{ marginTop: '30px' }}>
        <h3>Live Audio Rooms (25 Seats Available)</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '20px', marginTop: '15px' }}>
          {rooms.length === 0 ? (
            <p style={{ color: '#888' }}>No active audio rooms currently available.</p>
          ) : (
            rooms.map((room) => (
              <div key={room._id} style={{ background: '#1e1e2d', padding: '20px', borderRadius: '8px', border: '1px solid #333' }}>
                <h4 style={{ margin: '0 0 10px 0' }}>{room.name}</h4>
                <p style={{ fontSize: '13px', color: '#aaa', marginBottom: '15px' }}>Seats: {room.seats?.length || 0}/25</p>
                <button 
                  onClick={() => navigate(`/room/${room._id}`)} 
                  style={{ background: '#e91e63', color: '#fff', border: 'none', padding: '8px 14px', borderRadius: '4px', cursor: 'pointer', width: '100%' }}
                >
                  Join Room
                </button>
              </div>
            ))
          )}
        </div>
      </main>
    </div>
  );
}