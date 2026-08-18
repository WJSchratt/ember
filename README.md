# Tether

(repo/project name `ember` predates two renames now — Ember → Roomless →
Tether — kept to avoid rename churn on the GitHub repo and Vercel project
slugs, which would mean recreating both and breaking the live URLs below.
The product name is **Tether**.)

Fight 21st-century loneliness by matching small groups of people (max 10) into
temporary chat rooms for a specific event, based on shared interest tags —
not a feed, not follower counts. "Halo 3 night" gets created, people whose
interests overlap get matched into a room, and once the event's scheduled
time passes the room locks.

This is a first-pass vertical slice: signup → interests → create event →
auto-matched room → chat → auto-lock. It's rough by design — the goal was an
end-to-end working flow, not polish.

## Live

- **App:** https://ember-web-three.vercel.app
- **API:** https://ember-api-alpha.vercel.app
- Both are Vercel projects under `walter-schratts-projects`, deployed straight
  to production from the CLI (not connected to GitHub auto-deploy — pushing to
  `dev` does not redeploy these; run `vercel deploy --prod` in each directory).
- Database is a free-tier Neon Postgres, provisioned via the Vercel Marketplace
  integration and attached only to the `ember-api` project.
- Seed users work here too: `alice@test.dev` / `password123`, etc.

## AI

Two Claude-backed features (`claude-opus-5` via `@anthropic-ai/sdk`, key in
`ANTHROPIC_API_KEY`, scoped to this project only):

- **Icebreaker:** once a room reaches its first 2 real members, Claude writes
  a one-time icebreaker referencing the event and shared tags, posted by a
  `Tether` bot user (`backend/src/services/ai.js` → `generateIcebreaker`,
  wired into matching in `routes/events.js`). Failures are swallowed — a slow
  or unavailable model should never block event creation or matching.
- **Suggested hangouts:** `GET /api/events/suggestions` asks Claude to propose
  event ideas from the aggregate interest tags of everyone signed up
  (structured-output JSON, `output_config.format`), weighted toward tags with
  more interested users so the suggestion is actually matchable. Shown on the
  Events page with a one-click "Create this" that pre-fills and creates the
  event through the normal endpoint — no bypass of tag-based matching.

## Stack

- **Backend:** Node + Express, PostgreSQL via `pg`, JWT auth, bcrypt password hashing.
- **Frontend:** React (Vite), React Router, plain CSS (no UI kit), Inter font + Tabler icon font.
- **Chat:** polling (every 3s), not WebSockets — simplest thing that works for a prototype.

## Architecture decisions made without asking (noted per your instructions)

1. **Local dev database is embedded Postgres (pglite), not a real Postgres server.**
   This machine has no Docker and no local Postgres install. `backend/dev-db/start.js`
   runs `@electric-sql/pglite` behind a real Postgres wire-protocol socket on
   `localhost:5433`, so the app talks to it through the standard `pg` driver —
   identical code path to a hosted Postgres in production. Data persists to
   `backend/dev-db/data/` (gitignored). To go to a real hosted Postgres (e.g. Neon
   free tier), just change `DATABASE_URL` in `.env` — nothing else changes.
   (Production now does exactly this — see **Live** above.)

2. **Backend deploys as a single Vercel serverless function, not a persistent
   server.** Same pattern as `jarvis-for-jaide`/Holly. `backend/src/app.js`
   exports the bare Express app; `backend/src/server.js` (local dev only) is
   the one that calls `app.listen()`. `backend/api/[...path].js` re-exports the
   app as the serverless entry, with `backend/vercel.json` rewriting every path
   to it — Vercel's zero-config catch-all didn't route multi-segment paths
   (`/api/auth/login`) correctly under the auto-detected "Express" framework
   preset, only single-segment ones, so the explicit rewrite was needed. The
   `pg` Pool caps at 3 connections in this mode (`process.env.VERCEL` check in
   `db.js`) since Neon's pooled connection string is meant to be hit by many
   short-lived instances, not one big pool.

3. **CORS is wide open (`origin: '*'`)** rather than locked to the frontend's
   Vercel URL. There's no session cookie in play (JWT in an Authorization
   header), so there's no CSRF exposure from this; tightening it later is a
   one-line change to `CORS_ORIGIN`.

4. **Room membership/lock state is derived, not stored.** A room is "locked" purely
   by checking `scheduled_at <= now()` at request time. No cron job, no stored
   status column that could drift out of sync.

5. **Matching runs synchronously on event creation** (and can be re-triggered via
   `POST /api/events/:id/match`, idempotent — only adds new eligible members, never
   removes). No job queue for v1; there's nothing here that benefits from async
   processing yet.

6. **Room capacity defaults to 10 and includes the creator.** The creator auto-joins
   their own event's room; matching fills the remaining slots.

7. **GitHub push:** couldn't create the repo via `gh` CLI (not installed) or the
   token already used for your other repos (expired). Used the GitHub REST API
   directly to create the repo instead.

8. **The Events list "Join" button re-uses the matching endpoint**, it doesn't
   bypass tag-based eligibility. Clicking Join on a browsable room calls
   `POST /api/events/:id/match`; if you share a tag and there's a free slot
   you're added and dropped straight into the room, otherwise you see why not
   (no overlap, room full, or you're already committed elsewhere). This keeps
   the one-click mockup interaction honest to the actual matching rules
   instead of turning it into an open join-anything button.

9. **Tabler Icons via CDN link** (`tabler-icons.min.css`) rather than an npm
   icon package — matches the provided mockups' icon set with zero build
   config; fine for a prototype, would move to a bundled package if this
   needs to work offline or the CDN becomes a reliability concern.

## Data model

```
users            (id, email, password_hash, display_name)
interests        (id, name)                          -- seeded generic tags
user_interests   (user_id, interest_id)
events           (id, creator_id, title, description, location, scheduled_at, capacity)
event_interests  (event_id, interest_id)
room_members     (event_id, user_id, joined_at)       -- the "room" is just this table
messages         (id, event_id, user_id, body, created_at)
```

## Matching rules (v1)

- Plain tag overlap. A user is eligible for an event's room if they share
  **at least one** interest tag with the event.
- A user can only be a member of **one room whose event hasn't happened yet**
  at a time. Once an event's `scheduled_at` passes, that user becomes eligible
  for new rooms again.
- Rooms cap at `capacity` (10 by default), creator included.
- No ranking. The matching decision itself is "do the tag sets intersect" —
  AI touches the icebreaker and event suggestions, not who gets matched.

## Running it locally

```bash
# backend
cd backend
npm install
cp .env.example .env      # fill in JWT_SECRET (any long random string)
npm run dev:db            # starts the embedded Postgres on :5433, leave running
npm run migrate           # creates tables
npm run seed               # seeds 20 interest tags + 6 fake test users
npm start                  # API on :4000

# frontend (separate terminal)
cd frontend
npm install
npm run dev                # UI on :5173, proxies /api to :4000
```

Seed test users (password `password123` for all): `alice@test.dev`,
`bob@test.dev`, `carla@test.dev`, `dev@test.dev`, `ellen@test.dev`,
`frank@test.dev` — with overlapping and non-overlapping interests so you can
test matching solo. Alice/Bob/Dev all share `gaming`; Carla has no overlap
with a gaming-tagged event, so she's a good negative test case.

## What's verified end-to-end (via direct API calls — no browser tool was
available in this environment to click through the UI)

- Signup/login, JWT auth on protected routes
- Interest tag selection and save
- Event creation auto-joins the creator and immediately runs matching
- Users sharing a tag get auto-matched into the room; users with no overlap don't
- **One-open-room-at-a-time rule verified**: a user already committed to an
  unlocked room is excluded from matching into a second one
- Chat is membership-gated (403 for non-members) both for reading and posting
- **Auto-lock verified**: once `scheduled_at` passes, the room reports
  `locked: true` and posting a message returns 403
- **AI icebreaker verified**: creating/matching a room to 2+ members posts a
  real Claude-generated message from the `Tether` bot, on both local dev
  and the live deployment
- **AI suggestions verified**: `GET /api/events/suggestions` returns real
  Claude-generated ideas from live seed-data interest counts, and one-click
  "Create this" round-trips through normal event creation + matching

The same matching/one-room/lock checks above were re-run directly against the
live Neon-backed deployment and passed. The React UI was built against this
same API and both dev and prod servers boot and connect correctly, but I did
not click through it in an actual browser — no browser tool was available in
this environment. Do that before you trust it fully: locally at
http://localhost:5173, or live at https://ember-web-three.vercel.app.

## What's stubbed out / not built

- **Location field** is stored and displayed but does nothing (no maps, no
  geo-matching) — explicitly deferred per the spec.
- **Matching itself is still pure tag overlap** — AI writes the icebreaker
  and proposes event ideas, but does not decide who gets matched into a room.
- **No password reset, no email verification.**
- **No rate limiting, no input sanitization beyond basic presence checks** —
  fine for a solo prototype, not fine for real users.
- **No tests.** Everything above was verified manually via curl, locally and
  against the live deployment.
- **No CI/CD.** `dev` branch pushes to GitHub don't auto-deploy — the Vercel
  projects aren't connected to the repo, so redeploying means running
  `vercel deploy --prod` by hand in `backend/` or `frontend/`.

## What I'd tackle next

1. Connect both Vercel projects to the GitHub repo for auto-deploy on push
   (currently manual `vercel deploy --prod`), and add a real Preview
   environment tied to `dev` instead of deploying straight to production.
2. WebSockets (or at least shorter polling + typing indicators) once the chat
   needs to feel more alive than a 3-second refresh.
3. A "leave room" action — right now once matched, you're in until lock; no way
   to back out if you can't make the event.
4. Surface *why* someone wasn't matched (no overlapping tags vs. already in
   another room vs. room full) in the UI instead of a single generic reason string.
5. Real location handling (geocoding + distance-based matching) if the product
   direction wants in-person events to matter, not just online ones.
6. Basic abuse prevention (rate-limit signup/login, message length caps enforced
   server-side beyond "non-empty").
