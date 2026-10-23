import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';

// Pages
import HomePage from './pages/HomePage';
import Login from './pages/Login';
import ChatPage from './pages/ChatPage'; // Ykn Chat
import ProfilePage from './pages/ProfilePage'; // Ykn Profile

// Components (yoo Navigation Bar addatti qabaatte)
import BottomNavigation from './components/BottomNavigation'; 

function App() {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/login" element={<Login />} />
          <Route path="/chat" element={<ChatPage />} />
          <Route path="/profile" element={<ProfilePage />} />
        </Routes>
        
        {/* Navigation Bar kan jala irra jiru yoo jiraate */}
        <BottomNavigation />
      </Router>
    </AuthProvider>
  );
}

export default App;