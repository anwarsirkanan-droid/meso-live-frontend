import { useEffect, useState } from 'react';
import { Navigate, Outlet, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
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
  const navigate = useNavigate();
  const token = localStorage.getItem('token');
  const [retry, setRetry] = useState(0);
  const [access, setAccess] = useState({ status: 'loading', token });

  useEffect(() => {
    if (!token) {
      setAccess({ status: 'denied', token: null });
      return;
    }

    let active = true;
    setAccess({ status: 'loading', token });
    getProfile()
      .then((data) => {
        if (active) {
          setAccess({ status: 'loaded', token, profile: data });
        }
      })
      .catch((error) => {
        if (active) {
          const message = error.code === 'ECONNABORTED'
            ? 'The profile request timed out. Check your connection and try again.'
            : error.response?.data?.message || error.response?.data?.error || error.message;
          setAccess({ status: 'error', token, message });
        }
      });

    return () => {
      active = false;
    };
  }, [token, retry]);

  if (!token) return <Navigate to="/login" replace state={{ from: location }} />;
  if (access.token !== token || access.status === 'loading') {
    return <main className="page" aria-busy="true"><p className="muted" role="status">Loading your profile…</p></main>;
  }
  if (access.status === 'error') {
    return (
      <main className="page">
        <div className="notice notice-error" role="alert">
          <p>Could not load your profile: {access.message}</p>
          <div className="room-controls">
            <button className="button button-primary" type="button" onClick={() => setRetry((count) => count + 1)}>
              Try again
            </button>
            <button
              className="button button-secondary"
              type="button"
              onClick={() => {
                localStorage.removeItem('token');
                localStorage.removeItem('user');
                navigate('/login', { replace: true });
              }}
            >
              Back to sign in
            </button>
          </div>
        </div>
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
