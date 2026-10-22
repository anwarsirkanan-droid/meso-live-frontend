import React from 'react';
import { Mic, MicOff } from 'lucide-react';

export default function FloatingPlayer({
  title = 'Live Room',
  micEnabled = true,
  onRestore = () => {},
  onToggleMicrophone = () => {},
  onClose = () => {},
}) {
  return (
    <div
      onClick={onRestore}
      title="Restore Room"
      style={{
        position: 'fixed',
        bottom: '90px',
        right: '20px',
        width: '56px',
        height: '56px',
        borderRadius: '50%',
        background: 'linear-gradient(135deg, #a855f7, #ec4899)',
        boxShadow: '0 6px 16px rgba(0,0,0,0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 999999,
        cursor: 'pointer',
        border: '2px solid #f59e0b',
        animation: 'pulse 2s infinite',
      }}
    >
      <div
        style={{
          position: 'absolute',
          top: '-2px',
          right: '-2px',
          width: '14px',
          height: '14px',
          borderRadius: '50%',
          backgroundColor: '#10b981',
          border: '2px solid #0f0f13',
        }}
      />
      <span style={{ fontSize: '20px', color: '#fff' }}>🎙️</span>
    </div>
  );
}