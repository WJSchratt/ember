import { useEffect, useState } from 'react';
import { countdownLabel } from './ui.js';

export default function Countdown({ scheduledAt, locked, className }) {
  const [, tick] = useState(0);

  useEffect(() => {
    if (locked) return;
    const interval = setInterval(() => tick((n) => n + 1), 30000);
    return () => clearInterval(interval);
  }, [locked]);

  return <span className={className}>{countdownLabel(scheduledAt, locked)}</span>;
}
