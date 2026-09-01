import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import { pool } from './db.js';
import { BOT_EMAIL } from './botUser.js';

const statements = [
  `CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    display_name TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`,
  `CREATE TABLE IF NOT EXISTS interests (
    id SERIAL PRIMARY KEY,
    name TEXT UNIQUE NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS user_interests (
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    interest_id INTEGER NOT NULL REFERENCES interests(id) ON DELETE CASCADE,
    PRIMARY KEY (user_id, interest_id)
  )`,
  `CREATE TABLE IF NOT EXISTS events (
    id SERIAL PRIMARY KEY,
    creator_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    location TEXT,
    scheduled_at TIMESTAMPTZ NOT NULL,
    capacity INTEGER NOT NULL DEFAULT 10,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`,
  `CREATE TABLE IF NOT EXISTS event_interests (
    event_id INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    interest_id INTEGER NOT NULL REFERENCES interests(id) ON DELETE CASCADE,
    PRIMARY KEY (event_id, interest_id)
  )`,
  `CREATE TABLE IF NOT EXISTS room_members (
    event_id INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (event_id, user_id)
  )`,
  // Typing state lives here (not in-process memory) because the backend runs
  // as a stateless Vercel function - Postgres is the only shared state.
  `ALTER TABLE room_members ADD COLUMN IF NOT EXISTS typing_until TIMESTAMPTZ`,
  `CREATE TABLE IF NOT EXISTS messages (
    id SERIAL PRIMARY KEY,
    event_id INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    body TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`,
];

async function migrate() {
  for (const statement of statements) {
    await pool.query(statement);
  }

  // Tether posts AI-generated icebreakers as this unlisted, unloginable bot
  // user. ON CONFLICT updates display_name too so renaming the bot just
  // means changing the literal below and re-running migrations.
  const unusableHash = await bcrypt.hash(crypto.randomUUID(), 10);
  await pool.query(
    `INSERT INTO users (email, password_hash, display_name)
     VALUES ($1, $2, 'Tether')
     ON CONFLICT (email) DO UPDATE SET display_name = EXCLUDED.display_name`,
    [BOT_EMAIL, unusableHash]
  );

  console.log('Migrations complete.');
  await pool.end();
}

migrate().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
