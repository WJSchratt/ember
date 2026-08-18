import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../context/AuthContext.jsx';

function EventRow({ e }) {
  return (
    <Link to={`/events/${e.id}`} className="card" style={{ display: 'block', textDecoration: 'none' }}>
      <strong>{e.title}</strong>
      {e.locked ? <span className="locked-badge">locked</span> : <span className="open-badge">open</span>}
      <div className="muted">
        {new Date(e.scheduledAt).toLocaleString()} · {e.memberCount}/{e.capacity} in room
        {e.location ? ` · ${e.location}` : ''}
      </div>
    </Link>
  );
}

export default function Events() {
  const { token } = useAuth();
  const [mine, setMine] = useState([]);
  const [all, setAll] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([api.myEvents(token), api.events(token)]).then(([mineData, allData]) => {
      setMine(mineData);
      setAll(allData);
      setLoading(false);
    });
  }, [token]);

  if (loading) return <div className="container">Loading...</div>;

  return (
    <div className="container">
      <h1>Your rooms</h1>
      {mine.length === 0 && <p className="muted">You haven't been matched into a room yet.</p>}
      {mine.map((e) => (
        <EventRow key={e.id} e={e} />
      ))}

      <h1 style={{ marginTop: '2rem' }}>All upcoming events</h1>
      {all.length === 0 && <p className="muted">No events yet — create one.</p>}
      {all.map((e) => (
        <EventRow key={e.id} e={e} />
      ))}
    </div>
  );
}
