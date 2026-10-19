import { useEffect, useState } from 'react';
import { Navigate, Outlet, Route, Routes, useLocation } from 'react-router-dom';
import { getProfile } from '../api.js';
import BottomNav from '../components/BottomNav.jsx';
import Navbar from '../components/Navbar.jsx';
import AdminDashboard from '../pages/AdminDashboard.jsx';
import DiceGamePage from '../pages/DiceGamePage.jsx';
import FaceVerifyPage from '../pages/FaceVerifyPage.jsx';
import HomePage from '../pages/HomePage.jsx';
import HostWalletPage from '../pages/HostWalletPage.jsx';
import InvitePage from '../pages/InvitePage.jsx';
import LiveRoomPage from '../pages/LiveRoomPage.jsx';
import Login from '../pages/Login.jsx';
import MessagesPage from '../pages/MessagesPage.jsx';
import ProfilePage from '../pages/ProfilePage.jsx';
import ProfileSetup from '../pages/ProfileSetup.jsx';
import RechargePage from '../pages/RechargePage.jsx';
import Register from '../pages/Register.jsx';
import SettingsPage from '../pages/SettingsPage.jsx';

function ProtectedRoute({ adminOnly = false, allowIncomplete = false }) {
  const location = useLocation();
  const token = localStorage.getItem('token');
  const [access, setAccess] = useState({ status: 'loading' });

  useEffect(() => {
    if (!token) {
      setAccess({ status: 'denied' });
      return;
    }

    let active = true;
    getProfile()
      .then((data) => {
        const profile = data?.user || data;
        if (active) {
          setAccess({ status: 'loaded', profile });
        }
      })
      .catch((error) => {
        if (active) {
          setAccess({ status: 'error', message: error.response?.data?.message || error.message });
        }
      });

    return () => {
      active = false;
    };
  }, [token]);

  if (!token) return <Navigate to="/login" replace state={{ from: location }} />;
  if (access.status === 'loading') {
    return <main className="page"><p className="muted">Loading your profile…</p></main>;
  }
  if (access.status === 'error') {
    return (
      <main className="page">
        <div className="notice notice-error">Could not load your profile: {access.message}</div>
      </main>
    );
  }

  const profile = access.profile;
  if (allowIncomplete && profile?.profileComplete) return <Navigate to="/" replace />;
  if (!allowIncomplete && !profile?.profileComplete) return <Navigate to="/profile-setup" replace />;
  if (adminOnly && profile?.role !== 'ADMIN' && profile?.isAdmin !== true) {
    return <Navigate to="/" replace />;
  }

  return <Outlet />;
}

function AppLayout() {
  return (
    <div className="app-shell">
      <Navbar />
      <Outlet />
      <BottomNav />
    </div>
  );
}

export default function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route element={<ProtectedRoute allowIncomplete />}>
        <Route path="/profile-setup" element={<ProfileSetup />} />
      </Route>
      <Route element={<ProtectedRoute />}>
        <Route element={<AppLayout />}>
          <Route path="/" element={<HomePage />} />
          <Route path="/messages" element={<MessagesPage />} />
          <Route path="/profile" element={<ProfilePage />} />
          <Route path="/profile/settings" element={<SettingsPage />} />
          <Route path="/profile/wallet" element={<HostWalletPage />} />
          <Route path="/profile/invite" element={<InvitePage />} />
          <Route path="/profile/face-verify" element={<FaceVerifyPage />} />
          <Route path="/profile/recharge" element={<RechargePage />} />
          <Route path="/games/dice" element={<DiceGamePage />} />
          <Route path="/live/:roomId" element={<LiveRoomPage />} />
        </Route>
      </Route>
      <Route element={<ProtectedRoute adminOnly />}>
        <Route path="/admin" element={<AdminDashboard />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
