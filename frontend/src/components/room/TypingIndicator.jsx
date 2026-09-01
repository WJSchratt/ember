import { avatarColor, initials } from './roomColor.js';

export default function TypingIndicator({ typingUsers }) {
  return typingUsers.map((u) => (
    <div className="typing-row" key={u.id}>
      <div className="row-avatar" style={{ background: avatarColor(u.id) }}>
        {initials(u.displayName)}
      </div>
      <div className="typing-dots">
        <span />
        <span />
        <span />
      </div>
    </div>
  ));
}
