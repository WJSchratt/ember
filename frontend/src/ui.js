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

const AVATAR_HUES = ['accent', 'success', 'warning', 'danger'];

export function avatarHueClass(seed) {
  const n = typeof seed === 'number' ? seed : String(seed || '').length;
  return AVATAR_HUES[n % AVATAR_HUES.length];
}
