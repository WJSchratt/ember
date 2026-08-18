import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../context/AuthContext.jsx';
import { iconForInterest, iconGradientClass, MAX_OPEN_ROOMS } from '../ui.js';
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
  const [myInterestNames, setMyInterestNames] = useState([]);
  const [search, setSearch] = useState('');

  async function reload() {
    const allData = await api.events(token);
    setAll(allData);
    setLoading(false);
  }

  useEffect(() => {
    reload();
  }, [token]);

  useEffect(() => {
    api.me(token).then((data) => setMyInterestNames(data.interests.map((i) => i.name)));
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
    } catch (err) {
      setStatus(err.message);
    } finally {
      setCreatingSuggestion(null);
    }
  }

  const myRooms = all.filter((e) => e.isMember && !e.locked);
  const atCap = myRooms.length >= MAX_OPEN_ROOMS;

  // The whole point of this app is tag-matched rooms, not a browse-everything
  // feed — so what's joinable here is derived directly from your current
  // interests. Change your interests on Profile and this list changes on the
  // next visit to Home, because it's filtered from myInterestNames, not from
  // a static "all events" list with a cosmetic filter bolted on top.
  const mySet = useMemo(() => new Set(myInterestNames), [myInterestNames]);
  const matchable = useMemo(
    () => all.filter((e) => !e.isMember && e.interests.some((i) => mySet.has(i.name))),
    [all, mySet]
  );

  const filterOptions = useMemo(() => {
    const names = new Set();
    matchable.forEach((e) => e.interests.forEach((i) => mySet.has(i.name) && names.add(i.name)));
    return ['all', ...[...names].sort()];
  }, [matchable, mySet]);

  useEffect(() => {
    if (!filterOptions.includes(filter)) setFilter('all');
  }, [filterOptions, filter]);

  const searching = search.trim().length > 0;

  // Search looks across every open room by title, not just ones matching
  // your interests — it's a lookup tool, separate from the interest-driven
  // default feed. Clearing the box goes right back to that feed.
  const searchResults = useMemo(() => {
    if (!searching) return [];
    const q = search.trim().toLowerCase();
    return all.filter((e) => !e.isMember && !e.locked && e.title.toLowerCase().includes(q));
  }, [all, search, searching]);

  const browsable = matchable.filter(
    (e) => filter === 'all' || e.interests.some((i) => i.name === filter)
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
      <p className="section-title">Your rooms</p>
      {myRooms.length === 0 ? (
        <div className="card" style={{ marginBottom: '1.5rem' }}>
          <p className="muted">You're not in a room yet — join one below, or start your own.</p>
        </div>
      ) : (
        <div className="room-grid" style={{ marginBottom: '1.5rem' }}>
          {myRooms.map((e) => (
            <RoomCard key={e.id} e={e} />
          ))}
        </div>
      )}

      {atCap ? (
        <p className="muted" style={{ marginBottom: '1.5rem' }}>
          You're in {MAX_OPEN_ROOMS} rooms already — leave one (from the room or from Rooms) to join or start another.
        </p>
      ) : (
        <>
          <p className="section-title">
            {myRooms.length === 0 ? 'Join a hangout' : 'Join one more'}
          </p>

          <div className="search-row">
            <i className="ti ti-search" aria-hidden="true" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search rooms by name..."
            />
            {searching && (
              <button className="search-clear" onClick={() => setSearch('')} aria-label="Clear search">
                <i className="ti ti-x" aria-hidden="true" />
              </button>
            )}
          </div>

          {status && <p className="muted" style={{ marginBottom: '0.75rem' }}>{status}</p>}

          {searching ? (
            searchResults.length === 0 ? (
              <p className="muted" style={{ marginBottom: '1.5rem' }}>
                No open rooms match "{search.trim()}".
              </p>
            ) : (
              <div className="room-grid" style={{ marginBottom: '1.5rem' }}>
                {searchResults.map((e) => (
                  <RoomCard key={e.id} e={e} onJoin={handleJoin} joining={joining} />
                ))}
              </div>
            )
          ) : (
            <>
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

              {browsable.length === 0 ? (
                <p className="muted" style={{ marginBottom: '1.5rem' }}>
                  {myInterestNames.length === 0
                    ? 'Add some interests on your profile to see hangouts you can join.'
                    : 'Nothing matches your interests right now — try adding more on your profile, or start your own below.'}
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
            </>
          )}
        </>
      )}

      <div className="dashed-card" onClick={() => navigate('/create')}>
        <i className="ti ti-plus" aria-hidden="true" />
        <span>Start your own hangout</span>
      </div>
    </div>
  );
}
