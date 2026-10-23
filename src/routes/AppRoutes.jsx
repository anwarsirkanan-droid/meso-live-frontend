import React, { useEffect, useState } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import HomeScreen from '../screens/HomeScreen.jsx';
import LiveRoomPage from '../pages/LiveRoomPage.jsx';
import Login from '../pages/Login.jsx';
import ProfilePage from '../pages/ProfilePage.jsx';
import MessagesPage from '../pages/MessagesPage.jsx';
import BottomNav from '../components/BottomNav.jsx';
import TaskCenter from '../components/TaskCenter.jsx';
import { getActiveRooms, createRoom } from '../api.js';
import { useAuth } from '../../context/AuthContext.jsx';

function ProtectedHome({ children }) {
  const { token, validateSession, logout } = useAuth();
  const [status, setStatus] = useState('checking');

  useEffect(() => {
    let active = true;
    if (!token) {
      logout();
      setStatus('unauthenticated');
      return () => { active = false; };
    }
    validateSession().then((valid) => {
      if (active) setStatus(valid ? 'authenticated' : 'unauthenticated');
    });
    return () => { active = false; };
  }, [token, validateSession, logout]);

  if (status === 'checking') return <main className="auth-page" role="status">Checking your session…</main>;
  if (status !== 'authenticated') return <Navigate to="/login" replace />;
  return children;
}

export default function AppRoutes() {
  const [activeRoomId, setActiveRoomId] = useState(null);
  const [isMinimized, setIsMinimized] = useState(false);
  const [showTaskCenter, setShowTaskCenter] = useState(false);

  // Task "Go" Click Handler: Active Room Search or Auto-Create Room
  const handleTaskGoToRoom = async () => {
    try {
      setShowTaskCenter(false);
      const rooms = await getActiveRooms();
      
      if (Array.isArray(rooms) && rooms.length > 0) {
        // Room active ta'e isa jalqabaa saaqa
        setActiveRoomId(rooms[0]._id);
      } else {
        // Room live ta'e yoo hin jire, room haaraa uuma
        const newRoom = await createRoom({ title: "Live Party Room", category: "For You" });
        const roomId = newRoom?.room?._id || newRoom?._id;
        if (roomId) setActiveRoomId(roomId);
      }
      setIsMinimized(false);
    } catch (err) {
      console.error("Task redirect error:", err);
    }
  };

  return (
    <>
      {/* Task Center Modal */}
      {showTaskCenter && (
        <TaskCenter 
          onGoToRoom={handleTaskGoToRoom} 
          onClose={() => setShowTaskCenter(false)} 
        />
      )}

      {/* Active Live Room View */}
      {activeRoomId && !isMinimized && (
        <LiveRoomPage
          roomId={activeRoomId}
          isMinimized={false}
          onMinimize={() => setIsMinimized(true)}
          onClose={() => setActiveRoomId(null)}
        />
      )}

      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/" element={<ProtectedHome><HomeScreen
          onOpenRoom={(id) => { setActiveRoomId(id); setIsMinimized(false); }}
          onOpenTasks={() => setShowTaskCenter(true)}
        /></ProtectedHome>} />
        <Route path="/profile" element={<ProtectedHome><ProfilePage /></ProtectedHome>} />
        <Route path="/messages" element={<ProtectedHome><MessagesPage /></ProtectedHome>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <BottomNav />
    </>
  );
}
