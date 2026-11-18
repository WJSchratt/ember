// Pure date logic for pickup game days. Dates are plain 'YYYY-MM-DD' strings
// in the field's local timezone (PICKUP_TZ); times are 'HH:MM' local. No Date
// objects cross the API boundary, so there is no UTC drift to reason about.

export const PICKUP_TZ = process.env.PICKUP_TZ || 'America/New_York';

/** Today's date and current time ('HH:MM') in the given timezone. */
export function nowInTz(tz = PICKUP_TZ, now = new Date()) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-CA', {
      timeZone: tz,
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
    })
      .formatToParts(now)
      .map((p) => [p.type, p.value])
  );
  return { date: `${parts.year}-${parts.month}-${parts.day}`, time: `${parts.hour}:${parts.minute}` };
}

export function addDays(dateStr, n) {
  const d = new Date(`${dateStr}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

export function dayOfWeek(dateStr) {
  return new Date(`${dateStr}T00:00:00Z`).getUTCDay();
}

// A game day stays listed (and open for sign-up) until 2h after kickoff.
const GRACE_MINUTES = 120;

function minutes(hhmm) {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}

export function isStillUpcoming(dateStr, startTime, now) {
  if (dateStr > now.date) return true;
  if (dateStr < now.date) return false;
  return minutes(now.time) < minutes(startTime) + GRACE_MINUTES;
}

/**
 * Expand game definitions into concrete upcoming occurrences.
 * games: rows from pickup_games. Returns [{ game, date }] sorted by date/time.
 */
export function upcomingOccurrences(games, { days = 28, now = nowInTz() } = {}) {
  const out = [];
  for (const game of games) {
    if (!game.active) continue;
    if (game.recurring) {
      for (let i = 0; i <= days; i++) {
        const date = addDays(now.date, i);
        if (dayOfWeek(date) === game.day_of_week && isStillUpcoming(date, game.start_time, now)) {
          out.push({ game, date });
        }
      }
    } else if (game.game_date) {
      const date = game.game_date;
      if (date <= addDays(now.date, days) && isStillUpcoming(date, game.start_time, now)) {
        out.push({ game, date });
      }
    }
  }
  return out.sort((a, b) =>
    a.date === b.date ? a.game.start_time.localeCompare(b.game.start_time) : a.date.localeCompare(b.date)
  );
}

/** True if `date` is a real upcoming occurrence of `game`. */
export function isValidOccurrence(game, date, now = nowInTz()) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !game.active) return false;
  if (!isStillUpcoming(date, game.start_time, now)) return false;
  return game.recurring ? dayOfWeek(date) === game.day_of_week : game.game_date === date;
}
