import { useCallback, useEffect, useState } from 'react';
import { DAYS, fmtDate, fmtTime, pickupApi } from './pickupApi.js';

const PC_KEY = 'pickup_admin_passcode';

export default function Admin() {
  const [passcode, setPasscode] = useState(() => sessionStorage.getItem(PC_KEY) || '');
  const [authed, setAuthed] = useState(false);
  const [data, setData] = useState(null);
  const [err, setErr] = useState('');

  const load = useCallback(
    (pc = passcode) =>
      pickupApi
        .adminGames(pc)
        .then((d) => {
          setData(d);
          setAuthed(true);
          setErr('');
        })
        .catch((e) => {
          setErr(e.message);
          if (/passcode|disabled/i.test(e.message)) {
            setAuthed(false);
            sessionStorage.removeItem(PC_KEY);
          }
        }),
    [passcode]
  );

  useEffect(() => {
    if (passcode) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!authed) {
    return (
      <div className="page pk-page">
        <h1 className="pk-title pk-title-sm">Admin</h1>
        <form
          className="card"
          onSubmit={(e) => {
            e.preventDefault();
            sessionStorage.setItem(PC_KEY, passcode);
            load(passcode);
          }}
        >
          <div>
            <label htmlFor="pc">Passcode</label>
            <input id="pc" type="password" value={passcode} onChange={(e) => setPasscode(e.target.value)} />
          </div>
          {err && <p className="error">{err}</p>}
          <button className="btn btn-primary" type="submit">Unlock</button>
        </form>
      </div>
    );
  }

  const run = async (fn) => {
    try {
      await fn();
      await load();
    } catch (e) {
      setErr(e.message);
    }
  };

  return (
    <div className="page pk-page">
      <div className="pk-admin-head">
        <h1 className="pk-title pk-title-sm">Admin</h1>
        <button
          type="button"
          className="btn btn-ghost"
          onClick={() => {
            sessionStorage.removeItem(PC_KEY);
            setPasscode('');
            setAuthed(false);
          }}
        >
          Lock
        </button>
      </div>
      {err && <p className="error">{err}</p>}
      <p className="muted">Times are field-local ({data.timezone}).</p>

      <h2 className="section-title">Game schedule</h2>
      {data.games.map((g) => (
        <GameForm
          key={g.id}
          game={g}
          onSave={(body) => run(() => pickupApi.updateGame(passcode, g.id, body))}
        />
      ))}
      <GameForm
        key={`new-${data.games.length}`}
        onSave={(body) => run(() => pickupApi.createGame(passcode, body))}
      />

      <h2 className="section-title">Upcoming dates</h2>
      {data.occurrences.length === 0 && <p className="muted">No upcoming dates.</p>}
      {data.occurrences.map((o) => (
        <DateRow
          key={`${o.gameId}:${o.date}`}
          o={o}
          onSet={(body) => run(() => pickupApi.setDate(passcode, o.gameId, o.date, body))}
          onRemove={(id) => run(() => pickupApi.deleteRsvp(passcode, id))}
        />
      ))}
    </div>
  );
}

function GameForm({ game, onSave }) {
  const isNew = !game;
  const [f, setF] = useState(() => ({
    title: game?.title ?? 'Pickup Soccer',
    location: game?.location ?? 'McGuire Fields',
    recurring: game?.recurring ?? true,
    dayOfWeek: game?.day_of_week ?? 2,
    date: game?.game_date ?? '',
    startTime: game?.start_time ?? '18:00',
    note: game?.note ?? '',
    active: game?.active ?? true,
  }));
  const set = (k) => (e) =>
    setF({ ...f, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value });

  return (
    <form
      className={`card pk-admin-game${f.active ? '' : ' inactive'}`}
      data-testid={isNew ? 'new-game' : `game-${game.id}`}
      onSubmit={(e) => {
        e.preventDefault();
        onSave({ ...f, dayOfWeek: f.recurring ? Number(f.dayOfWeek) : null });
      }}
    >
      <p className="pk-day-date">{isNew ? 'Add a game day' : f.title}</p>
      <div className="pk-row">
        <label className="pk-inline">
          <input type="checkbox" checked={f.recurring} onChange={set('recurring')} /> Repeats weekly
        </label>
        {!isNew && (
          <label className="pk-inline">
            <input type="checkbox" checked={f.active} onChange={set('active')} /> Active
          </label>
        )}
      </div>
      <div className="pk-row">
        {f.recurring ? (
          <div>
            <label>Day</label>
            <select value={f.dayOfWeek} onChange={set('dayOfWeek')} aria-label="Day of week">
              {DAYS.map((d, i) => (
                <option key={d} value={i}>{d}</option>
              ))}
            </select>
          </div>
        ) : (
          <div>
            <label>Date</label>
            <input type="date" value={f.date} onChange={set('date')} aria-label="Date" />
          </div>
        )}
        <div>
          <label>Time</label>
          <input type="time" value={f.startTime} onChange={set('startTime')} aria-label="Time" />
        </div>
      </div>
      <div>
        <label>Title</label>
        <input value={f.title} onChange={set('title')} aria-label="Title" />
      </div>
      <div>
        <label>Location</label>
        <input value={f.location} onChange={set('location')} aria-label="Location" />
      </div>
      <div>
        <label>Note (shown on every date)</label>
        <input value={f.note} onChange={set('note')} placeholder="e.g. Meet at the north field" aria-label="Note" />
      </div>
      <button type="submit" className="btn btn-primary">{isNew ? 'Add game' : 'Save'}</button>
    </form>
  );
}

function DateRow({ o, onSet, onRemove }) {
  const [note, setNote] = useState(o.dateNote || '');
  return (
    <div className={`card pk-day${o.cancelled ? ' cancelled' : ''}`} data-date={o.date}>
      <div className="pk-day-head">
        <div>
          <p className="pk-day-date">{fmtDate(o.date, { weekday: 'long', month: 'short', day: 'numeric' })}</p>
          <p className="pk-day-meta">
            {fmtTime(o.startTime)} &middot; {o.title}
            {o.cancelled ? ' · CANCELLED' : ''}
          </p>
        </div>
        <div className="pk-count">
          <span className="num">{o.count}</span>
          <span className="label">in</span>
        </div>
      </div>
      <div className="pk-row">
        <input value={note} onChange={(e) => setNote(e.target.value)} placeholder='Date note, e.g. "rained out"' aria-label="Date note" />
      </div>
      <div className="pk-actions">
        <button type="button" className="btn btn-ghost" onClick={() => onSet({ cancelled: o.cancelled, note })}>
          Save note
        </button>
        <button type="button" className="btn btn-primary" onClick={() => onSet({ cancelled: !o.cancelled, note })}>
          {o.cancelled ? 'Restore date' : 'Cancel this date'}
        </button>
      </div>
      {o.players.length > 0 && (
        <ul className="pk-admin-players">
          {o.players.map((p) => (
            <li key={p.id}>
              <span>
                {p.name}
                {p.contact ? <span className="muted"> &middot; {p.contact}</span> : null}
              </span>
              <button type="button" className="pk-link-btn" onClick={() => window.confirm(`Remove ${p.name}?`) && onRemove(p.id)}>
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
