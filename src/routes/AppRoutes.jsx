import React, { useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import HomeScreen from '../screens/HomeScreen.jsx';
import LiveRoomPage from '../pages/LiveRoomPage.jsx';
import Register from '../pages/Register.jsx';
import ProfileSetup from '../pages/ProfileSetup.jsx';
import SettingsPage from '../pages/SettingsPage.jsx';
import FloatingPlayer from '../components/FloatingPlayer.jsx';
import { useAuth } from '../context/AuthContext.jsx';

export default function AppRoutes() {
  const { user } = useAuth();
  
  // Global Active Room State
  const [activeRoomId, setActiveRoomId] = useState(null);
  const [isMinimized, setIsMinimized] = useState(false);
  const [micEnabled, setMicEnabled] = useState(true);

  const handleOpenRoom = (roomId) => {
    setActiveRoomId(roomId);
    setIsMinimized(false);
  };

  const handleCloseRoom = () => {
    setActiveRoomId(null);
    setIsMinimized(false);
  };

  return (
    <BrowserRouter>
      {/* 1. Full Live Room Screen (Yoo Active Ta'e fi Minimized Ta'uu Dhiise) */}
      {activeRoomId && !isMinimized && (
        <LiveRoomPage
          roomId={activeRoomId}
          isMinimized={false}
          onMinimize={() => setIsMinimized(true)}
          onClose={handleCloseRoom}
        />
      )}

      {/* 2. Floating Persistent Player (Yoo Active Room-ni Minimized Ta'e) */}
      {activeRoomId && isMinimized && (
        <FloatingPlayer
          title="Live Voice Room"
          micEnabled={micEnabled}
          onRestore={() => setIsMinimized(false)}
          onToggleMicrophone={() => setMicEnabled(!micEnabled)}
          onClose={handleCloseRoom}
        />
      )}

      {/* Main Page Navigation Routes */}
      <Routes>
        <Route 
          path="/" 
          element={
            <HomeScreen 
              onOpenRoom={handleOpenRoom} 
              activeRoomId={activeRoomId} 
            />
          } 
        />
        <Route path="/register" element={<Register />} />
        <Route path="/profile-setup" element={<ProfileSetup />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}