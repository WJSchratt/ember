import { useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../context/AuthContext.jsx';
import { avatarHueClass, iconForInterest, iconGradientClass, initials } from '../ui.js';
import Countdown from '../Countdown.jsx';

const POLL_MS = 3000;

export default function Room() {
  const { id } = useParams();
  const { token, user } = useAuth();
  const [detail, setDetail] = useState(null);
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState('');
  const [error, setError] = useState('');
  const [matchStatus, setMatchStatus] = useState('');
  const logRef = useRef(null);

  useEffect(() => {
    let cancelled = false;

    async function loadDetail() {
      const data = await api.event(token, id);
      if (!cancelled) setDetail(data);
    }
    loadDetail();
    const detailInterval = setInterval(loadDetail, POLL_MS * 2);

    return () => {
      cancelled = true;
      clearInterval(detailInterval);
    };
  }, [id, token]);

  useEffect(() => {
    if (!detail?.isMember) return;
    let cancelled = false;

    async function loadMessages() {
      try {
        const data = await api.messages(token, id);
        if (!cancelled) setMessages(data);
      } catch {
        // ignore transient poll errors
      }
    }
    loadMessages();
    const interval = setInterval(loadMessages, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [id, token, detail?.isMember]);

  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [messages]);

  async function checkForMatch() {
    setMatchStatus('Checking...');
    const res = await api.matchEvent(token, id);
    const data = await api.event(token, id);
    setDetail(data);
    setMatchStatus(
      res.newlyMatched.some((m) => m.id === user.id)
        ? "You're in! Room updated."
        : res.reason || 'No new match yet.'
    );
  }

  async function send(e) {
    e.preventDefault();
    if (!draft.trim()) return;
    setError('');
    try {
      const msg = await api.sendMessage(token, id, draft);
      setMessages((prev) => [...prev, msg]);
      setDraft('');
    } catch (err) {
      setError(err.message);
    }
  }

  if (!detail) return <div className="page">Loading...</div>;
  const { event, interests, members, isMember } = detail;
  const primaryTag = interests[0]?.name;

  return (
    <div className="page">
      <Link to="/rooms" className="back-link">
        <i className="ti ti-arrow-left" aria-hidden="true" /> Rooms
      </Link>
      <div className="room-card-head" style={{ marginBottom: 2 }}>
        <div className={`icon-badge ${iconGradientClass(primaryTag)}`} style={{ width: 40, height: 40 }}>
          <i className={`ti ti-${iconForInterest(primaryTag)}`} style={{ fontSize: 19 }} aria-hidden="true" />
        </div>
        <span className="title" style={{ fontSize: 18 }}>
          {event.title}
        </span>
        <span className={`badge ${event.locked ? 'locked' : 'open'}`}>{event.locked ? 'locked' : 'open'}</span>
      </div>
      <p className="muted">
        {new Date(event.scheduledAt).toLocaleString()} ·{' '}
        <Countdown scheduledAt={event.scheduledAt} locked={event.locked} />
      </p>
      {event.location && <p className="muted">📍 {event.location}</p>}
      {event.description && <p style={{ margin: '0.5rem 0' }}>{event.description}</p>}

      <div className="card" style={{ marginTop: '0.75rem' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
          {interests.map((i) => (
            <span key={i.id} className="tag-chip">
              {i.name}
            </span>
          ))}
        </div>
        <div className="avatar-stack" style={{ marginBottom: 4 }}>
          {members.map((m) => (
            <span key={m.id} className={`avatar avatar-sm ${avatarHueClass(m.id)}`} title={m.displayName}>
              {initials(m.displayName)}
            </span>
          ))}
        </div>
        <p className="muted">
          {members.length}/{event.capacity} — {members.map((m) => m.displayName).join(', ') || 'nobody yet'}
        </p>
      </div>

      {!isMember && (
        <div className="card">
          <p className="muted">You're not matched into this room yet.</p>
          <button className="btn btn-primary" onClick={checkForMatch} disabled={event.locked}>
            Check for a match
          </button>
          {matchStatus && <p className="muted" style={{ marginTop: 6 }}>{matchStatus}</p>}
        </div>
      )}

      {isMember && (
        <div className="card">
          <div className="chat-log" ref={logRef}>
            {messages.length === 0 && <p className="muted">No messages yet — say hi.</p>}
            {messages.map((m) => {
              const isBot = m.displayName === 'Roomless';
              return (
                <div key={m.id} className={`chat-row ${m.userId === user.id ? 'mine' : ''}`}>
                  {m.userId !== user.id && (
                    <span className={`avatar avatar-sm ${isBot ? '' : avatarHueClass(m.userId)}`} style={isBot ? { background: 'var(--fill-primary)', color: 'var(--on-primary)' } : undefined}>
                      {isBot ? <i className="ti ti-flame" style={{ fontSize: 11 }} aria-hidden="true" /> : initials(m.displayName)}
                    </span>
                  )}
                  <div className="chat-bubble" style={isBot ? { fontStyle: 'italic', color: 'var(--text-secondary)' } : undefined}>
                    {m.body}
                  </div>
                  {m.userId === user.id && (
                    <span className={`avatar avatar-sm ${avatarHueClass(m.userId)}`}>{initials(m.displayName)}</span>
                  )}
                </div>
              );
            })}
          </div>
          {error && <div className="error">{error}</div>}
          {event.locked ? (
            <p className="muted">This room is locked — the event has already happened.</p>
          ) : (
            <form className="chat-input-row" onSubmit={send}>
              <input
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder="Say something..."
              />
              <button className="btn btn-primary" type="submit">
                Send
              </button>
            </form>
          )}
        </div>
      )}
    </div>
  );
}
