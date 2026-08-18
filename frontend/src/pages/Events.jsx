import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../context/AuthContext.jsx';
import { avatarHueClass, iconForInterest, iconGradientClass, initials } from '../ui.js';
import Countdown from '../Countdown.jsx';

function RoomCard({ e, onJoin, joining }) {
  const navigate = useNavigate();
  const primaryTag = e.interests[0]?.name;

  return (
    <div
      className={`card ${e.isMember ? 'hero' : ''}`}
      onClick={() => navigate(`/events/${e.id}`)}
      style={{ cursor: 'pointer' }}
    >
      <div className="room-card-head" style={{ justifyContent: 'space-between', marginBottom: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div className={`icon-badge ${iconGradientClass(primaryTag)}`}>
            <i className={`ti ti-${iconForInterest(primaryTag)}`} aria-hidden="true" />
          </div>
          <div>
            <div className="title">{e.title}</div>
            <p className="room-card-meta" style={{ margin: 0 }}>
              <Countdown scheduledAt={e.scheduledAt} locked={e.locked} />
            </p>
          </div>
        </div>
        <span className={`badge ${e.locked ? 'locked' : 'open'}`}>
          {e.memberCount}/{e.capacity}
        </span>
      </div>
      {e.location && <p className="room-card-meta">📍 {e.location}</p>}
      <div className="room-card-foot">
        <div className="avatar-stack">
          {e.members.slice(0, 3).map((m) => (
            <span key={m.id} className={`avatar avatar-sm ${avatarHueClass(m.id)}`}>
              {initials(m.displayName)}
            </span>
          ))}
          {e.memberCount > 3 && (
            <span className="avatar avatar-sm" style={{ background: 'rgba(255,255,255,0.1)', color: '#d4d4d8' }}>
              +{e.memberCount - 3}
            </span>
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
  const [suggestions, setSuggestions] = useState([]);
  const [suggestionsLoading, setSuggestionsLoading] = useState(true);
  const [creatingSuggestion, setCreatingSuggestion] = useState(null);

  async function reload() {
    const allData = await api.events(token);
    setAll(allData);
    setLoading(false);
  }

  useEffect(() => {
    reload();
  }, [token]);

  useEffect(() => {
    api
      .suggestions(token)
      .then(setSuggestions)
      .catch(() => setSuggestions([]))
      .finally(() => setSuggestionsLoading(false));
  }, [token]);

  async function createSuggestion(s) {
    setCreatingSuggestion(s.title);
    const scheduledAt = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString();
    try {
      const data = await api.createEvent(token, {
        title: s.title,
        description: s.reason,
        scheduledAt,
        interestIds: s.interestIds,
      });
      navigate(`/events/${data.event.id}`);
    } finally {
      setCreatingSuggestion(null);
    }
  }

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
      {!suggestionsLoading && suggestions.length > 0 && (
        <>
          <p className="section-title" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <i className="ti ti-sparkles" aria-hidden="true" /> Suggested for you
          </p>
          <div className="filterbar" style={{ paddingTop: 0 }}>
            {suggestions.map((s) => (
              <div key={s.title} className="card ai-suggestion-card">
                <div className="room-card-head">
                  <div className={`icon-badge ${iconGradientClass(s.interestNames[0])}`}>
                    <i className={`ti ti-${iconForInterest(s.interestNames[0])}`} aria-hidden="true" />
                  </div>
                  <span className="title">{s.title}</span>
                </div>
                <p className="room-card-meta">{s.reason}</p>
                <button
                  className="btn btn-primary"
                  disabled={creatingSuggestion === s.title}
                  onClick={() => createSuggestion(s)}
                >
                  {creatingSuggestion === s.title ? '...' : 'Create this'}
                </button>
              </div>
            ))}
          </div>
        </>
      )}

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
