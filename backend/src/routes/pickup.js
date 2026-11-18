// McGuire Fields pickup soccer: public game list + account-free RSVPs, and a
// passcode-gated admin for game days. No accounts, no AI, no payments.
import crypto from 'node:crypto';
import { Router } from 'express';
import { query } from '../db.js';
import { isValidOccurrence, nowInTz, upcomingOccurrences, PICKUP_TZ } from '../pickup/schedule.js';

const router = Router();

const GAME_COLS = `id, title, location, recurring, day_of_week, start_time,
  to_char(game_date, 'YYYY-MM-DD') AS game_date, note, active`;

const sha256 = (s) => crypto.createHash('sha256').update(s).digest('hex');
const firstName = (name) => name.trim().split(/\s+/)[0];
const clean = (v, max) => (typeof v === 'string' ? v.trim().slice(0, max) : '');

async function loadGames({ includeInactive = false } = {}) {
  const { rows } = await query(
    `SELECT ${GAME_COLS} FROM pickup_games ${includeInactive ? '' : 'WHERE active'} ORDER BY id`
  );
  return rows;
}

// Expand games into dated occurrences with per-date overrides + RSVPs attached.
async function buildOccurrences(games, { days, withContact = false }) {
  const occ = upcomingOccurrences(games, { days });
  if (!occ.length) return [];
  const gameIds = [...new Set(occ.map((o) => o.game.id))];
  const dates = [...new Set(occ.map((o) => o.date))];

  const overrides = await query(
    `SELECT game_id, to_char(game_date, 'YYYY-MM-DD') AS game_date, cancelled, note
     FROM pickup_date_overrides WHERE game_id = ANY($1) AND game_date = ANY($2::date[])`,
    [gameIds, dates]
  );
  const rsvps = await query(
    `SELECT id, game_id, to_char(game_date, 'YYYY-MM-DD') AS game_date, name, contact,
            waiver_accepted_at, created_at
     FROM pickup_rsvps
     WHERE cancelled_at IS NULL AND game_id = ANY($1) AND game_date = ANY($2::date[])
     ORDER BY created_at`,
    [gameIds, dates]
  );

  return occ.map(({ game, date }) => {
    const ov = overrides.rows.find((o) => o.game_id === game.id && o.game_date === date);
    const people = rsvps.rows.filter((r) => r.game_id === game.id && r.game_date === date);
    return {
      gameId: game.id,
      date,
      startTime: game.start_time,
      title: game.title,
      location: game.location,
      recurring: game.recurring,
      gameNote: game.note,
      cancelled: Boolean(ov?.cancelled),
      dateNote: ov?.note || null,
      count: people.length,
      players: people.map((p) =>
        withContact
          ? { id: p.id, name: p.name, contact: p.contact, waiverAcceptedAt: p.waiver_accepted_at }
          : { id: p.id, firstName: firstName(p.name) }
      ),
    };
  });
}

// ---------- public ----------

router.get('/games', async (req, res) => {
  const days = Math.min(Math.max(Number(req.query.days) || 28, 1), 90);
  const games = await loadGames();
  res.json({ timezone: PICKUP_TZ, occurrences: await buildOccurrences(games, { days }) });
});

router.post('/rsvps', async (req, res) => {
  const gameId = Number.parseInt(req.body?.gameId, 10) || 0;
  const date = clean(req.body?.date, 10);
  const name = clean(req.body?.name, 40);
  const contact = clean(req.body?.contact, 120) || null;

  if (req.body?.waiverAccepted !== true) {
    return res.status(400).json({ error: 'Please check the play-at-your-own-risk box to sign up.' });
  }
  if (!name) return res.status(400).json({ error: 'Name is required.' });

  const { rows } = await query(`SELECT ${GAME_COLS} FROM pickup_games WHERE id = $1`, [gameId]);
  const game = rows[0];
  if (!game || !isValidOccurrence(game, date, nowInTz())) {
    return res.status(400).json({ error: 'That game day is not open for sign-up.' });
  }
  const ov = await query(
    `SELECT cancelled FROM pickup_date_overrides WHERE game_id = $1 AND game_date = $2`,
    [gameId, date]
  );
  if (ov.rows[0]?.cancelled) return res.status(400).json({ error: 'That game day is cancelled.' });

  const cancelToken = crypto.randomBytes(24).toString('base64url');
  const inserted = await query(
    `INSERT INTO pickup_rsvps (game_id, game_date, name, contact, waiver_accepted_at, cancel_token_hash)
     VALUES ($1, $2, $3, $4, now(), $5)
     RETURNING id, waiver_accepted_at`,
    [gameId, date, name, contact, sha256(cancelToken)]
  );
  const r = inserted.rows[0];
  res.status(201).json({ id: r.id, gameId, date, cancelToken, waiverAcceptedAt: r.waiver_accepted_at });
});

// Cancel your own spot with the token handed back at sign-up (kept in localStorage).
// Soft-cancel so the waiver acceptance record is retained.
router.delete('/rsvps/:id', async (req, res) => {
  const token = clean(req.body?.cancelToken || req.headers['x-cancel-token'], 100);
  if (!token) return res.status(400).json({ error: 'Missing cancel token.' });
  const result = await query(
    `UPDATE pickup_rsvps SET cancelled_at = now()
     WHERE id = $1 AND cancel_token_hash = $2 AND cancelled_at IS NULL`,
    [Number(req.params.id), sha256(token)]
  );
  if (!result.rowCount) return res.status(404).json({ error: 'Sign-up not found or already cancelled.' });
  res.status(204).end();
});

// ---------- admin (ADMIN_PASSCODE) ----------

function requireAdmin(req, res, next) {
  const expected = process.env.ADMIN_PASSCODE;
  if (!expected) return res.status(503).json({ error: 'Admin is disabled (ADMIN_PASSCODE not set).' });
  const given = String(req.headers['x-admin-passcode'] || '');
  // Compare fixed-length digests so timingSafeEqual never throws on length mismatch.
  if (!crypto.timingSafeEqual(Buffer.from(sha256(given)), Buffer.from(sha256(expected)))) {
    return res.status(401).json({ error: 'Wrong passcode.' });
  }
  next();
}

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function parseGame(body, existing) {
  const g = { ...existing };
  if (body.title !== undefined) g.title = clean(body.title, 80) || 'Pickup Soccer';
  if (body.location !== undefined) g.location = clean(body.location, 120) || 'McGuire Fields';
  if (body.note !== undefined) g.note = clean(body.note, 200) || null;
  if (body.startTime !== undefined) g.start_time = body.startTime;
  if (body.recurring !== undefined) g.recurring = Boolean(body.recurring);
  if (body.dayOfWeek !== undefined) {
    g.day_of_week = body.dayOfWeek === null || body.dayOfWeek === '' ? null : Number(body.dayOfWeek);
  }
  if (body.date !== undefined) g.game_date = body.date || null;
  if (body.active !== undefined) g.active = Boolean(body.active);

  if (!TIME_RE.test(g.start_time || '')) return { error: 'Time must be HH:MM (24h).' };
  if (g.recurring) {
    if (!(Number.isInteger(g.day_of_week) && g.day_of_week >= 0 && g.day_of_week <= 6)) {
      return { error: 'Recurring games need a day of the week.' };
    }
    g.game_date = null;
  } else {
    if (!DATE_RE.test(g.game_date || '')) return { error: 'One-off games need a date.' };
    g.day_of_week = null;
  }
  return { game: g };
}

router.get('/admin/check', requireAdmin, (_req, res) => res.json({ ok: true }));

router.get('/admin/games', requireAdmin, async (req, res) => {
  const days = Math.min(Math.max(Number(req.query.days) || 42, 1), 120);
  const games = await loadGames({ includeInactive: true });
  res.json({
    timezone: PICKUP_TZ,
    games,
    occurrences: await buildOccurrences(games, { days, withContact: true }),
  });
});

router.post('/admin/games', requireAdmin, async (req, res) => {
  const { game, error } = parseGame(req.body || {}, {
    title: 'Pickup Soccer', location: 'McGuire Fields', recurring: true, active: true, note: null,
  });
  if (error) return res.status(400).json({ error });
  const { rows } = await query(
    `INSERT INTO pickup_games (title, location, recurring, day_of_week, start_time, game_date, note, active)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id`,
    [game.title, game.location, game.recurring, game.day_of_week, game.start_time, game.game_date, game.note, game.active]
  );
  res.status(201).json({ id: rows[0].id });
});

router.patch('/admin/games/:id', requireAdmin, async (req, res) => {
  const { rows } = await query(`SELECT ${GAME_COLS} FROM pickup_games WHERE id = $1`, [Number(req.params.id)]);
  if (!rows[0]) return res.status(404).json({ error: 'Game not found.' });
  const { game, error } = parseGame(req.body || {}, rows[0]);
  if (error) return res.status(400).json({ error });
  await query(
    `UPDATE pickup_games SET title=$2, location=$3, recurring=$4, day_of_week=$5, start_time=$6,
       game_date=$7, note=$8, active=$9, updated_at=now() WHERE id=$1`,
    [game.id, game.title, game.location, game.recurring, game.day_of_week, game.start_time, game.game_date, game.note, game.active]
  );
  res.json({ ok: true });
});

// Per-date override: cancel/restore one date of a game and/or attach a note ("rained out").
router.put('/admin/games/:id/dates/:date', requireAdmin, async (req, res) => {
  const date = req.params.date;
  if (!DATE_RE.test(date)) return res.status(400).json({ error: 'Bad date.' });
  await query(
    `INSERT INTO pickup_date_overrides (game_id, game_date, cancelled, note)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (game_id, game_date)
     DO UPDATE SET cancelled = EXCLUDED.cancelled, note = EXCLUDED.note, updated_at = now()`,
    [Number(req.params.id), date, Boolean(req.body?.cancelled), clean(req.body?.note, 200) || null]
  );
  res.json({ ok: true });
});

// Hard-delete a sign-up (e.g. a deletion request from the privacy page).
router.delete('/admin/rsvps/:id', requireAdmin, async (req, res) => {
  const result = await query(`DELETE FROM pickup_rsvps WHERE id = $1`, [Number(req.params.id)]);
  if (!result.rowCount) return res.status(404).json({ error: 'Not found.' });
  res.status(204).end();
});

export default router;
