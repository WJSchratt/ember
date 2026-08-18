# Ember (working name)

Fight 21st-century loneliness by matching small groups of people (max 10) into
temporary chat rooms for a specific event, based on shared interest tags —
not a feed, not follower counts. "Halo 3 night" gets created, people whose
interests overlap get matched into a room, and once the event's scheduled
time passes the room locks.

This is a first-pass vertical slice: signup → interests → create event →
auto-matched room → chat → auto-lock. It's rough by design — the goal was an
end-to-end working flow, not polish.

## Stack

- **Backend:** Node + Express, PostgreSQL via `pg`, JWT auth, bcrypt password hashing.
- **Frontend:** React (Vite), React Router, plain CSS. No UI kit.
- **Chat:** polling (every 3s), not WebSockets — simplest thing that works for a prototype.

## Architecture decisions made without asking (noted per your instructions)

1. **Local dev database is embedded Postgres (pglite), not a real Postgres server.**
   This machine has no Docker and no local Postgres install. `backend/dev-db/start.js`
   runs `@electric-sql/pglite` behind a real Postgres wire-protocol socket on
   `localhost:5433`, so the app talks to it through the standard `pg` driver —
   identical code path to a hosted Postgres in production. Data persists to
   `backend/dev-db/data/` (gitignored). To go to a real hosted Postgres (e.g. Neon
   free tier), just change `DATABASE_URL` in `.env` — nothing else changes.

2. **Room membership/lock state is derived, not stored.** A room is "locked" purely
   by checking `scheduled_at <= now()` at request time. No cron job, no stored
   status column that could drift out of sync.

3. **Matching runs synchronously on event creation** (and can be re-triggered via
   `POST /api/events/:id/match`, idempotent — only adds new eligible members, never
   removes). No job queue for v1; there's nothing here that benefits from async
   processing yet.

4. **Room capacity defaults to 10 and includes the creator.** The creator auto-joins
   their own event's room; matching fills the remaining slots.

5. **GitHub push:** couldn't create the repo via `gh` CLI (not installed) or the
   token already used for your other repos (expired). Used the GitHub REST API
   directly to create the repo instead.

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
- No ranking, no AI — just "do the tag sets intersect."

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

The React UI was built against this same API and the dev server boots and
proxies correctly, but I did not click through it in an actual browser — do
that before you trust it fully. Start both servers and hit http://localhost:5173.

## What's stubbed out / not built

- **Location field** is stored and displayed but does nothing (no maps, no
  geo-matching) — explicitly deferred per the spec.
- **No AI/ranked matching** — pure tag overlap, as specified for v1.
- **No password reset, no email verification.**
- **No rate limiting, no input sanitization beyond basic presence checks** —
  fine for a solo prototype, not fine for real users.
- **No tests.** Everything above was verified manually via curl during the build.
- **No production deploy.** Dev branch only, no Vercel preview was set up (wasn't
  requested beyond "if you want one, tie it to dev" — skipped since the frontend
  needs a live backend + Postgres to be useful, and neither is deployed yet).

## What I'd tackle next

1. Real hosted Postgres (Neon free tier) instead of the local embedded one, so the
   dev environment matches what a real deploy would look like.
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
