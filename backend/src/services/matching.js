import { pool } from '../db.js';

// A user can hold at most this many *open* (not-yet-happened) room
// memberships at once. Leaving a room (or letting one lock) frees a slot.
export const MAX_OPEN_ROOMS = 2;

// v1 matching: plain tag-overlap, no ranking/AI.
// A user is eligible for an event's room if:
//   - they share at least one interest tag with the event
//   - they aren't already in this event's room
//   - they aren't already at MAX_OPEN_ROOMS open room memberships
// Rooms fill up to the event's capacity (default 10, includes the creator).
export async function runMatching(eventId) {
  const eventResult = await pool.query(
    'SELECT id, scheduled_at, capacity FROM events WHERE id = $1',
    [eventId]
  );
  const event = eventResult.rows[0];
  if (!event) throw new Error('Event not found');
  if (new Date(event.scheduled_at) <= new Date()) {
    return { added: [], reason: 'Event room is already locked' };
  }

  const interestResult = await pool.query(
    'SELECT interest_id FROM event_interests WHERE event_id = $1',
    [eventId]
  );
  const interestIds = interestResult.rows.map((r) => r.interest_id);
  if (interestIds.length === 0) {
    return { added: [], reason: 'Event has no interest tags' };
  }

  const countResult = await pool.query(
    'SELECT COUNT(*)::int AS count FROM room_members WHERE event_id = $1',
    [eventId]
  );
  const remainingCapacity = event.capacity - countResult.rows[0].count;
  if (remainingCapacity <= 0) {
    return { added: [], reason: 'Room is full' };
  }

  const eligibleResult = await pool.query(
    `SELECT id, display_name FROM (
       SELECT DISTINCT u.id, u.display_name
       FROM users u
       JOIN user_interests ui ON ui.user_id = u.id
       WHERE ui.interest_id = ANY($1::int[])
         AND u.id NOT IN (SELECT user_id FROM room_members WHERE event_id = $2)
         AND u.id NOT IN (
           SELECT rm.user_id
           FROM room_members rm
           JOIN events e ON e.id = rm.event_id
           WHERE e.scheduled_at > now()
           GROUP BY rm.user_id
           HAVING COUNT(*) >= $4
         )
     ) matched
     ORDER BY random()
     LIMIT $3`,
    [interestIds, eventId, remainingCapacity, MAX_OPEN_ROOMS]
  );

  const added = [];
  for (const user of eligibleResult.rows) {
    await pool.query(
      `INSERT INTO room_members (event_id, user_id) VALUES ($1, $2)
       ON CONFLICT DO NOTHING`,
      [eventId, user.id]
    );
    added.push({ id: user.id, displayName: user.display_name });
  }

  return { added, reason: added.length ? null : 'No eligible users matched the tags' };
}

export async function countOpenRooms(userId) {
  const { rows } = await pool.query(
    `SELECT COUNT(*)::int AS count
     FROM room_members rm
     JOIN events e ON e.id = rm.event_id
     WHERE rm.user_id = $1 AND e.scheduled_at > now()`,
    [userId]
  );
  return rows[0].count;
}
