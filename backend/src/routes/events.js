import { Router } from 'express';
import { pool } from '../db.js';
import { requireAuth } from '../middleware/auth.js';
import { runMatching, countOpenRooms, MAX_OPEN_ROOMS } from '../services/matching.js';
import { generateIcebreaker, suggestEvents } from '../services/ai.js';
import { BOT_EMAIL } from '../botUser.js';

const router = Router();
router.use(requireAuth);

function isLocked(scheduledAt) {
  return new Date(scheduledAt) <= new Date();
}

let botUserId = null;
async function getBotUserId() {
  if (botUserId) return botUserId;
  const { rows } = await pool.query('SELECT id FROM users WHERE email = $1', [BOT_EMAIL]);
  botUserId = rows[0]?.id || null;
  return botUserId;
}

// Posts a one-time AI-generated icebreaker from the Tether bot once a room
// has at least two real members. Failures are swallowed — a slow/unavailable
// LLM should never block matching or event creation.
async function postIcebreakerIfNeeded(eventId) {
  try {
    const bot = await getBotUserId();
    if (!bot) return;

    const already = await pool.query(
      'SELECT 1 FROM messages WHERE event_id = $1 AND user_id = $2',
      [eventId, bot]
    );
    if (already.rows.length > 0) return;

    const members = await getMembers(eventId);
    const realMembers = members.filter((m) => m.id !== bot);
    if (realMembers.length < 2) return;

    const eventResult = await pool.query('SELECT title FROM events WHERE id = $1', [eventId]);
    const interests = await getEventInterests(eventId);

    const text = await generateIcebreaker({
      title: eventResult.rows[0].title,
      interestNames: interests.map((i) => i.name),
      memberNames: realMembers.map((m) => m.displayName),
    });

    await pool.query(
      'INSERT INTO messages (event_id, user_id, body) VALUES ($1, $2, $3)',
      [eventId, bot, text]
    );
  } catch (err) {
    console.error('Icebreaker generation failed:', err.message);
  }
}

async function getEventInterests(eventId) {
  const { rows } = await pool.query(
    `SELECT i.id, i.name FROM interests i
     JOIN event_interests ei ON ei.interest_id = i.id
     WHERE ei.event_id = $1
     ORDER BY i.name`,
    [eventId]
  );
  return rows;
}

async function getMembers(eventId) {
  const { rows } = await pool.query(
    `SELECT u.id, u.display_name AS "displayName"
     FROM room_members rm
     JOIN users u ON u.id = rm.user_id
     WHERE rm.event_id = $1
     ORDER BY rm.joined_at`,
    [eventId]
  );
  return rows;
}

// Create an event, auto-join the creator to its room, and run matching
// immediately so the flow is testable end-to-end without a separate step.
router.post('/', async (req, res) => {
  const { title, description, location, scheduledAt, interestIds } = req.body;
  if (!title || !scheduledAt || !Array.isArray(interestIds) || interestIds.length === 0) {
    return res.status(400).json({ error: 'title, scheduledAt, and at least one interestId are required' });
  }
  if (new Date(scheduledAt) <= new Date()) {
    return res.status(400).json({ error: 'scheduledAt must be in the future' });
  }
  if ((await countOpenRooms(req.user.id)) >= MAX_OPEN_ROOMS) {
    return res.status(400).json({
      error: `You're already in ${MAX_OPEN_ROOMS} open rooms — leave one before starting or joining another.`,
    });
  }

  const client = await pool.connect();
  let eventId;
  try {
    await client.query('BEGIN');
    const eventResult = await client.query(
      `INSERT INTO events (creator_id, title, description, location, scheduled_at)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id`,
      [req.user.id, title, description || null, location || null, scheduledAt]
    );
    eventId = eventResult.rows[0].id;

    for (const interestId of interestIds) {
      await client.query(
        'INSERT INTO event_interests (event_id, interest_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
        [eventId, interestId]
      );
    }

    await client.query(
      'INSERT INTO room_members (event_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
      [eventId, req.user.id]
    );

    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }

  const matchResult = await runMatching(eventId);
  await postIcebreakerIfNeeded(eventId);

  const eventResult = await pool.query('SELECT * FROM events WHERE id = $1', [eventId]);
  const event = eventResult.rows[0];
  const interests = await getEventInterests(eventId);
  const members = await getMembers(eventId);

  res.status(201).json({
    event: {
      id: event.id,
      title: event.title,
      description: event.description,
      location: event.location,
      scheduledAt: event.scheduled_at,
      capacity: event.capacity,
      locked: isLocked(event.scheduled_at),
    },
    interests,
    members,
    newlyMatched: matchResult.added,
  });
});

async function enrich(rows, currentUserId) {
  const out = [];
  for (const e of rows) {
    const interests = await getEventInterests(e.id);
    const members = await getMembers(e.id);
    out.push({
      id: e.id,
      title: e.title,
      description: e.description,
      location: e.location,
      scheduledAt: e.scheduled_at,
      capacity: e.capacity,
      creatorId: e.creator_id,
      memberCount: members.length,
      members,
      interests,
      locked: isLocked(e.scheduled_at),
      isMember: members.some((m) => m.id === currentUserId),
    });
  }
  return out;
}

// Browse all upcoming events (not necessarily ones you're matched into).
router.get('/', async (req, res) => {
  const { rows } = await pool.query('SELECT * FROM events ORDER BY scheduled_at ASC');
  res.json(await enrich(rows, req.user.id));
});

// Events the current user has been matched/invited into (their rooms).
router.get('/mine', async (req, res) => {
  const { rows } = await pool.query(
    `SELECT e.* FROM events e
     JOIN room_members rm ON rm.event_id = e.id
     WHERE rm.user_id = $1
     ORDER BY e.scheduled_at ASC`,
    [req.user.id]
  );
  res.json(await enrich(rows, req.user.id));
});

// AI-generated hangout ideas. Personalized to the signed-in user's own
// interest tags first, weighted by how many OTHER real users share each tag
// (so a suggestion is actually matchable, not just something they like
// alone). Falls back to community-wide top tags if the user has no
// interests yet or none overlap with anyone else. Computed fresh each call.
router.get('/suggestions', async (req, res) => {
  const bot = await getBotUserId();

  const personalResult = await pool.query(
    `SELECT i.name,
            COUNT(*) FILTER (WHERE ui2.user_id IS NOT NULL)::int AS count
     FROM user_interests ui
     JOIN interests i ON i.id = ui.interest_id
     LEFT JOIN user_interests ui2
       ON ui2.interest_id = ui.interest_id
       AND ui2.user_id != $1
       AND ui2.user_id != COALESCE($2, 0)
     WHERE ui.user_id = $1
     GROUP BY i.name
     ORDER BY count DESC, i.name
     LIMIT 10`,
    [req.user.id, bot]
  );

  let interestCountsResult = { rows: personalResult.rows.filter((r) => r.count > 0) };

  if (interestCountsResult.rows.length === 0) {
    interestCountsResult = await pool.query(
      `SELECT i.name, COUNT(*)::int AS count
       FROM user_interests ui
       JOIN interests i ON i.id = ui.interest_id
       WHERE ui.user_id != COALESCE($1, 0)
       GROUP BY i.name
       HAVING COUNT(*) >= 2
       ORDER BY count DESC
       LIMIT 10`,
      [bot]
    );
  }

  if (interestCountsResult.rows.length === 0) {
    return res.json([]);
  }

  const existingTitlesResult = await pool.query(
    'SELECT title FROM events WHERE scheduled_at > now() ORDER BY scheduled_at LIMIT 20'
  );

  let suggestions;
  try {
    suggestions = await suggestEvents({
      interestCounts: interestCountsResult.rows,
      existingTitles: existingTitlesResult.rows.map((r) => r.title),
    });
  } catch (err) {
    console.error('Event suggestion generation failed:', err.message);
    return res.json([]);
  }

  const allInterests = await pool.query('SELECT id, name FROM interests');
  const byName = new Map(allInterests.rows.map((i) => [i.name.toLowerCase(), i.id]));

  const withIds = suggestions
    .map((s) => ({
      title: s.title,
      reason: s.reason,
      interestIds: s.tags.map((t) => byName.get(t.toLowerCase())).filter(Boolean),
      interestNames: s.tags.filter((t) => byName.has(t.toLowerCase())),
    }))
    .filter((s) => s.interestIds.length > 0);

  res.json(withIds);
});

router.get('/:id', async (req, res) => {
  const eventId = Number(req.params.id);
  const { rows } = await pool.query('SELECT * FROM events WHERE id = $1', [eventId]);
  const event = rows[0];
  if (!event) return res.status(404).json({ error: 'Event not found' });

  const interests = await getEventInterests(eventId);
  const members = await getMembers(eventId);

  res.json({
    event: {
      id: event.id,
      title: event.title,
      description: event.description,
      location: event.location,
      scheduledAt: event.scheduled_at,
      createdAt: event.created_at,
      capacity: event.capacity,
      creatorId: event.creator_id,
      locked: isLocked(event.scheduled_at),
    },
    interests,
    members,
    isMember: members.some((m) => m.id === req.user.id),
  });
});

// Ping that the current user is actively composing. Expires itself via
// typing_until so a client that goes away silently stops "typing" without
// needing an explicit stop event.
router.post('/:id/typing', async (req, res) => {
  const eventId = Number(req.params.id);
  const result = await pool.query(
    `UPDATE room_members SET typing_until = now() + interval '3 seconds'
     WHERE event_id = $1 AND user_id = $2`,
    [eventId, req.user.id]
  );
  if (result.rowCount === 0) {
    return res.status(403).json({ error: 'You are not a member of this room' });
  }
  res.status(204).end();
});

router.get('/:id/typing', async (req, res) => {
  const eventId = Number(req.params.id);
  const membership = await pool.query(
    'SELECT 1 FROM room_members WHERE event_id = $1 AND user_id = $2',
    [eventId, req.user.id]
  );
  if (membership.rows.length === 0) {
    return res.status(403).json({ error: 'You are not a member of this room' });
  }

  const { rows } = await pool.query(
    `SELECT u.id, u.display_name AS "displayName"
     FROM room_members rm
     JOIN users u ON u.id = rm.user_id
     WHERE rm.event_id = $1 AND rm.typing_until > now() AND rm.user_id != $2`,
    [eventId, req.user.id]
  );
  res.json(rows);
});

// Re-run matching for an event (e.g. after new users sign up). Idempotent —
// only adds new eligible members, up to capacity.
// "Join" from the UI lands here. It adds the requesting user to the room
// (subject to the same rules event creation enforces: room not locked, tag
// overlap, room not full, and the caller under MAX_OPEN_ROOMS open rooms),
// then tops the room up with other eligible users like it did before.
router.post('/:id/match', async (req, res) => {
  const eventId = Number(req.params.id);
  const { rows } = await pool.query(
    'SELECT id, scheduled_at, capacity FROM events WHERE id = $1',
    [eventId]
  );
  if (rows.length === 0) return res.status(404).json({ error: 'Event not found' });
  const event = rows[0];

  const membership = await pool.query(
    'SELECT 1 FROM room_members WHERE event_id = $1 AND user_id = $2',
    [eventId, req.user.id]
  );
  const alreadyIn = membership.rows.length > 0;

  if (!alreadyIn) {
    if (isLocked(event.scheduled_at)) {
      return res.status(400).json({ error: 'This room has already locked.' });
    }

    if ((await countOpenRooms(req.user.id)) >= MAX_OPEN_ROOMS) {
      return res.status(400).json({
        error: `You're already in ${MAX_OPEN_ROOMS} open rooms — leave one before joining another.`,
      });
    }

    const overlap = await pool.query(
      `SELECT 1 FROM event_interests ei
       JOIN user_interests ui ON ui.interest_id = ei.interest_id
       WHERE ei.event_id = $1 AND ui.user_id = $2
       LIMIT 1`,
      [eventId, req.user.id]
    );
    if (overlap.rows.length === 0) {
      return res.status(400).json({ error: "This room's tags don't match your interests." });
    }

    const count = await pool.query(
      'SELECT COUNT(*)::int AS count FROM room_members WHERE event_id = $1',
      [eventId]
    );
    if (count.rows[0].count >= event.capacity) {
      return res.status(400).json({ error: 'This room is full.' });
    }

    await pool.query(
      'INSERT INTO room_members (event_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
      [eventId, req.user.id]
    );
  }

  const result = await runMatching(eventId);
  await postIcebreakerIfNeeded(eventId);
  const members = await getMembers(eventId);

  const newlyMatched = alreadyIn
    ? result.added
    : [{ id: req.user.id, displayName: req.user.displayName }, ...result.added];

  res.json({ newlyMatched, reason: result.reason, members });
});

// Leave a room you're a member of — frees up one of your MAX_OPEN_ROOMS
// slots. Works on locked rooms too (harmless no-op for the cap, but lets
// someone clear a past room out of their list if they want).
router.post('/:id/leave', async (req, res) => {
  const eventId = Number(req.params.id);
  const result = await pool.query(
    'DELETE FROM room_members WHERE event_id = $1 AND user_id = $2',
    [eventId, req.user.id]
  );
  if (result.rowCount === 0) {
    return res.status(404).json({ error: "You're not a member of this room" });
  }
  res.status(204).end();
});

router.get('/:id/messages', async (req, res) => {
  const eventId = Number(req.params.id);
  const membership = await pool.query(
    'SELECT 1 FROM room_members WHERE event_id = $1 AND user_id = $2',
    [eventId, req.user.id]
  );
  if (membership.rows.length === 0) {
    return res.status(403).json({ error: 'You are not a member of this room' });
  }

  const { rows } = await pool.query(
    `SELECT m.id, m.body, m.created_at AS "createdAt",
            m.user_id AS "userId", u.display_name AS "displayName"
     FROM messages m
     JOIN users u ON u.id = m.user_id
     WHERE m.event_id = $1
     ORDER BY m.created_at ASC`,
    [eventId]
  );
  res.json(rows);
});

router.post('/:id/messages', async (req, res) => {
  const eventId = Number(req.params.id);
  const { body } = req.body;
  if (!body || !body.trim()) return res.status(400).json({ error: 'Message body is required' });

  const eventResult = await pool.query('SELECT scheduled_at FROM events WHERE id = $1', [eventId]);
  const event = eventResult.rows[0];
  if (!event) return res.status(404).json({ error: 'Event not found' });
  if (isLocked(event.scheduled_at)) {
    return res.status(403).json({ error: 'This room is locked; the event has already happened' });
  }

  const membership = await pool.query(
    'SELECT 1 FROM room_members WHERE event_id = $1 AND user_id = $2',
    [eventId, req.user.id]
  );
  if (membership.rows.length === 0) {
    return res.status(403).json({ error: 'You are not a member of this room' });
  }

  const { rows } = await pool.query(
    `INSERT INTO messages (event_id, user_id, body) VALUES ($1, $2, $3)
     RETURNING id, body, created_at AS "createdAt", user_id AS "userId"`,
    [eventId, req.user.id, body.trim()]
  );
  res.status(201).json({ ...rows[0], displayName: req.user.displayName });
});

export default router;
