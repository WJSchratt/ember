import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import 'express-async-errors';
import authRoutes from './routes/auth.js';
import meRoutes from './routes/me.js';
import interestRoutes from './routes/interests.js';
import eventRoutes from './routes/events.js';
import pickupRoutes from './routes/pickup.js';
import { PICKUP_ONLY } from './flags.js';

const app = express();

app.use(cors({ origin: process.env.CORS_ORIGIN || '*' }));
app.use(express.json());

app.get('/api/health', (_req, res) => res.json({ ok: true, pickupOnly: PICKUP_ONLY }));
app.use('/api/pickup', pickupRoutes);

// Pickup-only mode: the legacy app (accounts, rooms, chat, AI) is paused, not
// deleted. Its routes stay mounted below but are short-circuited here first,
// which also guarantees no Anthropic calls happen while the flag is on.
if (PICKUP_ONLY) {
  app.use(['/api/auth', '/api/me', '/api/interests', '/api/events'], (_req, res) =>
    res.status(503).json({ error: 'This part of Tether is paused for now.' })
  );
}

app.use('/api/auth', authRoutes);
app.use('/api/me', meRoutes);
app.use('/api/interests', interestRoutes);
app.use('/api/events', eventRoutes);

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
});

export default app;
