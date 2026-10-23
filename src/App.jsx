import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';

// Pages
import HomePage from './pages/HomePage';
import Login from './pages/Login';
import Register from './pages/Register';
import MessagesPage from './pages/MessagesPage';
import ProfilePage from './pages/ProfilePage';
import ProfileSetup from './pages/ProfileSetup';
import ProfileUtilityPages from './pages/ProfileUtilityPages';
import LiveRoomPage from './pages/LiveRoomPage';
import AdminDashboard from './pages/AdminDashboard';
import AgencyCenterPage from './pages/AgencyCenterPage';
import AgencyDashboardScreen from './pages/AgencyDashboardScreen';
import DiceGamePage from './pages/DiceGamePage';
import FaceVerifyPage from './pages/FaceVerifyPage';
import HostWalletPage from './pages/HostWalletPage';
import InvitePage from './pages/InvitePage';
import LevelDetailsPage from './pages/LevelDetailsPage';
import RechargePage from './pages/RechargePage';
import SettingsPage from './pages/SettingsPage';

function App() {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/messages" element={<MessagesPage />} />
          <Route path="/chat" element={<MessagesPage />} />
          <Route path="/profile" element={<ProfilePage />} />
          <Route path="/profile-setup" element={<ProfileSetup />} />
          <Route path="/profile-utility" element={<ProfileUtilityPages />} />
          <Route path="/room/:id" element={<LiveRoomPage />} />
          <Route path="/admin" element={<AdminDashboard />} />
          <Route path="/agency" element={<AgencyCenterPage />} />
          <Route path="/agency-dashboard" element={<AgencyDashboardScreen />} />
          <Route path="/dice-game" element={<DiceGamePage />} />
          <Route path="/face-verify" element={<FaceVerifyPage />} />
          <Route path="/wallet" element={<HostWalletPage />} />
          <Route path="/invite" element={<InvitePage />} />
          <Route path="/level" element={<LevelDetailsPage />} />
          <Route path="/recharge" element={<RechargePage />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Routes>
      </Router>
    </AuthProvider>
  );
}

export default App;