import { Router } from 'express';
import { pool } from '../db.js';

const router = Router();

router.get('/', async (_req, res) => {
  const { rows } = await pool.query('SELECT id, name FROM interests ORDER BY name');
  res.json(rows);
});

export default router;
