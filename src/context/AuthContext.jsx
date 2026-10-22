import { createContext, useCallback, useContext, useState } from 'react';

const OWNED_ROOM_KEY = 'mesoLive.ownedRoom';

function readJson(key, fallback = null) {
  try {
    return JSON.parse(localStorage.getItem(key) || 'null') ?? fallback;
  } catch {
    return fallback;
  }
}

function userKey(value) {
  return String(value?._id || value?.id || value?.userId || '');
}

function getStoredOwnedRoom() {
  return readJson(OWNED_ROOM_KEY);
}

function persistOwnedRoom(room, owner) {
  if (!room?._id) {
    return;
  }
  localStorage.setItem(OWNED_ROOM_KEY, JSON.stringify({
    ...room,
    ownerUserId: userKey(owner) || room.ownerUserId || '',
  }));
}

function ownedRoomFor(userData, previousUser) {
  const stored = getStoredOwnedRoom();
  const ownerId = userKey(userData) || userKey(previousUser);
  if (stored && (!stored.ownerUserId || !ownerId || String(stored.ownerUserId) === ownerId)) {
    return stored;
  }
  return previousUser?.room || null;
}

function buildPersistentRoom(userData, previousUser) {
  const previousRoom = ownedRoomFor(userData, previousUser);
  const roomId = String(
    userData?.roomId
    || userData?.room?._id
    || userData?.room?.id
    || previousUser?.roomId
    || previousRoom?._id
    || '',
  );
  if (!roomId) return null;

  const incomingRoom = userData?.room && typeof userData.room === 'object' ? userData.room : null;
  const liveFromUser = typeof userData?.roomStatus === 'string'
    ? userData.roomStatus.toLowerCase() === 'live'
    : undefined;
  const liveFromIncoming = incomingRoom && (
    typeof incomingRoom.isLive === 'boolean'
      ? incomingRoom.isLive
      : String(incomingRoom.status || '').toLowerCase() === 'live'
  );
  const isLive = typeof liveFromIncoming === 'boolean'
    ? liveFromIncoming
    : typeof liveFromUser === 'boolean'
      ? liveFromUser
      : previousRoom?.isLive === true || previousUser?.roomStatus === 'live';

  return {
    ...(previousRoom || {}),
    ...(incomingRoom || {}),
    _id: roomId,
    title: incomingRoom?.title
      || incomingRoom?.name
      || userData?.roomName
      || previousRoom?.title
      || previousUser?.roomName
      || 'My Live Room',
    category: incomingRoom?.category || previousRoom?.category || userData?.roomCategory,
    tags: incomingRoom?.tags || previousRoom?.tags,
    country: incomingRoom?.country || previousRoom?.country || userData?.country,
    seats: incomingRoom?.seats || previousRoom?.seats,
    host: incomingRoom?.host || incomingRoom?.ownerId || previousRoom?.host || previousRoom?.ownerId || {
      _id: userKey(userData),
      username: userData?.username,
      avatar: userData?.avatar || userData?.profilePicture,
      country: userData?.country,
    },
    isLive: Boolean(isLive),
  };
}

function attachPersistentRoom(userData, previousUser = getStoredUser(false)) {
  if (!userData) return userData;
  const room = buildPersistentRoom(userData, previousUser);
  if (!room) return userData;
  persistOwnedRoom(room, userData);
  return {
    ...userData,
    hasActiveRoom: true,
    roomId: room._id,
    roomName: room.title,
    roomStatus: room.isLive ? 'live' : 'offline',
    room,
  };
}

function getStoredUser(withRoom = true) {
  const user = readJson('user');
  if (!user) return user;
  const hostUser = { ...user, isHost: user.isHost ?? true };
  return withRoom ? attachPersistentRoom(hostUser) : hostUser;
}

export const AuthContext = createContext(null);

function persistUser(nextUser) {
  if (!nextUser) {
    localStorage.removeItem('user');
    return nextUser;
  }
  localStorage.setItem('user', JSON.stringify(nextUser));
  if (nextUser.room) persistOwnedRoom(nextUser.room, nextUser);
  return nextUser;
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(getStoredUser);
  const [token, setToken] = useState(localStorage.getItem('token') || null);

  const login = (userData, userToken) => {
    const nextUser = attachPersistentRoom({ ...(userData || {}), isHost: userData?.isHost ?? true });
    setUser(nextUser);
    setToken(userToken);
    localStorage.setItem('token', userToken);
    persistUser(nextUser);
  };

  const updateUser = useCallback((updates) => {
    setUser((current) => persistUser(
      attachPersistentRoom({ ...(current || {}), ...updates, isHost: updates?.isHost ?? current?.isHost ?? true }, current),
    ));
  }, []);

  const updateRoom = useCallback((roomData) => {
    const roomId = String(roomData?._id || roomData?.id || roomData?.roomId || '');
    if (!roomId) throw new Error('A room ID is required to save room details.');
    setUser((current) => {
      const hasLiveFlag = Object.prototype.hasOwnProperty.call(roomData, 'isLive');
      const room = {
        ...(current?.room || {}),
        ...roomData,
        _id: roomId,
        title: roomData.title || roomData.name || current?.roomName || current?.room?.title || 'My Live Room',
        isLive: hasLiveFlag
          ? roomData.isLive === true
          : current?.room?.isLive === true || String(roomData.status || current?.roomStatus || '').toLowerCase() === 'live',
      };
      const nextUser = persistUser({
        ...(current || {}),
        hasActiveRoom: true,
        roomId,
        roomName: room.title,
        roomStatus: room.isLive ? 'live' : 'offline',
        room,
      });
      window.dispatchEvent(new CustomEvent('mesolive-room-updated', { detail: room }));
      return nextUser;
    });
  }, []);

  const updateRoomStatus = useCallback((roomId, isLive) => {
    if (!roomId) return;
    const normalizedId = String(roomId);
    setUser((current) => {
      const currentRoomId = String(current?.roomId || current?.room?._id || '');
      if (currentRoomId && currentRoomId !== normalizedId) return current;
      const room = {
        ...(current?.room || {}),
        _id: currentRoomId || normalizedId,
        title: current?.roomName || current?.room?.title || 'My Live Room',
        isLive: Boolean(isLive),
      };
      return persistUser({
        ...(current || {}),
        hasActiveRoom: true,
        roomId: room._id,
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
    localStorage.removeItem(OWNED_ROOM_KEY);
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