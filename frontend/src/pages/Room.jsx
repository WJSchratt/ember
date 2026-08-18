import { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../context/AuthContext.jsx';

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

  if (!detail) return <div className="container">Loading...</div>;
  const { event, interests, members, isMember } = detail;

  return (
    <div className="container">
      <h1>
        {event.title}
        {event.locked ? <span className="locked-badge">locked</span> : <span className="open-badge">open</span>}
      </h1>
      <p className="muted">{new Date(event.scheduledAt).toLocaleString()}</p>
      {event.location && <p className="muted">📍 {event.location}</p>}
      {event.description && <p>{event.description}</p>}

      <div className="card">
        <div>
          {interests.map((i) => (
            <span key={i.id} className="tag static">
              {i.name}
            </span>
          ))}
        </div>
        <p className="muted" style={{ marginTop: '0.5rem' }}>
          Room: {members.length}/{event.capacity} — {members.map((m) => m.displayName).join(', ') || 'nobody yet'}
        </p>
      </div>

      {!isMember && (
        <div className="card">
          <p className="muted">You're not matched into this room yet.</p>
          <button className="primary" onClick={checkForMatch} disabled={event.locked}>
            Check for a match
          </button>
          {matchStatus && <p className="muted">{matchStatus}</p>}
        </div>
      )}

      {isMember && (
        <div className="card">
          <div className="chat-log" ref={logRef}>
            {messages.length === 0 && <p className="muted">No messages yet — say hi.</p>}
            {messages.map((m) => (
              <div key={m.id} className={`chat-msg ${m.userId === user.id ? 'mine' : ''}`}>
                <div className="meta">{m.displayName}</div>
                <div className="bubble">{m.body}</div>
              </div>
            ))}
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
              <button className="primary" type="submit">
                Send
              </button>
            </form>
          )}
        </div>
      )}
    </div>
  );
}
