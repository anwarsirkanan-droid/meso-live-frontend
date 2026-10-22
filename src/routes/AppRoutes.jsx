import React, { useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import HomeScreen from '../screens/HomeScreen.jsx';
import LiveRoomPage from '../pages/LiveRoomPage.jsx';
import TaskCenter from '../components/TaskCenter.jsx';
import { getActiveRooms, createRoom } from '../api.js';

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
    <BrowserRouter>
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
        <Route 
          path="/" 
          element={
            <HomeScreen 
              onOpenRoom={(id) => { setActiveRoomId(id); setIsMinimized(false); }} 
              onOpenTasks={() => setShowTaskCenter(true)}
            />
          } 
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}