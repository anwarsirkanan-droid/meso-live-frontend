import { createContext, useCallback, useContext, useState } from 'react';

function getStoredUser() {
  try {
    return JSON.parse(localStorage.getItem('user') || 'null');
  } catch {
    return null;
  }
}

export const AuthContext = createContext(null);

function persistUser(nextUser) {
  localStorage.setItem('user', JSON.stringify(nextUser));
  return nextUser;
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(getStoredUser);
  const [token, setToken] = useState(localStorage.getItem('token') || null);

  const login = (userData, userToken) => {
    setUser(userData);
    setToken(userToken);
    localStorage.setItem('token', userToken);
    if (userData) {
      localStorage.setItem('user', JSON.stringify(userData));
    } else {
      localStorage.removeItem('user');
    }
  };

  const updateUser = useCallback((updates) => {
    setUser((current) => {
      const next = { ...(current || {}), ...updates };
      return persistUser(next);
    });
  }, []);

  const updateRoom = useCallback((roomData) => {
    const roomId = String(roomData?._id || roomData?.id || roomData?.roomId || '');
    if (!roomId) throw new Error('A room ID is required to save room details.');
    const room = {
      ...roomData,
      _id: roomId,
      title: roomData.title || roomData.name || '',
      isLive: roomData.isLive === true || String(roomData.status).toLowerCase() === 'live',
    };
    setUser((current) => persistUser({
      ...(current || {}),
      hasActiveRoom: true,
      roomId,
      roomName: room.title,
      roomStatus: room.isLive ? 'live' : 'offline',
      room,
    }));
    window.dispatchEvent(new CustomEvent('mesolive-room-updated', { detail: room }));
  }, []);

  const updateRoomStatus = useCallback((roomId, isLive) => {
    if (!roomId) return;
    const normalizedId = String(roomId);
    setUser((current) => {
      if (String(current?.roomId || '') !== normalizedId) return current;
      const room = {
        ...(current.room || {}),
        _id: normalizedId,
        title: current.roomName || current.room?.title || '',
        isLive: Boolean(isLive),
      };
      return persistUser({
        ...current,
        hasActiveRoom: true,
        roomId: normalizedId,
        roomName: room.title,
        roomStatus: isLive ? 'live' : 'offline',
        room,
      });
    });
    window.dispatchEvent(new CustomEvent('mesolive-room-status-changed', {
      detail: { roomId: normalizedId, isLive: Boolean(isLive) },
    }));
  }, []);

  const logout = () => {
    setUser(null);
    setToken(null);
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    localStorage.removeItem('mesoLive.activeRoomId');
  };

  return (
    <AuthContext.Provider value={{ user, token, login, updateUser, updateRoom, updateRoomStatus, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider.');
  return context;
}