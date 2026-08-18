import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../context/AuthContext.jsx';
import RoomCard from '../RoomCard.jsx';

export default function Rooms() {
  const { token } = useAuth();
  const navigate = useNavigate();
  const [mine, setMine] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.myEvents(token).then((data) => {
      setMine(data);
      setLoading(false);
    });
  }, [token]);

  if (loading) return <div className="page">Loading...</div>;

  const active = mine.filter((e) => !e.locked);
  const past = mine.filter((e) => e.locked);

  return (
    <div className="page">
      <p className="section-title">Your rooms</p>
      {active.length === 0 && past.length === 0 && (
        <div className="card">
          <p className="muted">
            You haven't been matched into a room yet. Join a hangout from Home, or start your own.
          </p>
          <button className="btn btn-primary" style={{ marginTop: 10 }} onClick={() => navigate('/')}>
            Browse hangouts
          </button>
        </div>
      )}

      {active.length > 0 && (
        <div className="room-grid" style={{ marginBottom: past.length ? '1.5rem' : 0 }}>
          {active.map((e) => (
            <RoomCard key={e.id} e={e} />
          ))}
        </div>
      )}

      {past.length > 0 && (
        <>
          <p className="section-title">Past</p>
          <div className="room-grid">
            {past.map((e) => (
              <RoomCard key={e.id} e={e} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
