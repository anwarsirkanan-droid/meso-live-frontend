import { useEffect, useState } from 'react';
import { Navigate, Outlet, Route, Routes, useLocation, useNavigate, useParams } from 'react-router-dom';
import { getProfile } from '../api.js';
import BottomNav from '../components/BottomNav.jsx';
import Navbar from '../components/Navbar.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import AdminDashboard from '../pages/AdminDashboard.jsx';
import AgencyCenterPage from '../pages/AgencyCenterPage.jsx';
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
  const { updateUser } = useAuth();
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
          const storedUser = (() => {
            try {
              return JSON.parse(localStorage.getItem('user') || '{}');
            } catch {
              return {};
            }
          })();
          const profile = {
            ...data,
            ...(storedUser.hasActiveRoom ? {
              hasActiveRoom: true,
              roomId: storedUser.roomId,
            } : {}),
          };
          updateUser(profile);
          setAccess({ status: 'loaded', token, profile });
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
  }, [token, retry, updateUser]);

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
  const location = useLocation();
  const navigate = useNavigate();
  const [activeRoomId, setActiveRoomId] = useState(() => {
    const routeMatch = location.pathname.match(/^\/live\/([^/]+)/);
    if (routeMatch) return decodeURIComponent(routeMatch[1]);
    try {
      return localStorage.getItem('mesoLive.activeRoomId') || '';
    } catch {
      return '';
    }
  });
  const [minimized, setMinimized] = useState(false);

  useEffect(() => {
    const routeMatch = location.pathname.match(/^\/live\/([^/]+)/);
    if (!routeMatch) return;
    const roomId = decodeURIComponent(routeMatch[1]);
    setActiveRoomId(roomId);
    setMinimized(false);
    localStorage.setItem('mesoLive.activeRoomId', roomId);
  }, [location.pathname]);

  const isRoomRoute = Boolean(activeRoomId) &&
    location.pathname === `/live/${encodeURIComponent(activeRoomId)}`;
  const closeRoom = () => {
    setActiveRoomId('');
    setMinimized(false);
    localStorage.removeItem('mesoLive.activeRoomId');
    if (isRoomRoute) navigate('/', { replace: true });
  };

  return (
    <div className="app-shell">
      <Navbar />
      <Outlet />
      <BottomNav />
      {activeRoomId && (
        <LiveRoomPage
          key={activeRoomId}
          roomId={activeRoomId}
          isMinimized={!isRoomRoute || minimized}
          onMinimize={() => {
            setMinimized(true);
            if (isRoomRoute) navigate('/', { replace: true });
          }}
          onRestore={() => {
            setMinimized(false);
            navigate(`/live/${encodeURIComponent(activeRoomId)}`);
          }}
          onClose={closeRoom}
        />
      )}
    </div>
  );
}

function LiveRoomRoute() {
  const { roomId } = useParams();
  return <div className="live-room-route-placeholder" data-room-id={roomId} />;
}

function LegacyRoomRedirect() {
  const { roomId } = useParams();
  return <Navigate to={`/live/${encodeURIComponent(roomId)}`} replace />;
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
          <Route path="/room/:roomId" element={<LegacyRoomRedirect />} />
          <Route path="/live/:roomId" element={<LiveRoomRoute />} />
          <Route path="/" element={<HomePage />} />
          <Route path="/messages" element={<MessagesPage />} />
          <Route path="/profile" element={<ProfilePage />} />
          <Route path="/profile/settings" element={<SettingsPage />} />
          <Route path="/profile/wallet" element={<HostWalletPage />} />
          <Route path="/profile/agency" element={<AgencyCenterPage />} />
          <Route path="/profile/invite" element={<InvitePage />} />
          <Route path="/profile/face-verify" element={<FaceVerifyPage />} />
          <Route path="/profile/recharge" element={<RechargePage />} />
          <Route path="/games/dice" element={<DiceGamePage />} />
          <Route element={<ProtectedRoute adminOnly />}>
            <Route path="/admin" element={<AdminDashboard />} />
          </Route>
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
