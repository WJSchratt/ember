import { useEffect, useState } from 'react';
import { api } from '../api';
import { useAuth } from '../context/AuthContext.jsx';
import { avatarHueClass, initials } from '../ui.js';

export default function Profile() {
  const { token, user, logout } = useAuth();
  const [allInterests, setAllInterests] = useState([]);
  const [selected, setSelected] = useState(new Set());
  const [stats, setStats] = useState({ joined: 0, hosted: 0 });
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([api.interests(), api.me(token), api.myEvents(token)]).then(([interests, mine, myEvents]) => {
      setAllInterests(interests);
      setSelected(new Set(mine.interests.map((i) => i.id)));
      setStats({
        joined: myEvents.length,
        hosted: myEvents.filter((e) => e.creatorId === user.id).length,
      });
      setLoading(false);
    });
  }, [token]);

  function toggle(id) {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  async function save() {
    setStatus('Saving...');
    await api.updateMyInterests(token, [...selected]);
    setStatus('Saved.');
    setTimeout(() => setStatus(''), 1500);
  }

  if (loading) return <div className="page">Loading...</div>;

  return (
    <div className="page">
      <div style={{ textAlign: 'center', padding: '0.5rem 0 1.25rem' }}>
        <div className={`avatar avatar-lg ${avatarHueClass(user.id)}`} style={{ margin: '0 auto 10px' }}>
          {initials(user.displayName)}
        </div>
        <p style={{ fontWeight: 600, fontSize: 16 }}>{user.displayName}</p>
        <p className="muted">{user.email}</p>
      </div>

      <p className="section-title">Stats</p>
      <div style={{ display: 'flex', gap: 10, marginBottom: '1.25rem' }}>
        <div className="stat-box">
          <p className="num">{stats.joined}</p>
          <p className="label">rooms joined</p>
        </div>
        <div className="stat-box">
          <p className="num">{stats.hosted}</p>
          <p className="label">hosted</p>
        </div>
      </div>

      <p className="section-title">Your interests</p>
      <p className="muted" style={{ marginBottom: 10 }}>
        Tag overlap with an event is what gets you matched into its room.
      </p>
      <div className="card">
        <div className="tag-grid">
          {allInterests.map((i) => (
            <span
              key={i.id}
              className={`tag-chip selectable ${selected.has(i.id) ? 'selected' : ''}`}
              onClick={() => toggle(i.id)}
            >
              {i.name}
            </span>
          ))}
        </div>
      </div>
      <button className="btn btn-primary" onClick={save}>
        Save interests
      </button>
      {status && <p className="muted" style={{ marginTop: 8 }}>{status}</p>}

      <button className="btn btn-ghost" style={{ marginTop: '2rem' }} onClick={logout}>
        Log out
      </button>
    </div>
  );
}
