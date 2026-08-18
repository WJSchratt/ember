import pg from 'pg';
import 'dotenv/config';

const { Pool } = pg;

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  // Serverless functions run many short-lived instances; a small pool per
  // instance plus Neon's pooled connection string keeps us under its limits.
  max: process.env.VERCEL ? 3 : 10,
});

export const query = (text, params) => pool.query(text, params);
