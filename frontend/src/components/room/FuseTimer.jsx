import { useEffect, useState } from 'react';

// Purely a display for server state: scheduledAt is the moment the backend
// locks the room (see isLocked in backend/src/routes/events.js), and
// createdAt anchors what "full" looks like. The client never invents its
// own end time, it only re-renders a countdown to timestamps the server
// already sent.
function formatRemaining(ms) {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  if (totalSeconds < 3600) {
    const m = Math.floor(totalSeconds / 60);
    const s = totalSeconds % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }
  const totalMinutes = Math.floor(totalSeconds / 60);
  const hours = Math.floor(totalMinutes / 60);
  if (hours < 24) return `${hours}h ${totalMinutes % 60}m`;
  return `${Math.floor(hours / 24)}d`;
}

export default function FuseTimer({ scheduledAt, createdAt, locked }) {
  const [, tick] = useState(0);

  useEffect(() => {
    if (locked) return;
    const interval = setInterval(() => tick((n) => n + 1), 1000);
    return () => clearInterval(interval);
  }, [locked]);

  const target = new Date(scheduledAt).getTime();
  const start = createdAt ? new Date(createdAt).getTime() : target;
  const now = Date.now();
  const remainingMs = target - now;
  const totalMs = Math.max(target - start, 1);
  const percent = locked || remainingMs <= 0 ? 0 : Math.min(100, Math.max(0, (remainingMs / totalMs) * 100));

  return (
    <div className="fuse-wrap">
      <div className="fuse-track">
        <div
          className={`fuse-fill${locked || remainingMs <= 0 ? ' closed' : ''}`}
          style={{ width: `${percent}%` }}
        />
      </div>
      <div className="fuse-label">
        <span className="fuse-count">
          {locked || remainingMs <= 0 ? 'Closed' : `${formatRemaining(remainingMs)} left`}
        </span>
        <span>{locked || remainingMs <= 0 ? 'this room has ended' : 'closes when the event starts'}</span>
      </div>
    </div>
  );
}
