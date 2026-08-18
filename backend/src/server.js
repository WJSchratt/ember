import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import 'express-async-errors';
import authRoutes from './routes/auth.js';
import meRoutes from './routes/me.js';
import interestRoutes from './routes/interests.js';
import eventRoutes from './routes/events.js';

const app = express();

app.use(cors({ origin: process.env.CORS_ORIGIN || '*' }));
app.use(express.json());

app.get('/api/health', (_req, res) => res.json({ ok: true }));
app.use('/api/auth', authRoutes);
app.use('/api/me', meRoutes);
app.use('/api/interests', interestRoutes);
app.use('/api/events', eventRoutes);

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
});

const port = process.env.PORT || 4000;
app.listen(port, () => console.log(`Ember backend listening on :${port}`));
