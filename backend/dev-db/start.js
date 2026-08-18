// Local-only dev database: an embedded Postgres (pglite) exposed over the
// real Postgres wire protocol on localhost:5433, so the app talks to it
// through the standard `pg` driver exactly like it would talk to a hosted
// Postgres instance (e.g. Neon) in production. Nothing here runs in prod.
import { PGlite } from '@electric-sql/pglite';
import { PGLiteSocketServer } from '@electric-sql/pglite-socket';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.join(__dirname, 'data');

const db = new PGlite(dataDir);
const server = new PGLiteSocketServer({ db, port: 5433, host: 'localhost' });

await server.start();
console.log('Dev Postgres (pglite) listening on postgres://localhost:5433');
console.log('Data persisted at', dataDir);

process.on('SIGINT', async () => {
  await server.stop();
  process.exit(0);
});
