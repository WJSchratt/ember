// Must match backend/src/services/matching.js MAX_OPEN_ROOMS.
export const MAX_OPEN_ROOMS = 2;

const ICONS = {
  gaming: 'device-gamepad-2',
  movies: 'movie',
  hiking: 'mountain',
  'board games': 'chess',
  cooking: 'tools-kitchen-2',
  'live music': 'music',
  running: 'run',
  photography: 'camera',
  reading: 'book-2',
  yoga: 'yoga',
  cycling: 'bike',
  soccer: 'ball-football',
  basketball: 'basketball',
  painting: 'palette',
  coffee: 'coffee',
  travel: 'plane',
  coding: 'code',
  anime: 'device-tv',
  dogs: 'paw',
  karaoke: 'microphone-2',
};

export function iconForInterest(name) {
  return ICONS[name?.toLowerCase()] || 'sparkles';
}

export function initials(name) {
  if (!name) return '?';
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join('');
}

const GRADIENTS = ['grad-1', 'grad-2', 'grad-3', 'grad-4', 'grad-5', 'grad-6'];

function hash(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) | 0;
  return Math.abs(h);
}

export function avatarHueClass(seed) {
  const n = typeof seed === 'number' ? seed : hash(String(seed || ''));
  return GRADIENTS[n % GRADIENTS.length];
}

export function iconGradientClass(interestName) {
  return GRADIENTS[hash(interestName || '') % GRADIENTS.length];
}

// Live "starts in Xh Ym" style label, falling back to a date once it's far
// enough out that a countdown stops being useful.
export function countdownLabel(scheduledAt, locked) {
  if (locked) return 'Started';
  const diffMs = new Date(scheduledAt).getTime() - Date.now();
  if (diffMs <= 0) return 'Starting now';

  const totalMinutes = Math.floor(diffMs / 60000);
  if (totalMinutes < 60) return `Starts in ${totalMinutes}m`;

  const totalHours = Math.floor(totalMinutes / 60);
  if (totalHours < 24) {
    const mins = totalMinutes % 60;
    return `Starts in ${totalHours}h ${mins}m`;
  }

  const days = Math.floor(totalHours / 24);
  if (days < 7) return `Starts in ${days}d`;

  return `Starts ${new Date(scheduledAt).toLocaleDateString([], { month: 'short', day: 'numeric' })}`;
}
