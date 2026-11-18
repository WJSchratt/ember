import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { fmtDate, fmtTime, mySpots, pickupApi, removeSpot, saveSpot } from './pickupApi.js';

const SHOW_DATES = 4;
const POLL_MS = 20000;

export const WAIVER_TEXT =
  "I'm playing at my own risk. This is a free, informal pickup game, not an organized event, " +
  'and I release Tether and its creator from liability for any injury.';

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

  const next = occurrences?.find((o) => !o.cancelled);

  return (
    <div className="page pk-page">
      <section className="card hero pk-hero">
        <div className="pk-hero-ball" aria-hidden="true">
          <i className="ti ti-ball-football" />
        </div>
        <p className="pk-eyebrow">McGuire Fields</p>
        <h1 className="pk-title">Pickup Soccer</h1>
        <p className="pk-sub">Free, casual, all levels. Tap &ldquo;I&rsquo;m in&rdquo; so we know how many to expect.</p>
        {next && (
          <p className="pk-next">
            <i className="ti ti-calendar-event" aria-hidden="true" /> Next: {fmtDate(next.date)} &middot;{' '}
            {fmtTime(next.startTime)} &middot; <strong>{next.count}</strong> in
          </p>
        )}
      </section>

      <h2 className="section-title">Upcoming game days</h2>
      {error && <p className="error">{error}</p>}
      {!occurrences && !error && <p className="muted">Loading game days&hellip;</p>}
      {occurrences?.length === 0 && (
        <div className="card">
          <p className="muted">No games on the calendar right now. Check back soon.</p>
        </div>
      )}
      {occurrences?.map((o) => {
        const key = `${o.gameId}:${o.date}`;
        return (
          <GameDay
            key={key}
            o={o}
            mine={spots.find((s) => s.gameId === o.gameId && s.date === o.date && o.players.some((p) => p.id === s.id))}
            formOpen={openKey === key}
            onOpen={() => setOpenKey(openKey === key ? null : key)}
            onChanged={() => {
              setSpots(mySpots());
              setOpenKey(null);
              load();
            }}
          />
        );
      })}

      <section className="card pk-how">
        <h2 className="pk-h2">
          <i className="ti ti-info-circle" aria-hidden="true" /> How it works
        </h2>
        <ul>
          <li>Tap <strong>I&rsquo;m in</strong> on a date. Just your name, no account.</li>
          <li>Changed plans? Tap <strong>Cancel my spot</strong> on this same phone.</li>
          <li>Bring a ball if you have one, wear cleats or turf shoes, bring water.</li>
          <li>Light and dark shirts so we can split teams.</li>
          <li>It&rsquo;s free and always will be. No payments, no sign-up fees.</li>
        </ul>
      </section>

      <footer className="pk-footer">
        <Link to="/privacy">Privacy</Link>
        <span>&middot;</span>
        <span>Informal pickup, play at your own risk</span>
      </footer>
    </div>
  );
}

function GameDay({ o, mine, formOpen, onOpen, onChanged }) {
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

  return (
    <article className={`card pk-day${o.cancelled ? ' cancelled' : ''}${mine ? ' mine' : ''}`} data-date={o.date}>
      <div className="pk-day-head">
        <div>
          <p className="pk-day-date">{fmtDate(o.date, { weekday: 'long', month: 'short', day: 'numeric' })}</p>
          <p className="pk-day-meta">
            {fmtTime(o.startTime)} &middot; {o.location}
            {o.title !== 'Pickup Soccer' ? ` · ${o.title}` : ''}
          </p>
        </div>
        <div className="pk-count" aria-label={`${o.count} players in`}>
          <span className="num">{o.count}</span>
          <span className="label">in</span>
        </div>
      </div>

      {o.cancelled && (
        <p className="pk-banner">
          <i className="ti ti-cloud-rain" aria-hidden="true" /> Cancelled{o.dateNote ? `: ${o.dateNote}` : ''}
        </p>
      )}
      {!o.cancelled && o.dateNote && <p className="pk-note">{o.dateNote}</p>}
      {o.gameNote && <p className="pk-note">{o.gameNote}</p>}

      {o.players.length > 0 && (
        <div className="pk-names">
          {o.players.map((p) => (
            <span key={p.id} className={`tag-chip pk-name${mine?.id === p.id ? ' me' : ''}`}>
              {p.firstName}
            </span>
          ))}
        </div>
      )}

      {!o.cancelled &&
        (mine ? (
          <div className="pk-actions">
            <span className="pk-youre-in">
              <i className="ti ti-circle-check" aria-hidden="true" /> You&rsquo;re in
            </span>
            <button type="button" className="btn btn-ghost" onClick={cancelMine} disabled={busy}>
              {busy ? 'Cancelling…' : 'Cancel my spot'}
            </button>
          </div>
        ) : formOpen ? (
          <RsvpForm o={o} onDone={onChanged} onClose={onOpen} />
        ) : (
          <button type="button" className="btn btn-primary pk-in-btn" onClick={onOpen}>
            <i className="ti ti-ball-football" aria-hidden="true" /> I&rsquo;m in
          </button>
        ))}
      {err && <p className="error">{err}</p>}
    </article>
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
    if (!waiver) return setErr('Please check the box above to sign up.');
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
      <div>
        <label htmlFor={`name-${o.date}`}>Your name</label>
        <input
          id={`name-${o.date}`}
          value={name}
          maxLength={40}
          autoComplete="given-name"
          placeholder="First name is fine"
          onChange={(e) => setName(e.target.value)}
          autoFocus
        />
      </div>
      <div>
        <label htmlFor={`contact-${o.date}`}>
          Phone or email <span className="pk-optional">optional, reminders only</span>
        </label>
        <input
          id={`contact-${o.date}`}
          value={contact}
          maxLength={120}
          autoComplete="off"
          placeholder="Leave blank if you like"
          onChange={(e) => setContact(e.target.value)}
        />
      </div>
      <label className="pk-waiver">
        <input type="checkbox" checked={waiver} onChange={(e) => setWaiver(e.target.checked)} />
        <span>{WAIVER_TEXT}</span>
      </label>
      {err && <p className="error">{err}</p>}
      <div className="pk-actions">
        <button type="submit" className="btn btn-primary pk-in-btn" disabled={busy || !waiver}>
          {busy ? 'Saving…' : `Count me in for ${fmtDate(o.date, { weekday: 'short' })}`}
        </button>
        <button type="button" className="btn btn-ghost" onClick={onClose}>
          Not now
        </button>
      </div>
      <p className="pk-fineprint">
        No account needed. Only your first name is shown publicly. <Link to="/privacy">Privacy</Link>
      </p>
    </form>
  );
}
