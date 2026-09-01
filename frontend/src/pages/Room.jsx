import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../context/AuthContext.jsx';
import { avatarHueClass, iconForInterest, iconGradientClass, initials } from '../ui.js';
import Countdown from '../Countdown.jsx';
import RoomHeader from '../components/room/RoomHeader.jsx';
import FuseTimer from '../components/room/FuseTimer.jsx';
import PeopleStrip from '../components/room/PeopleStrip.jsx';
import MessageStack from '../components/room/MessageStack.jsx';
import Composer from '../components/room/Composer.jsx';
import '../components/room/room.css';

const POLL_MS = 3000;
const TYPING_POLL_MS = 2000;
const TYPING_PING_THROTTLE_MS = 2000;
const CLOSE_REDIRECT_MS = 4000;

export default function Room() {
  const { id } = useParams();
  const { token, user } = useAuth();
  const navigate = useNavigate();
  const [detail, setDetail] = useState(null);
  const [messages, setMessages] = useState([]);
  const [messagesLoading, setMessagesLoading] = useState(true);
  const [typingUsers, setTypingUsers] = useState([]);
  const [draft, setDraft] = useState('');
  const [error, setError] = useState('');
  const [matchStatus, setMatchStatus] = useState('');
  const [leaving, setLeaving] = useState(false);
  const [online, setOnline] = useState(navigator.onLine);
  const [pollFailing, setPollFailing] = useState(false);
  const lastTypingPingRef = useRef(0);
  const closeTimerRef = useRef(null);

  useEffect(() => {
    function goOnline() { setOnline(true); }
    function goOffline() { setOnline(false); }
    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);
    return () => {
      window.removeEventListener('online', goOnline);
      window.removeEventListener('offline', goOffline);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    let failures = 0;

    async function loadDetail() {
      try {
        const data = await api.event(token, id);
        if (!cancelled) {
          setDetail(data);
          failures = 0;
          setPollFailing(false);
        }
      } catch {
        failures += 1;
        if (!cancelled && failures >= 2) setPollFailing(true);
      }
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
        if (!cancelled) {
          setMessages(data);
          setMessagesLoading(false);
        }
      } catch {
        // transient poll errors are surfaced via the offline banner, not here
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
    if (!detail?.isMember || detail.event.locked) {
      setTypingUsers([]);
      return;
    }
    let cancelled = false;

    async function loadTyping() {
      try {
        const data = await api.typingUsers(token, id);
        if (!cancelled) setTypingUsers(data);
      } catch {
        // ignore transient poll errors
      }
    }
    loadTyping();
    const interval = setInterval(loadTyping, TYPING_POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [id, token, detail?.isMember, detail?.event.locked]);

  useEffect(() => {
    if (!detail?.isMember || !detail.event.locked || closeTimerRef.current) return;
    closeTimerRef.current = setTimeout(() => navigate('/rooms'), CLOSE_REDIRECT_MS);
    return () => {
      clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    };
  }, [detail?.isMember, detail?.event.locked, navigate]);

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

  async function leaveRoom() {
    setLeaving(true);
    try {
      await api.leaveRoom(token, id);
      navigate('/rooms');
    } finally {
      setLeaving(false);
    }
  }

  function handleTyping() {
    const now = Date.now();
    if (now - lastTypingPingRef.current < TYPING_PING_THROTTLE_MS) return;
    lastTypingPingRef.current = now;
    api.pingTyping(token, id).catch(() => {});
  }

  async function send() {
    if (!draft.trim()) return;
    setError('');
    const body = draft.trim();
    setDraft('');
    try {
      const msg = await api.sendMessage(token, id, body);
      setMessages((prev) => [...prev, msg]);
    } catch (err) {
      setDraft(body);
      setError(err.message);
    }
  }

  if (!detail) return <div className="page">Loading...</div>;
  const { event, interests, members, isMember } = detail;
  const primaryTag = interests[0]?.name;
  const disconnected = !online || pollFailing;

  return (
    <div className="page">
      <Link to="/rooms" className="back-link">
        <i className="ti ti-arrow-left" aria-hidden="true" /> Rooms
      </Link>

      {!isMember && (
        <>
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

          <div className="card">
            <p className="muted">You're not matched into this room yet.</p>
            <button className="btn btn-primary" onClick={checkForMatch} disabled={event.locked}>
              Check for a match
            </button>
            {matchStatus && <p className="muted" style={{ marginTop: 6 }}>{matchStatus}</p>}
          </div>
        </>
      )}

      {isMember && (
        <div className="room-v4" style={{ marginTop: '0.5rem' }}>
          {disconnected && <div className="offline-banner">reconnecting...</div>}
          <RoomHeader
            title={event.title}
            topic={primaryTag}
            subLabel={`${members.length} people, ${primaryTag || 'new room'}`}
            onLeave={leaveRoom}
            leaving={leaving}
          />
          <FuseTimer scheduledAt={event.scheduledAt} createdAt={event.createdAt} locked={event.locked} />
          <PeopleStrip members={members} currentUserId={user.id} />
          <MessageStack
            messages={messages}
            currentUserId={user.id}
            typingUsers={typingUsers}
            loading={messagesLoading}
          />
          {error && <div className="error" style={{ padding: '0 20px' }}>{error}</div>}
          <Composer
            value={draft}
            onChange={setDraft}
            onSend={send}
            onTyping={handleTyping}
            disabled={event.locked}
          />
        </div>
      )}
    </div>
  );
}
