import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../context/AuthContext.jsx';
import { iconForInterest, iconGradientClass } from '../ui.js';
import RoomCard from '../RoomCard.jsx';

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

  const browsable = all.filter(
    (e) => !e.isMember && (filter === 'all' || e.interests.some((i) => i.name === filter))
  );

  // Joining here uses the same tag-matching endpoint the AI "Create this" and
  // "Check for a match" flows use — a click never bypasses eligibility, it
  // just triggers the same match check and, on success, drops you straight
  // into the room's chat instead of a separate confirmation step.
  async function handleJoin(eventId) {
    setJoining(eventId);
    setStatus('');
    const res = await api.matchEvent(token, eventId);
    setJoining(null);
    if (res.newlyMatched.some((m) => m.id === user.id)) {
      navigate(`/events/${eventId}`);
    } else {
      setStatus(res.reason || "Couldn't join — no shared interests, the room is full, or you're already committed to another open room.");
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

      {status && <p className="muted" style={{ marginBottom: '0.75rem' }}>{status}</p>}

      {browsable.length === 0 ? (
        <p className="muted" style={{ marginBottom: '1.5rem' }}>
          Nothing open in this category right now — try a different tag, or start your own below.
        </p>
      ) : (
        <div className="room-grid" style={{ marginBottom: '1.5rem' }}>
          {browsable.map((e) => (
            <RoomCard key={e.id} e={e} onJoin={handleJoin} joining={joining} />
          ))}
        </div>
      )}

      {!suggestionsLoading && suggestions.length > 0 && (
        <>
          <p className="section-title" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <i className="ti ti-sparkles" aria-hidden="true" /> AI-suggested hangouts
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

      <div className="dashed-card" onClick={() => navigate('/create')}>
        <i className="ti ti-plus" aria-hidden="true" />
        <span>Start your own hangout</span>
      </div>
    </div>
  );
}
