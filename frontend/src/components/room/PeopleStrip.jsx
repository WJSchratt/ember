import { avatarColor, initials } from './roomColor.js';

export default function PeopleStrip({ members, currentUserId }) {
  return (
    <div className="people-strip">
      {members.map((m) => (
        <span
          key={m.id}
          className="p-avatar"
          style={{ background: m.id === currentUserId ? 'var(--accent)' : avatarColor(m.id) }}
          title={m.displayName}
        >
          {initials(m.displayName)}
        </span>
      ))}
      <span className="count">{members.length} tethered</span>
    </div>
  );
}
