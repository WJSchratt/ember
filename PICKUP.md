# Tether pickup games (pickup-only mode)

For now Tether is just pickup games: account-free sign-ups for pickup soccer
at McGuire Fields, reached from a QR code on a sign at the field. The pickup
page is a page *of* Tether (Tether brand + light nav around it) and links back
into Tether. Everything else (accounts, interests, rooms, chat, AI) is
**paused, not deleted**: code, routes and tables are intact behind a flag.

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

- `/`: Tether home. For now just the pickup games: the McGuire Fields block
  (schedule, next date's slots with headcounts) linking to the sheet.
- `/pickup/mcguire`: the McGuire Fields sign-up sheet (the QR/sign target).
  Next 4 dates grouped by day; the next date's slots (Tuesday 6 PM and 7:30 PM)
  are featured with headcount, "I'm in" and a numbered sheet of first names.
  "I'm in" asks **only for a name** plus the required own-risk checkbox.
  Cancel-my-spot via a token in localStorage. Low-key link back to `/`.
- `/privacy`: name only, never sold, how to get it deleted.
- `/admin`: passcode-gated. Edit/add games (weekly or one-off, day, time,
  title, location, note, active), cancel/restore single dates with a note
  ("rained out"), see full names, remove sign-ups. Inactive games fold away.
- `/qr`: on-screen QR + PNG download. `/sign`: printable letter-size sign.
  Both point at exactly `https://ember-web-three.vercel.app/pickup/mcguire`
  (`MCGUIRE_URL` in `frontend/src/flags.js`).
- `npm run qr` (in `frontend/`) writes `public/mcguire-pickup-qr.png` for that
  URL (also served at `/mcguire-pickup-qr.png`). `npm run qr -- <url> <out.png>` for another URL.

## Look

Light "park bulletin / team sheet" style, separate from the legacy dark theme
(all styles scoped under `.pickup-shell` / `pk-*` in `frontend/src/pickup/pickup.css`).
Barlow Condensed for headings, Source Sans 3 for body (Google Fonts, loaded only
in pickup mode). Palette: chalk `#f5f2ea`, ink `#151515`, field green
`#1d5c36`, goalie orange `#f2711c` (orange is only a fill under ink text, never
text). Flat blocks and thin rules, no shadows or gradients. The next game is
featured at the top with a numbered sign-up sheet per time slot. The shell is a
green strip with the Tether name and two nav links. `/sign` is pure black on white for cheap printers and photocopies.

## Data (new tables only, created by `npm run migrate`)

- `pickup_games`: schedule. Seeded once with two weekly Tuesday slots, 18:00
  and 19:30 (placeholder). A DB that only has the original 18:00 seed gets the
  19:30 slot added; otherwise seeds never re-run, so /admin edits stick.
- `pickup_date_overrides`: per-date cancel + note.
- `pickup_rsvps`: name, `contact` (kept for later but always NULL now: the
  form doesn't ask and the API ignores it), `waiver_accepted_at` timestamp,
  sha256 of the cancel token (raw token lives only in the player's
  localStorage), `cancelled_at` (soft cancel, so the waiver record is kept).
  Admin "Remove" hard-deletes (for deletion requests).

A slot stays listed and open until 2h after kickoff. No SMS/email is sent.

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
`npx playwright install chromium`. Screenshots go to `frontend/e2e/screenshots/`. The run adds sample sign-ups to the next date's slots so the
screenshots look like a real week, and removes them (plus its admin edits) at the end, even on failure.

## Deploy (manual)

Deploy from a clean `git archive HEAD` export (copy `backend/.vercel` and
`frontend/.vercel` into it) if the working tree has unrelated uncommitted work.
`ADMIN_PASSCODE` (backend) and `VITE_API_URL` (frontend) are already set in production.

```bash
cd backend
vercel deploy --prod
# run the new migrations once against Neon:
# (idempotent; only adds the pickup_* tables + Tuesday slots; deletes the pulled secrets file after)
vercel env pull .env.production.local --environment=production \
  && DATABASE_URL=$(grep ^DATABASE_URL= .env.production.local | cut -d= -f2- | tr -d '"') npm run migrate; \
  rm -f .env.production.local

cd ../frontend
vercel deploy --prod                           # VITE_PICKUP_ONLY defaults on
```
