// VITE_PICKUP_ONLY strips the app down to the McGuire Fields pickup soccer
// sign-up. On by default; only the literal "false" restores the full Tether
// app (login, interests, rooms, chat, AI). Build-time flag (Vite inlines it),
// so flipping it in production means a rebuild/redeploy of the frontend.
// Pair it with the backend's PICKUP_ONLY so the legacy API is reachable too.
export const PICKUP_ONLY = import.meta.env.VITE_PICKUP_ONLY !== 'false';

// Where the QR code / printed sign points.
export const PUBLIC_URL = import.meta.env.VITE_PUBLIC_URL || 'https://ember-web-three.vercel.app';

// Shown on the privacy page as the deletion-request contact. Optional.
export const CONTACT_EMAIL = import.meta.env.VITE_CONTACT_EMAIL || '';
