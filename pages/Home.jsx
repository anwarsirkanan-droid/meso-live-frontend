// src/pages/Home.jsx
import React, { useState, useEffect, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import API, { createRoom, getMyRoom, getRooms } from '../api';
import { AuthContext } from '../context/AuthContext';
import { Mic, Plus, X } from 'lucide-react';

export default function Home() {
  const [rooms, setRooms] = useState([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [loading, setLoading] = useState(false);

  // Form states for creating a room
  const [roomTitle, setRoomTitle] = useState('');
  const [category, setCategory] = useState('For You');
  const [region, setRegion] = useState('');
  const [language, setLanguage] = useState('');

  const { user, updateRoom } = useContext(AuthContext);
  const navigate = useNavigate();

  const openRoom = (roomId) => {
    if (roomId) navigate(`/live/${encodeURIComponent(String(roomId))}`);
  };

  // Fetch active public rooms on load
  useEffect(() => {
    getRooms()
      .then((data) => {
        if (Array.isArray(data)) setRooms(data);
      })
      .catch((err) => console.error('Rooms fetch error:', err));
  }, []);

  // Main Mic Button Action (Logikaa Ijoo)
  const handleMicClick = async () => {
    setLoading(true);
    try {
      // 1. First check in AuthContext state/localStorage
      let existingRoomId = user?.roomId || user?.room?._id;

      // 2. If not found in context, check from backend database directly
      if (!existingRoomId) {
        const backendRoom = await getMyRoom().catch(() => null);
        if (backendRoom && (backendRoom._id || backendRoom.id)) {
          existingRoomId = backendRoom._id || backendRoom.id;
          updateRoom(backendRoom); // sync context
        }
      }

      if (existingRoomId) {
        // User has an existing room -> Navigate directly into it
        openRoom(existingRoomId);
      } else {
        // User has no room -> Open Create Room Modal
        setShowCreateModal(true);
      }
    } catch (err) {
      console.error('Mic handle error:', err);
      setShowCreateModal(true);
    } finally {
      setLoading(false);
    }
  };

  // Handle new room creation
  const handleCreateRoomSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const payload = {
        title: roomTitle.trim() || `${user?.username || 'My'}'s Live Room`,
        category,
        region,
        language,
      };

      const res = await createRoom(payload);
      const createdRoom = res?.room || res;

      if (createdRoom && (createdRoom._id || createdRoom.id)) {
        const newRoomId = createdRoom._id || createdRoom.id;
        updateRoom(createdRoom); // persist in AuthContext & localStorage
        setShowCreateModal(false);
        openRoom(newRoomId); // navigate straight to the new live room
      }
    } catch (err) {
      console.error('Error creating room:', err);
      alert(err.response?.data?.message || 'Failed to create room.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ background: '#0f0f15', color: '#fff', minHeight: '100vh', padding: '20px', fontFamily: 'sans-serif', position: 'relative' }}>
      {/* Header */}
      <header style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #333', paddingBottom: '15px', alignItems: 'center' }}>
        <h1 style={{ margin: 0, color: '#e91e63', fontSize: '22px' }}>🎙️ Meso Live Hub</h1>
        <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
          <span style={{ fontSize: '14px' }}>
            User: <strong>{user?.username || 'Guest'}</strong> | 🪙 Coins: {user?.coins || 0}
          </span>
        </div>
      </header>

      {/* Main Content */}
      <main style={{ marginTop: '30px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <h3 style={{ margin: 0 }}>Live Audio Rooms (25 Seats)</h3>

          {/* Floating/Action Mic Button */}
          <button
            onClick={handleMicClick}
            disabled={loading}
            style={{
              background: 'linear-gradient(135deg, #a855f7, #ec4899)',
              color: '#fff',
              border: 'none',
              padding: '10px 20px',
              borderRadius: '9999px',
              fontWeight: 'bold',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              boxShadow: '0 4px 15px rgba(236,72,153,0.4)',
            }}
          >
            <Mic size={18} />
            {loading ? 'Checking...' : user?.hasActiveRoom || user?.roomId ? 'Go To My Room' : 'Create Room'}
          </button>
        </div>

        {/* Room Grid List */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '20px' }}>
          {rooms.length === 0 ? (
            <p style={{ color: '#888' }}>No active audio rooms currently available.</p>
          ) : (
            rooms.map((room) => (
              <div key={room._id} style={{ background: '#1e1e2d', padding: '18px', borderRadius: '12px', border: '1px solid #2a2a3d', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                <div>
                  <h4 style={{ margin: '0 0 8px 0', color: '#fff', fontSize: '16px' }}>{room.title || room.name || 'Live Room'}</h4>
                  <p style={{ fontSize: '12px', color: '#a0a0ab', margin: '0 0 12px 0' }}>Category: {room.category || 'Party'}</p>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '10px' }}>
                  <span style={{ fontSize: '12px', color: '#10b981' }}>🟢 Live</span>
                  <button
                    onClick={() => openRoom(room._id)}
                    style={{ background: '#e91e63', color: '#fff', border: 'none', padding: '6px 14px', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold' }}
                  >
                    Join
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </main>

      {/* CREATE ROOM MODAL */}
      {showCreateModal && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(5px)', zIndex: 99999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
          <div style={{ backgroundColor: '#181924', borderRadius: '16px', border: '1px solid #2e3046', width: '100%', maxWidth: '400px', padding: '20px', color: '#fff', position: 'relative' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ margin: 0, fontSize: '18px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Plus size={20} color="#ec4899" /> Create Audio Room
              </h3>
              <X size={20} style={{ cursor: 'pointer', color: '#888' }} onClick={() => setShowCreateModal(false)} />
            </div>

            <form onSubmit={handleCreateRoomSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ fontSize: '12px', color: '#aaa', display: 'block', marginBottom: '6px' }}>Room Title</label>
                <input
                  type="text"
                  placeholder={`${user?.username || 'User'}'s Room`}
                  value={roomTitle}
                  onChange={(e) => setRoomTitle(e.target.value)}
                  style={{ width: '100%', backgroundColor: '#0f0f15', border: '1px solid #2e3046', borderRadius: '8px', padding: '10px', color: '#fff', outline: 'none', boxSizing: 'border-box' }}
                />
              </div>

              <div>
                <label style={{ fontSize: '12px', color: '#aaa', display: 'block', marginBottom: '6px' }}>Category</label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  style={{ width: '100%', backgroundColor: '#0f0f15', border: '1px solid #2e3046', borderRadius: '8px', padding: '10px', color: '#fff', outline: 'none', boxSizing: 'border-box' }}
                >
                  <option value="For You">For You</option>
                  <option value="Party">Party</option>
                  <option value="Ethiopia">Ethiopia</option>
                  <option value="Follow">Follow</option>
                </select>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div>
                  <label style={{ fontSize: '12px', color: '#aaa', display: 'block', marginBottom: '6px' }}>Region (Optional)</label>
                  <input
                    type="text"
                    placeholder="e.g. Oromia"
                    value={region}
                    onChange={(e) => setRegion(e.target.value)}
                    style={{ width: '100%', backgroundColor: '#0f0f15', border: '1px solid #2e3046', borderRadius: '8px', padding: '10px', color: '#fff', outline: 'none', boxSizing: 'border-box' }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '12px', color: '#aaa', display: 'block', marginBottom: '6px' }}>Language (Optional)</label>
                  <input
                    type="text"
                    placeholder="e.g. Afaan Oromoo"
                    value={language}
                    onChange={(e) => setLanguage(e.target.value)}
                    style={{ width: '100%', backgroundColor: '#0f0f15', border: '1px solid #2e3046', borderRadius: '8px', padding: '10px', color: '#fff', outline: 'none', boxSizing: 'border-box' }}
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                style={{
                  marginTop: '10px',
                  backgroundColor: '#ec4899',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '8px',
                  padding: '12px',
                  fontWeight: 'bold',
                  cursor: 'pointer',
                  width: '100%',
                }}
              >
                {loading ? 'Creating...' : 'Start Live Room'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}