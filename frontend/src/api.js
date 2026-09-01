// In local dev this stays '/api' and Vite proxies it to localhost:4000.
// In production it points at the deployed ember-api Vercel project.
const BASE = `${import.meta.env.VITE_API_URL || ''}/api`;

async function request(path, { method = 'GET', body, token } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  if (res.status === 204) return null;

  const data = await res.json().catch(() => null);
  if (!res.ok) {
    throw new Error(data?.error || `Request failed (${res.status})`);
  }
  return data;
}

export const api = {
  signup: (body) => request('/auth/signup', { method: 'POST', body }),
  login: (body) => request('/auth/login', { method: 'POST', body }),
  me: (token) => request('/me', { token }),
  updateMyInterests: (token, interestIds) =>
    request('/me/interests', { method: 'PUT', body: { interestIds }, token }),
  interests: () => request('/interests'),
  createEvent: (token, body) => request('/events', { method: 'POST', body, token }),
  events: (token) => request('/events', { token }),
  suggestions: (token) => request('/events/suggestions', { token }),
  myEvents: (token) => request('/events/mine', { token }),
  event: (token, id) => request(`/events/${id}`, { token }),
  matchEvent: (token, id) => request(`/events/${id}/match`, { method: 'POST', token }),
  leaveRoom: (token, id) => request(`/events/${id}/leave`, { method: 'POST', token }),
  messages: (token, id) => request(`/events/${id}/messages`, { token }),
  sendMessage: (token, id, body) =>
    request(`/events/${id}/messages`, { method: 'POST', body: { body }, token }),
  typingUsers: (token, id) => request(`/events/${id}/typing`, { token }),
  pingTyping: (token, id) => request(`/events/${id}/typing`, { method: 'POST', token }),
};
