const BASE = `${import.meta.env.VITE_API_URL || ''}/api/pickup`;

async function request(path, { method = 'GET', body, headers = {} } = {}) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...headers },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (res.status === 204) return null;
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error(data?.error || `Request failed (${res.status})`);
  return data;
}

const admin = (passcode) => ({ 'x-admin-passcode': passcode });

export const pickupApi = {
  games: () => request('/games'),
  rsvp: (body) => request('/rsvps', { method: 'POST', body }),
  cancel: (id, cancelToken) => request(`/rsvps/${id}`, { method: 'DELETE', body: { cancelToken } }),

  adminCheck: (pc) => request('/admin/check', { headers: admin(pc) }),
  adminGames: (pc) => request('/admin/games', { headers: admin(pc) }),
  createGame: (pc, body) => request('/admin/games', { method: 'POST', body, headers: admin(pc) }),
  updateGame: (pc, id, body) => request(`/admin/games/${id}`, { method: 'PATCH', body, headers: admin(pc) }),
  setDate: (pc, id, date, body) =>
    request(`/admin/games/${id}/dates/${date}`, { method: 'PUT', body, headers: admin(pc) }),
  deleteRsvp: (pc, id) => request(`/admin/rsvps/${id}`, { method: 'DELETE', headers: admin(pc) }),
};

// ---- formatting ('YYYY-MM-DD' / 'HH:MM' are field-local; format in UTC to avoid shifts)

export const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export function fmtDate(dateStr, opts = { weekday: 'short', month: 'short', day: 'numeric' }) {
  return new Date(`${dateStr}T12:00:00Z`).toLocaleDateString('en-US', { ...opts, timeZone: 'UTC' });
}

export function fmtTime(hhmm) {
  const [h, m] = hhmm.split(':').map(Number);
  return `${((h + 11) % 12) + 1}:${String(m).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`;
}

// ---- "my spots": cancel tokens live only in this browser

const KEY = 'pickup_rsvps';

export function mySpots() {
  try {
    return JSON.parse(localStorage.getItem(KEY)) || [];
  } catch {
    return [];
  }
}

export function saveSpot(spot) {
  localStorage.setItem(KEY, JSON.stringify([...mySpots(), spot]));
}

export function removeSpot(id) {
  localStorage.setItem(KEY, JSON.stringify(mySpots().filter((s) => s.id !== id)));
}

// ---- schedule helpers

const weekdayOf = (dateStr) => DAYS[new Date(`${dateStr}T12:00:00Z`).getUTCDay()];
const shortTime = (hhmm) => fmtTime(hhmm).replace(':00', '');

/** "Tuesdays, 6 PM and 7:30 PM" from the recurring slots in a list of occurrences. */
export function scheduleLine(occurrences) {
  const byDay = new Map();
  for (const o of occurrences) {
    if (!o.recurring) continue;
    const day = weekdayOf(o.date);
    if (!byDay.has(day)) byDay.set(day, new Set());
    byDay.get(day).add(o.startTime);
  }
  return [...byDay]
    .map(([day, times]) => `${day}s, ${[...times].sort().map(shortTime).join(' and ')}`)
    .join('; ');
}

/** Group occurrences (already date/time sorted) into [{ date, slots: [...] }]. */
export function groupByDate(occurrences) {
  const out = [];
  for (const o of occurrences) {
    const last = out[out.length - 1];
    if (last && last.date === o.date) last.slots.push(o);
    else out.push({ date: o.date, slots: [o] });
  }
  return out;
}

export const slotKey = (o) => `${o.gameId}:${o.date}`;
