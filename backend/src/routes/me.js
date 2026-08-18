import { Router } from 'express';
import { pool } from '../db.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth);

router.get('/', async (req, res) => {
  const userResult = await pool.query(
    'SELECT id, email, display_name AS "displayName", created_at AS "createdAt" FROM users WHERE id = $1',
    [req.user.id]
  );
  const interestsResult = await pool.query(
    `SELECT i.id, i.name FROM interests i
     JOIN user_interests ui ON ui.interest_id = i.id
     WHERE ui.user_id = $1
     ORDER BY i.name`,
    [req.user.id]
  );
  res.json({
    user: userResult.rows[0],
    interests: interestsResult.rows,
  });
});

router.put('/interests', async (req, res) => {
  const { interestIds } = req.body;
  if (!Array.isArray(interestIds)) {
    return res.status(400).json({ error: 'interestIds must be an array' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('DELETE FROM user_interests WHERE user_id = $1', [req.user.id]);
    for (const interestId of interestIds) {
      await client.query(
        'INSERT INTO user_interests (user_id, interest_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
        [req.user.id, interestId]
      );
    }
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }

  res.status(204).end();
});

export default router;
