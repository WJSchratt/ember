import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { DAYS, fmtDate, fmtTime, mySpots, pickupApi, removeSpot, saveSpot } from './pickupApi.js';

const SHOW_DATES = 4;
const POLL_MS = 20000;
// The sign-up sheet always shows at least this many numbered lines.
const SHEET_LINES = 8;

export const WAIVER_TEXT =
  "I'm playing at my own risk. This is a free, informal pickup game, not an organized event, " +
  'and I release Tether and its creator from liability for any injury.';

// "Tuesdays, 6 PM" from the recurring games in the list.
function scheduleLine(occurrences) {
  const seen = new Map();
  for (const o of occurrences) {
    if (!o.recurring) continue;
    const day = DAYS[new Date(`${o.date}T12:00:00Z`).getUTCDay()];
    const key = `${day}|${o.startTime}`;
    if (!seen.has(key)) seen.set(key, `${day}s, ${fmtTime(o.startTime).replace(':00', '')}`);
  }
  return [...seen.values()].join(' and ');
}

export default function PickupHome() {
  const [occurrences, setOccurrences] = useState(null);
  const [error, setError] = useState('');
  const [spots, setSpots] = useState(mySpots);
  const [openKey, setOpenKey] = useState(null);

  const load = useCallback(() => {
    pickupApi
      .games()
      .then((d) => {
        setOccurrences(d.occurrences.slice(0, SHOW_DATES));
        setError('');
      })
      .catch((e) => setError(e.message));
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, POLL_MS);
    return () => clearInterval(t);
  }, [load]);

  const mineFor = (o) =>
    spots.find((s) => s.gameId === o.gameId && s.date === o.date && o.players.some((p) => p.id === s.id));
  const dayProps = (o) => {
    const key = `${o.gameId}:${o.date}`;
    return {
      o,
      mine: mineFor(o),
      formOpen: openKey === key,
      onOpen: () => setOpenKey(openKey === key ? null : key),
      onChanged: () => {
        setSpots(mySpots());
        setOpenKey(null);
        load();
      },
    };
  };

  // Feature the next game that is actually on; the rest go in the list below.
  const featured = occurrences?.find((o) => !o.cancelled) || occurrences?.[0];
  const rest = occurrences?.filter((o) => o !== featured) || [];
  const schedule = occurrences ? scheduleLine(occurrences) : '';

  return (
    <div className="pk-page">
      <header className="pk-masthead">
        <h1 className="pk-title">
          Pickup Soccer <span className="pk-title-sub">at McGuire Fields</span>
        </h1>
        <p className="pk-lede">
          {schedule ? `${schedule}. ` : ''}Free. Bring a ball if you have one. Wear cleats.
        </p>
      </header>

      {error && <p className="pk-error">{error}</p>}
      {!occurrences && !error && <p className="pk-quiet">Loading&hellip;</p>}
      {occurrences?.length === 0 && <p className="pk-quiet">No games on the calendar right now. Check back soon.</p>}

      {featured && <GameDay key={`${featured.gameId}:${featured.date}`} {...dayProps(featured)} featured />}

      {rest.length > 0 && (
        <section className="pk-section">
          <h2 className="pk-h2">After that</h2>
          {rest.map((o) => (
            <GameDay key={`${o.gameId}:${o.date}`} {...dayProps(o)} />
          ))}
        </section>
      )}

      <section className="pk-section">
        <h2 className="pk-h2">The basics</h2>
        <ul className="pk-basics">
          <li>It&rsquo;s free. No league, no refs, no fees.</li>
          <li>Get there a few minutes early. We split teams on the spot.</li>
          <li>Bring a light shirt and a dark shirt, and water.</li>
          <li>Plans changed? Take your name off from this same phone.</li>
          <li>Everyone plays. Keep it friendly.</li>
        </ul>
      </section>

      <footer className="pk-footer">
        <p>Informal pickup game. Play at your own risk.</p>
        <p>
          <Link to="/privacy">Privacy</Link>
        </p>
      </footer>
    </div>
  );
}

function GameDay({ o, mine, formOpen, onOpen, onChanged, featured = false }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  async function cancelMine() {
    setBusy(true);
    setErr('');
    try {
      await pickupApi.cancel(mine.id, mine.token);
      removeSpot(mine.id);
      onChanged();
    } catch (e) {
      // Already gone server-side: drop the stale local token too.
      if (/not found/i.test(e.message)) {
        removeSpot(mine.id);
        onChanged();
      } else setErr(e.message);
    } finally {
      setBusy(false);
    }
  }

  const cls = ['pk-day', featured ? 'featured' : 'compact', o.cancelled && 'cancelled', mine && 'mine']
    .filter(Boolean)
    .join(' ');
  // Location is in the page title; only repeat it here when a game is somewhere else.
  const where = [
    fmtTime(o.startTime),
    (featured || o.location !== 'McGuire Fields') && o.location,
    o.title !== 'Pickup Soccer' && o.title,
  ]
    .filter(Boolean)
    .join(' · ');

  const actions = o.cancelled ? null : mine ? (
    <div className="pk-actions">
      <p className="pk-youre-in">You&rsquo;re in.</p>
      <button type="button" className="pk-btn pk-btn-plain" onClick={cancelMine} disabled={busy}>
        {busy ? 'Cancelling…' : 'Cancel my spot'}
      </button>
    </div>
  ) : formOpen ? (
    <RsvpForm o={o} onDone={onChanged} onClose={onOpen} />
  ) : (
    <button type="button" className="pk-btn pk-btn-go pk-in-btn" onClick={onOpen}>
      I&rsquo;m in
    </button>
  );

  return (
    <article className={cls} data-date={o.date}>
      {featured && <p className="pk-label">Next game</p>}
      <div className="pk-day-head">
        <div className="pk-day-when">
          {featured ? (
            <p className="pk-day-date">
              <span className="pk-weekday">{fmtDate(o.date, { weekday: 'long' })}</span>
              {fmtDate(o.date, { month: 'short', day: 'numeric' })}
            </p>
          ) : (
            <p className="pk-day-date">{fmtDate(o.date, { weekday: 'short', month: 'short', day: 'numeric' })}</p>
          )}
          <p className="pk-day-meta">{where}</p>
        </div>
        <p className="pk-count" aria-label={`${o.count} playing`}>
          <span className="num">{o.count}</span>
          <span className="label">playing</span>
        </p>
      </div>

      {o.cancelled && <p className="pk-banner">Cancelled{o.dateNote ? `: ${o.dateNote}` : ''}</p>}
      {!o.cancelled && o.dateNote && <p className="pk-note">{o.dateNote}</p>}
      {o.gameNote && <p className="pk-note">{o.gameNote}</p>}

      {featured ? (
        <>
          {actions}
          <SignUpSheet o={o} mine={mine} />
        </>
      ) : (
        <>
          {o.players.length > 0 && (
            <p className="pk-names">
              {o.players.map((p, i) => (
                <span key={p.id}>
                  <span className={`pk-name${mine?.id === p.id ? ' me' : ''}`}>{p.firstName}</span>
                  {i < o.players.length - 1 ? ', ' : ''}
                </span>
              ))}
            </p>
          )}
          {actions}
        </>
      )}
      {err && <p className="pk-error">{err}</p>}
    </article>
  );
}

// Numbered lines like the clipboard sheet at the field.
function SignUpSheet({ o, mine }) {
  const lines = Math.max(SHEET_LINES, o.players.length + 2);
  return (
    <ol className="pk-sheet" aria-label={`Who's playing ${fmtDate(o.date)}`}>
      {Array.from({ length: lines }, (_, i) => {
        const p = o.players[i];
        return (
          <li key={p ? p.id : `blank-${i}`} className={p ? '' : 'blank'}>
            <span className="n">{i + 1}</span>
            {p ? (
              <span className={`pk-name${mine?.id === p.id ? ' me' : ''}`}>
                {p.firstName}
                {mine?.id === p.id ? <span className="you"> (you)</span> : null}
              </span>
            ) : (
              <span className="line" aria-hidden="true" />
            )}
          </li>
        );
      })}
    </ol>
  );
}

function RsvpForm({ o, onDone, onClose }) {
  const [name, setName] = useState(() => localStorage.getItem('pickup_name') || '');
  const [contact, setContact] = useState('');
  const [waiver, setWaiver] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  async function submit(e) {
    e.preventDefault();
    if (!name.trim()) return setErr('Add your name.');
    if (!waiver) return setErr('Check the box above to sign up.');
    setBusy(true);
    setErr('');
    try {
      const r = await pickupApi.rsvp({
        gameId: o.gameId,
        date: o.date,
        name: name.trim(),
        contact: contact.trim() || undefined,
        waiverAccepted: true,
      });
      localStorage.setItem('pickup_name', name.trim());
      saveSpot({ id: r.id, gameId: o.gameId, date: o.date, token: r.cancelToken });
      onDone();
    } catch (e2) {
      setErr(e2.message);
      setBusy(false);
    }
  }

  return (
    <form className="pk-form" onSubmit={submit} noValidate>
      <div className="pk-field">
        <label htmlFor={`name-${o.date}`}>Your name</label>
        <input
          id={`name-${o.date}`}
          value={name}
          maxLength={40}
          autoComplete="given-name"
          onChange={(e) => setName(e.target.value)}
          autoFocus
        />
        <p className="pk-hint">First name is fine. Only your first name goes on the list.</p>
      </div>
      <div className="pk-field">
        <label htmlFor={`contact-${o.date}`}>
          Phone or email <span className="pk-optional">(optional, reminders only)</span>
        </label>
        <input
          id={`contact-${o.date}`}
          value={contact}
          maxLength={120}
          autoComplete="off"
          onChange={(e) => setContact(e.target.value)}
        />
      </div>
      <label className="pk-waiver">
        <input type="checkbox" checked={waiver} onChange={(e) => setWaiver(e.target.checked)} />
        <span>{WAIVER_TEXT}</span>
      </label>
      {err && <p className="pk-error">{err}</p>}
      <div className="pk-actions">
        <button type="submit" className="pk-btn pk-btn-go" disabled={busy || !waiver}>
          {busy ? 'Saving…' : `Count me in for ${fmtDate(o.date, { weekday: 'short' })}`}
        </button>
        <button type="button" className="pk-btn pk-btn-plain" onClick={onClose}>
          Not now
        </button>
      </div>
      <p className="pk-hint">
        No account. <Link to="/privacy">What we keep</Link>
      </p>
    </form>
  );
}
