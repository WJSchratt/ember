# McGuire Fields Pickup Soccer (pickup-only mode)

Tether is currently stripped down to one thing: account-free sign-ups for
pickup soccer at McGuire Fields, reached from a QR code on a sign at the field.
Everything else (accounts, interests, rooms, chat, AI) is **paused, not
deleted**: code, routes and tables are intact behind a flag.

## The flag

| Side     | Env var            | Default | Effect when on |
|----------|--------------------|---------|----------------|
| Backend  | `PICKUP_ONLY`      | on      | `/api/auth`, `/api/me`, `/api/interests`, `/api/events` return 503 before their handlers run, so **no Anthropic calls are possible** (icebreakers, @Tether, suggestions all live behind `/api/events`). `/api/pickup/*` is always mounted. |
| Frontend | `VITE_PICKUP_ONLY` | on      | Renders only the pickup app (no AuthProvider, login, nav, rooms). Build-time: changing it needs a rebuild/redeploy. |

Only the literal string `false` turns a flag off. Set both to `false` to get
the full Tether app back.

Other env: `ADMIN_PASSCODE` (backend, required for /admin; admin is disabled if
unset), `PICKUP_TZ` (backend, default `America/New_York`), `VITE_PUBLIC_URL`
(QR target, default `https://ember-web-three.vercel.app`), `VITE_CONTACT_EMAIL`
(optional deletion contact on /privacy; falls back to "ask the organizer").

## Pages

- `/`: game days (next 4 dates), headcount + first names, "I'm in" form
  (name, optional phone/email "reminders only"), required own-risk checkbox,
  cancel-my-spot, how-it-works.
- `/privacy`: what's stored, never sold, how to get it deleted.
- `/admin`: passcode-gated. Edit/add games (weekly or one-off, day, time,
  title, location, note, active), cancel/restore single dates with a note
  ("rained out"), see full names + contact, remove sign-ups.
- `/qr`: on-screen QR + PNG download. `/sign`: printable letter-size sign.
- `npm run qr` (in `frontend/`) writes `public/mcguire-pickup-qr.png`
  (also served at `/mcguire-pickup-qr.png`). `npm run qr -- <url> <out.png>` for another URL.

## Data (new tables only, created by `npm run migrate`)

- `pickup_games`: schedule. Seeded once with a weekly Tuesday 18:00 game.
- `pickup_date_overrides`: per-date cancel + note.
- `pickup_rsvps`: name, optional contact, `waiver_accepted_at` timestamp,
  sha256 of the cancel token (raw token lives only in the player's
  localStorage), `cancelled_at` (soft cancel, so the waiver record is kept).
  Admin "Remove" hard-deletes (for deletion requests).

A game date stays listed and open until 2h after kickoff. No SMS/email is sent.

## Run locally

```bash
cd backend && npm run dev:db          # terminal 1
cd backend && npm run migrate && npm start   # terminal 2 (.env: ADMIN_PASSCODE=...)
cd frontend && npm run dev            # terminal 3 -> http://localhost:5173
```

E2E (Playwright, 390x844):

```bash
cd frontend
BASE_URL=http://localhost:5173 ADMIN_PASSCODE=... npm run e2e
# flags-off check (run backend with PICKUP_ONLY=false, vite with VITE_PICKUP_ONLY=false):
MODE=legacy BASE_URL=http://localhost:5173 npm run e2e
```

Set `CHROMIUM_PATH` to reuse an installed Chromium instead of
`npx playwright install chromium`. Screenshots go to `frontend/e2e/screenshots/`.

## Deploy (manual, not done yet)

```bash
cd backend
vercel env add ADMIN_PASSCODE production      # pick a passcode
vercel env add PICKUP_ONLY production          # value: true (optional; default is on)
vercel deploy --prod
# run the new migrations once against Neon:
# (idempotent; only adds the pickup_* tables + seed Tuesday game; deletes the pulled secrets file after)
vercel env pull .env.production.local --environment=production \
  && DATABASE_URL=$(grep ^DATABASE_URL= .env.production.local | cut -d= -f2- | tr -d '"') npm run migrate; \
  rm -f .env.production.local

cd ../frontend
vercel deploy --prod                           # VITE_PICKUP_ONLY defaults on
```
