import { Router } from 'express';
import { pool } from '../db.js';
import { requireAuth } from '../middleware/auth.js';
import { runMatching } from '../services/matching.js';

const router = Router();
router.use(requireAuth);

function isLocked(scheduledAt) {
  return new Date(scheduledAt) <= new Date();
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
      capacity: event.capacity,
      creatorId: event.creator_id,
      locked: isLocked(event.scheduled_at),
    },
    interests,
    members,
    isMember: members.some((m) => m.id === req.user.id),
  });
});

// Re-run matching for an event (e.g. after new users sign up). Idempotent —
// only adds new eligible members, up to capacity.
router.post('/:id/match', async (req, res) => {
  const eventId = Number(req.params.id);
  const { rows } = await pool.query('SELECT id FROM events WHERE id = $1', [eventId]);
  if (rows.length === 0) return res.status(404).json({ error: 'Event not found' });

  const result = await runMatching(eventId);
  const members = await getMembers(eventId);
  res.json({ newlyMatched: result.added, reason: result.reason, members });
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
