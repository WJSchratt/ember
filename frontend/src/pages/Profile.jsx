import { useEffect, useState } from 'react';
import { api } from '../api';
import { useAuth } from '../context/AuthContext.jsx';

export default function Profile() {
  const { token } = useAuth();
  const [allInterests, setAllInterests] = useState([]);
  const [selected, setSelected] = useState(new Set());
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([api.interests(), api.me(token)]).then(([interests, mine]) => {
      setAllInterests(interests);
      setSelected(new Set(mine.interests.map((i) => i.id)));
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

  if (loading) return <div className="container">Loading...</div>;

  return (
    <div className="container">
      <h1>Your interests</h1>
      <p className="muted">
        Pick the things you'd want to be matched into a room for. Tag overlap with an event is
        what gets you invited.
      </p>
      <div className="card">
        {allInterests.map((i) => (
          <span
            key={i.id}
            className={`tag ${selected.has(i.id) ? 'selected' : ''}`}
            onClick={() => toggle(i.id)}
          >
            {i.name}
          </span>
        ))}
      </div>
      <button className="primary" onClick={save}>
        Save interests
      </button>
      {status && <p className="muted">{status}</p>}
    </div>
  );
}
