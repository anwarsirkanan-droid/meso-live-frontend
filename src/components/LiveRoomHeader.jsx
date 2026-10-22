import { ChevronDown, Plus, X } from 'lucide-react';

export default function LiveRoomHeader({ 
  room, 
  host, 
  hostPublicId, 
  statusLabel, 
  isMinimized, 
  onMinimize, 
  onClose,
  onFollow,
  isFollowed = false
}) {
  return (
    <header style={{ position: 'relative', zIndex: 10, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', backgroundColor: 'rgba(0,0,0,0.5)', padding: '4px 10px', borderRadius: '9999px', border: '1px solid rgba(255,255,255,0.1)' }}>
        {host?.avatar || host?.profilePicture
          ? <img src={host.avatar || host.profilePicture} alt="" style={{ width: '32px', height: '32px', borderRadius: '50%', objectFit: 'cover' }} />
          : <span style={{ width: '32px', height: '32px', borderRadius: '50%', backgroundColor: '#8b5cf6', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold' }}>
              {host?.username?.[0]?.toUpperCase() || 'M'}
            </span>}
        
        {onFollow && (
          <button 
            onClick={onFollow}
            style={{ backgroundColor: isFollowed ? '#10b981' : '#ec4899', color: '#fff', border: 'none', borderRadius: '9999px', padding: '3px 8px', fontSize: '10px', cursor: 'pointer', marginLeft: '4px', fontWeight: 'bold' }}
            aria-label="Follow host"
          >
            {isFollowed ? '✓' : '+ Follow'}
          </button>
        )}
        
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <span style={{ fontSize: '11px', fontWeight: 'bold' }}>{host?.username || room?.title || 'Live Room'}</span>
          <span style={{ fontSize: '9px', color: '#9ca3af' }}>ID: {hostPublicId}</span>
        </div>
      </div>
      
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <button onClick={onMinimize} style={{ backgroundColor: 'rgba(0,0,0,0.5)', color: '#fff', border: 'none', padding: '8px', borderRadius: '50%', cursor: 'pointer' }} aria-label="Minimize room">
          <ChevronDown size={18} />
        </button>
        <button onClick={onClose} style={{ backgroundColor: '#ef4444', color: '#fff', border: 'none', padding: '8px', borderRadius: '50%', cursor: 'pointer' }} aria-label="Close room">
          <X size={18} />
        </button>
      </div>
    </header>
  );
}
