import React from 'react';

export default function TaskCenter({ onGoToRoom, onClose }) {
  const tasks = [
    {
      id: 'task_daily_login',
      title: 'Daily Login',
      description: 'Open Meso Live today.',
      reward: '50 coins',
      progress: '0/1',
      actionType: 'login'
    },
    {
      id: 'task_send_gift',
      title: 'Send a Gift',
      description: 'Send one gift in a live room.',
      reward: '100 coins',
      progress: '0/1',
      actionType: 'join_room'
    }
  ];

  const handleGoClick = (task) => {
    if (task.actionType === 'join_room') {
      // Live Room saaquuf handler waama
      onGoToRoom();
    } else {
      alert("Task completed or already logged in!");
    }
  };

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      backgroundColor: '#090a10',
      color: '#ffffff',
      zIndex: 99999,
      padding: '16px',
      overflowY: 'auto',
      fontFamily: 'sans-serif'
    }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h2 style={{ fontSize: '22px', fontWeight: 'bold' }}>Task Center</h2>
        <button onClick={onClose} style={{ backgroundColor: 'transparent', border: 'none', color: '#fff', fontSize: '20px', cursor: 'pointer' }}>✕</button>
      </header>

      {/* Points & Coins Cards */}
      <div style={{ backgroundColor: '#161822', padding: '16px', borderRadius: '14px', marginBottom: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ color: '#9ca3af', fontSize: '14px' }}>Total points</span>
        <span style={{ fontSize: '24px', fontWeight: 'bold' }}>0</span>
      </div>

      {/* Task List */}
      <div style={{ backgroundColor: '#161822', padding: '16px', borderRadius: '16px' }}>
        <h3 style={{ fontSize: '16px', fontWeight: 'bold', marginBottom: '16px' }}>Daily Tasks</h3>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {tasks.map((task) => (
            <div key={task.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '12px' }}>
              <div>
                <h4 style={{ fontSize: '14px', fontWeight: 'bold', margin: '0 0 4px 0' }}>{task.title}</h4>
                <p style={{ fontSize: '11px', color: '#9ca3af', margin: '0 0 6px 0' }}>{task.description}</p>
                <span style={{ fontSize: '12px', color: '#a855f7', fontWeight: 'bold' }}>{task.reward}</span>
              </div>

              {/* "Go" Button -> Action triggers room navigation */}
              <button
                onClick={() => handleGoClick(task)}
                style={{
                  backgroundColor: '#8b5cf6',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '9999px',
                  padding: '8px 20px',
                  fontWeight: 'bold',
                  fontSize: '13px',
                  cursor: 'pointer',
                  boxShadow: '0 4px 12px rgba(139, 92, 246, 0.4)'
                }}
              >
                Go
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}