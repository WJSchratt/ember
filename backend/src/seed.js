import bcrypt from 'bcryptjs';
import { pool } from './db.js';

const INTERESTS = [
  'gaming', 'movies', 'hiking', 'board games', 'cooking', 'live music',
  'running', 'photography', 'reading', 'yoga', 'cycling', 'soccer',
  'basketball', 'painting', 'coffee', 'travel', 'coding', 'anime',
  'dogs', 'karaoke',
];

// Fake users so the match -> room -> chat flow can be tested solo. Interests
// are deliberately overlapping across several categories (not just gaming)
// so AI suggestions and matching have more than one cluster to work with.
// Password for all seed users: password123
const TEST_USERS = [
  { email: 'alice@test.dev', displayName: 'Alice', interests: ['gaming', 'anime', 'coding'] },
  { email: 'bob@test.dev', displayName: 'Bob', interests: ['gaming', 'basketball', 'coffee'] },
  { email: 'carla@test.dev', displayName: 'Carla', interests: ['hiking', 'photography', 'travel'] },
  { email: 'dev@test.dev', displayName: 'Dev', interests: ['gaming', 'board games', 'reading'] },
  { email: 'ellen@test.dev', displayName: 'Ellen', interests: ['soccer', 'running', 'yoga'] },
  { email: 'frank@test.dev', displayName: 'Frank', interests: ['movies', 'karaoke', 'coffee'] },
  { email: 'grace@test.dev', displayName: 'Grace', interests: ['hiking', 'travel', 'cooking'] },
  { email: 'hank@test.dev', displayName: 'Hank', interests: ['movies', 'board games', 'cycling'] },
  { email: 'ivy@test.dev', displayName: 'Ivy', interests: ['coffee', 'dogs'] },
  { email: 'jack@test.dev', displayName: 'Jack', interests: ['live music', 'painting'] },
  { email: 'kate@test.dev', displayName: 'Kate', interests: ['photography', 'reading'] },
  { email: 'liam@test.dev', displayName: 'Liam', interests: ['yoga', 'basketball'] },
  { email: 'mia@test.dev', displayName: 'Mia', interests: ['dogs', 'cooking'] },
];

async function seed() {
  for (const name of INTERESTS) {
    await pool.query(
      'INSERT INTO interests (name) VALUES ($1) ON CONFLICT (name) DO NOTHING',
      [name]
    );
  }

  const passwordHash = await bcrypt.hash('password123', 10);

  for (const user of TEST_USERS) {
    const { rows } = await pool.query(
      `INSERT INTO users (email, password_hash, display_name)
       VALUES ($1, $2, $3)
       ON CONFLICT (email) DO UPDATE SET display_name = EXCLUDED.display_name
       RETURNING id`,
      [user.email, passwordHash, user.displayName]
    );
    const userId = rows[0].id;

    for (const interestName of user.interests) {
      const { rows: interestRows } = await pool.query(
        'SELECT id FROM interests WHERE name = $1',
        [interestName]
      );
      if (interestRows.length === 0) continue;
      await pool.query(
        `INSERT INTO user_interests (user_id, interest_id) VALUES ($1, $2)
         ON CONFLICT DO NOTHING`,
        [userId, interestRows[0].id]
      );
    }
  }

  console.log(`Seeded ${INTERESTS.length} interests and ${TEST_USERS.length} test users (password: password123).`);
  await pool.end();
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
