import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { MCGUIRE_PATH } from '../flags.js';
import { fmtDate, fmtTime, groupByDate, pickupApi, scheduleLine, slotKey } from './pickupApi.js';

// Tether's home while PICKUP_ONLY is on: just the pickup games.
// (One place for now; each place gets its own sign-up page.)
export default function TetherHome() {
  const [occurrences, setOccurrences] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    pickupApi
      .games()
      .then((d) => setOccurrences(d.occurrences))
      .catch((e) => setError(e.message));
  }, []);

  const days = occurrences ? groupByDate(occurrences) : [];
  const next = days.find((d) => d.slots.some((o) => !o.cancelled));

  return (
    <div className="pk-page">
      <header className="pk-masthead pk-masthead-home">
        <h1 className="pk-title">Pickup games</h1>
        <p className="pk-lede">Find a game, put your name down, show up. Free, no account.</p>
      </header>

      {error && <p className="pk-error">{error}</p>}
      {!occurrences && !error && <p className="pk-quiet">Loading&hellip;</p>}

      <article className="pk-place" data-testid="place-mcguire">
        <p className="pk-label">Soccer</p>
        <h2 className="pk-place-name">McGuire Fields</h2>
        {occurrences && <p className="pk-place-when">{scheduleLine(occurrences) || 'No games scheduled right now'}</p>}

        {next && (
          <div className="pk-place-next">
            <p className="pk-place-next-date">Next: {fmtDate(next.date, { weekday: 'long', month: 'short', day: 'numeric' })}</p>
            <ul>
              {next.slots.map((o) => (
                <li key={slotKey(o)}>
                  <span>{fmtTime(o.startTime)}</span>
                  <span>{o.cancelled ? 'Cancelled' : `${o.count} playing`}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        <Link to={MCGUIRE_PATH} className="pk-btn pk-btn-go pk-place-btn">
          See who&rsquo;s playing &amp; sign up
        </Link>
      </article>

      <p className="pk-quiet pk-home-note">
        Tether helps people find others to play with. More fields and sports soon.
      </p>

      <footer className="pk-footer">
        <p>Informal pickup games. Play at your own risk.</p>
        <p>
          <Link to="/privacy">Privacy</Link>
        </p>
      </footer>
    </div>
  );
}
