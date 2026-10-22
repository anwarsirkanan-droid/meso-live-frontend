import React from 'react';
import { Mic, MicOff, X } from 'lucide-react';


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
      {/* Live indicator */}
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

      {/* Mic icon — center */}
      <span style={{ fontSize: '20px', color: '#fff' }}>🎙️</span>

      {/* NEW: Mic toggle button — bottom left */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          onToggleMicrophone();
        }}
        title={micEnabled ? 'Mute' : 'Unmute'}
        style={{
          position: 'absolute',
          bottom: '-4px',
          left: '-4px',
          width: '22px',
          height: '22px',
          borderRadius: '50%',
          backgroundColor: micEnabled ? '#10b981' : '#ef4444',
          border: '2px solid #0f0f13',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          padding: 0,
        }}
      >
        {micEnabled ? <Mic size={11} color="#fff" /> : <MicOff size={11} color="#fff" />}
      </button>

      {/* NEW: Close button — bottom right */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          onClose();
        }}
        title="Leave Room"
        style={{
          position: 'absolute',
          bottom: '-4px',
          right: '-4px',
          width: '22px',
          height: '22px',
          borderRadius: '50%',
          backgroundColor: '#ef4444',
          border: '2px solid #0f0f13',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          padding: 0,
        }}
      >
        <X size={11} color="#fff" />
      </button>
    </div>
  );
}