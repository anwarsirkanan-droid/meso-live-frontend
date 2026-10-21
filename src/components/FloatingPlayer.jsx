import { Maximize2, Mic, MicOff, X } from 'lucide-react';

export default function FloatingPlayer({ title, status, micEnabled, onRestore, onToggleMicrophone, onClose }) {
  return (
    <div className="live-room-background-bar">
      <button className="room-mini-control room-mini-title" type="button" onClick={onRestore} aria-label="Restore live room">
        <span className="room-mini-live-indicator" aria-hidden="true" />
        <span>{title || 'Live room'}</span>
      </button>
      <span className="live-room-background-status">{status}</span>
      <button
        className="room-mini-control room-mini-icon-control"
        type="button"
        onClick={onToggleMicrophone}
        aria-label={micEnabled ? 'Mute microphone' : 'Unmute microphone'}
        aria-pressed={!micEnabled}
      >
        {micEnabled ? <Mic size={15} /> : <MicOff size={15} />}
      </button>
      <button className="room-mini-control room-mini-icon-control" type="button" onClick={onRestore} aria-label="Restore live room">
        <Maximize2 size={15} />
      </button>
      <button className="room-mini-control room-mini-close" type="button" onClick={onClose} aria-label="Leave room and close player">
        <X size={16} />
      </button>
    </div>
  );
}
