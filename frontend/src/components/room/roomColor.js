// Fixed palette so a person's avatar color stays the same across renders
// and across other members' screens, instead of being random per mount.
const PALETTE = [
  '#D6FF3F',
  '#9ADCF0',
  '#F0B7A4',
  '#C9C4E8',
  '#F5C77E',
  '#B8E0D2',
  '#E8A6C1',
  '#A8C6E5',
];

function hash(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) | 0;
  return Math.abs(h);
}

export function avatarColor(userId) {
  return PALETTE[hash(String(userId)) % PALETTE.length];
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
