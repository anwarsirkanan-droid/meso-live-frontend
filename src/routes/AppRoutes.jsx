import React, { useEffect, useState } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import HomeScreen from '../screens/HomeScreen.jsx';
import LiveRoomPage from '../pages/LiveRoomPage.jsx';
import Login from '../pages/Login.jsx';
import Register from '../pages/Register.jsx';
import ProfilePage from '../pages/ProfilePage.jsx';
import MessagesPage from '../pages/MessagesPage.jsx';
import ProfileSetup from '../pages/ProfileSetup.jsx';
import SettingsPage from '../pages/SettingsPage.jsx';
import RechargePage from '../pages/RechargePage.jsx';
import HostWalletPage from '../pages/HostWalletPage.jsx';
import LevelDetailsPage from '../pages/LevelDetailsPage.jsx';
import TaskCenterScreen from '../screens/TaskCenterScreen.jsx';
import HostCenterScreen from '../screens/HostCenterScreen.jsx';
import AgencyCenterScreen from '../screens/AgencyCenterScreen.jsx';
import DiceGamePage from '../pages/DiceGamePage.jsx';
import FaceVerifyPage from '../pages/FaceVerifyPage.jsx';
import ProfileDetailsScreen from '../screens/ProfileDetailsScreen.jsx';
import {
  FollowersPage,
  FollowingPage,
  EditProfilePage,
  MyStreamsPage,
  GiftHistoryPage,
  InvitePageView,
  WithdrawalPage,
} from '../pages/ProfileUtilityPages.jsx';
import BottomNav from '../components/BottomNav.jsx';
import TaskCenter from '../components/TaskCenter.jsx';
import { getActiveRooms, createRoom } from '../api.js';
import { useAuth } from '../context/AuthContext.jsx';

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
        <Route path="/register" element={<Register />} />
        <Route path="/" element={<ProtectedHome><HomeScreen
          onOpenRoom={(id) => { setActiveRoomId(id); setIsMinimized(false); }}
          onOpenTasks={() => setShowTaskCenter(true)}
        /></ProtectedHome>} />
        <Route path="/profile" element={<ProtectedHome><ProfilePage /></ProtectedHome>} />
        <Route path="/profile/edit" element={<ProtectedHome><EditProfilePage /></ProtectedHome>} />
        <Route path="/profile/followers" element={<ProtectedHome><FollowersPage /></ProtectedHome>} />
        <Route path="/profile/following" element={<ProtectedHome><FollowingPage /></ProtectedHome>} />
        <Route path="/profile/streams" element={<ProtectedHome><MyStreamsPage /></ProtectedHome>} />
        <Route path="/profile/gifts" element={<ProtectedHome><GiftHistoryPage /></ProtectedHome>} />
        <Route path="/profile/invite" element={<ProtectedHome><InvitePageView /></ProtectedHome>} />
        <Route path="/profile/withdrawal" element={<ProtectedHome><WithdrawalPage /></ProtectedHome>} />
        <Route path="/profile/recharge" element={<ProtectedHome><RechargePage /></ProtectedHome>} />
        <Route path="/profile/wallet" element={<ProtectedHome><HostWalletPage /></ProtectedHome>} />
        <Route path="/profile/levels" element={<ProtectedHome><LevelDetailsPage /></ProtectedHome>} />
        <Route path="/profile/agency" element={<ProtectedHome><AgencyCenterScreen /></ProtectedHome>} />
        <Route path="/profile/:userId" element={<ProtectedHome><ProfileDetailsScreen /></ProtectedHome>} />
        <Route path="/messages" element={<ProtectedHome><MessagesPage /></ProtectedHome>} />
        <Route path="/tasks" element={<ProtectedHome><TaskCenterScreen /></ProtectedHome>} />
        <Route path="/host-center" element={<ProtectedHome><HostCenterScreen /></ProtectedHome>} />
        <Route path="/games/dice" element={<ProtectedHome><DiceGamePage /></ProtectedHome>} />
        <Route path="/face-verify" element={<ProtectedHome><FaceVerifyPage /></ProtectedHome>} />
        <Route path="/profile-setup" element={<ProtectedHome><ProfileSetup /></ProtectedHome>} />
        <Route path="/settings" element={<ProtectedHome><SettingsPage /></ProtectedHome>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <BottomNav />
    </>
  );
}
