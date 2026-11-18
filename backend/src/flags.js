// PICKUP_ONLY strips Tether down to the McGuire Fields pickup soccer sign-up.
// On by default: only the literal string "false" turns the full app back on.
// While on, every legacy API route (auth, interests, events/rooms/chat) answers
// 503 before its handler runs, so none of the Anthropic-backed features
// (icebreakers, @Tether replies, suggestions) can be reached - zero AI spend.
// The legacy code, routes and tables are untouched and come back with the flag.
export const PICKUP_ONLY = process.env.PICKUP_ONLY !== 'false';
