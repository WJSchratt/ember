import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../context/AuthContext.jsx';

function defaultScheduledAt() {
  const d = new Date(Date.now() + 60 * 60 * 1000); // 1 hour from now
  d.setSeconds(0, 0);
  const tzOffset = d.getTimezoneOffset() * 60000;
  return new Date(d - tzOffset).toISOString().slice(0, 16);
}

export default function CreateEvent() {
  const { token } = useAuth();
  const navigate = useNavigate();
  const [allInterests, setAllInterests] = useState([]);
  const [selected, setSelected] = useState(new Set());
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [location, setLocation] = useState('');
  const [scheduledAt, setScheduledAt] = useState(defaultScheduledAt());
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api.interests().then(setAllInterests);
  }, []);

  function toggle(id) {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  async function onSubmit(e) {
    e.preventDefault();
    setError('');
    if (selected.size === 0) {
      setError('Pick at least one interest tag.');
      return;
    }
    setBusy(true);
    try {
      const data = await api.createEvent(token, {
        title,
        description,
        location,
        scheduledAt: new Date(scheduledAt).toISOString(),
        interestIds: [...selected],
      });
      navigate(`/events/${data.event.id}`);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="page">
      <p className="section-title" style={{ fontSize: 17, color: 'var(--text-primary)', fontWeight: 600 }}>
        Start a hangout
      </p>
      <form onSubmit={onSubmit} style={{ marginTop: '0.75rem' }}>
        <div>
          <label>Title</label>
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Halo 3 night" required />
        </div>
        <div>
          <label>Description (optional)</label>
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} />
        </div>
        <div>
          <label>Location (optional)</label>
          <input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Discord / local park / online" />
        </div>
        <div>
          <label>When</label>
          <input
            type="datetime-local"
            value={scheduledAt}
            onChange={(e) => setScheduledAt(e.target.value)}
            required
          />
        </div>
        <div>
          <label>Interest tags (people matching these get invited)</label>
          <div className="card">
            {allInterests.map((i) => (
              <span
                key={i.id}
                className={`tag-chip selectable ${selected.has(i.id) ? 'selected' : ''}`}
                style={{ marginRight: 6, marginBottom: 6, display: 'inline-block' }}
                onClick={() => toggle(i.id)}
              >
                {i.name}
              </span>
            ))}
          </div>
        </div>
        {error && <div className="error">{error}</div>}
        <button className="btn btn-primary" type="submit" disabled={busy}>
          {busy ? 'Creating...' : 'Create & find a room'}
        </button>
      </form>
    </div>
  );
}
