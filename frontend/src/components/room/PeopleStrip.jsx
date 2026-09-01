import { avatarColor, initials } from './roomColor.js';

export default function PeopleStrip({ members, currentUserId }) {
  return (
    <div className="people-strip">
      {members.map((m) => (
        <span
          key={m.id}
          className="p-avatar"
          style={
            m.id === currentUserId
              ? { background: 'var(--grad-accent)', color: '#fff' }
              : { background: avatarColor(m.id) }
          }
          title={m.displayName}
        >
          {initials(m.displayName)}
        </span>
      ))}
      <span className="count">{members.length} tethered</span>
    </div>
  );
}
