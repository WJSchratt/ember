import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../context/AuthContext.jsx';
import { avatarHueClass, iconForInterest, initials } from '../ui.js';

function RoomCard({ e, onJoin, joining }) {
  const navigate = useNavigate();
  const primaryTag = e.interests[0]?.name;

  return (
    <div className="card" onClick={() => navigate(`/events/${e.id}`)} style={{ cursor: 'pointer' }}>
      <div className="room-card-head">
        <i className={`ti ti-${iconForInterest(primaryTag)}`} aria-hidden="true" />
        <span className="title">{e.title}</span>
        {e.locked && <span className="badge locked">locked</span>}
      </div>
      <p className="room-card-meta">
        {new Date(e.scheduledAt).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })} ·{' '}
        {e.memberCount} of {e.capacity} joined
        {e.location ? ` · ${e.location}` : ''}
      </p>
      <div className="room-card-foot">
        <div className="avatar-stack">
          {e.members.slice(0, 3).map((m) => (
            <span key={m.id} className={`avatar avatar-sm ${avatarHueClass(m.id)}`}>
              {initials(m.displayName)}
            </span>
          ))}
          {e.memberCount > 3 && (
            <span className="avatar avatar-sm warning">+{e.memberCount - 3}</span>
          )}
        </div>
        {e.isMember ? (
          <button className="btn btn-ghost" onClick={(ev) => ev.stopPropagation()}>
            Open
          </button>
        ) : (
          <button
            className="btn btn-primary"
            disabled={e.locked || joining === e.id}
            onClick={(ev) => {
              ev.stopPropagation();
              onJoin(e.id);
            }}
          >
            {joining === e.id ? '...' : 'Join'}
          </button>
        )}
      </div>
    </div>
  );
}

export default function Events() {
  const { token, user } = useAuth();
  const navigate = useNavigate();
  const [all, setAll] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [joining, setJoining] = useState(null);
  const [status, setStatus] = useState('');

  async function reload() {
    const allData = await api.events(token);
    setAll(allData);
    setLoading(false);
  }

  useEffect(() => {
    reload();
  }, [token]);

  const filterOptions = useMemo(() => {
    const names = new Set();
    all.forEach((e) => e.interests.forEach((i) => names.add(i.name)));
    return ['all', ...[...names].sort()];
  }, [all]);

  const mine = all.filter((e) => e.isMember);
  const browsable = all.filter(
    (e) => !e.isMember && (filter === 'all' || e.interests.some((i) => i.name === filter))
  );

  async function handleJoin(eventId) {
    setJoining(eventId);
    setStatus('');
    const res = await api.matchEvent(token, eventId);
    setJoining(null);
    if (res.newlyMatched.some((m) => m.id === user.id)) {
      navigate(`/events/${eventId}`);
    } else {
      setStatus(res.reason || "Couldn't join — no shared interests with this room.");
      reload();
    }
  }

  if (loading) return <div className="page">Loading...</div>;

  return (
    <div className="page">
      <div className="filterbar">
        {filterOptions.map((name) => (
          <span
            key={name}
            className={`pill ${filter === name ? 'active' : ''}`}
            onClick={() => setFilter(name)}
          >
            {name === 'all' ? 'All' : name[0].toUpperCase() + name.slice(1)}
          </span>
        ))}
      </div>

      {browsable.length === 0 && (
        <p className="muted" style={{ marginBottom: '1rem' }}>
          Nothing open in this category right now.
        </p>
      )}
      {browsable.map((e) => (
        <RoomCard key={e.id} e={e} onJoin={handleJoin} joining={joining} />
      ))}
      {status && <p className="muted">{status}</p>}

      <div className="dashed-card" onClick={() => navigate('/create')}>
        <i className="ti ti-plus" aria-hidden="true" />
        <span>Start a hangout</span>
      </div>

      {mine.length > 0 && (
        <>
          <p className="section-title">Your rooms</p>
          {mine.map((e) => (
            <RoomCard key={e.id} e={e} onJoin={handleJoin} joining={joining} />
          ))}
        </>
      )}
    </div>
  );
}
