import { useNavigate } from 'react-router-dom';
import { avatarHueClass, iconForInterest, iconGradientClass, initials } from './ui.js';
import Countdown from './Countdown.jsx';

export default function RoomCard({ e, onJoin, joining }) {
  const navigate = useNavigate();
  const primaryTag = e.interests[0]?.name;

  // Members go straight into the room's chat. Non-members trigger the same
  // join attempt the button does — clicking the card used to navigate into
  // a room you're not in, landing on a confusing "not matched yet" preview
  // instead of doing anything useful.
  function handleCardClick() {
    if (e.isMember) {
      navigate(`/events/${e.id}`);
    } else if (!e.locked && joining !== e.id) {
      onJoin(e.id);
    }
  }

  return (
    <div
      className={`card ${e.isMember ? 'hero' : ''}`}
      onClick={handleCardClick}
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
          <button className="btn btn-ghost" onClick={(ev) => { ev.stopPropagation(); navigate(`/events/${e.id}`); }}>
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
