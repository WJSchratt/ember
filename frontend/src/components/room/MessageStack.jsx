import { useEffect, useRef } from 'react';
import MessageRow from './MessageRow.jsx';
import TypingIndicator from './TypingIndicator.jsx';
import { avatarColor, initials } from './roomColor.js';

function formatTime(iso) {
  return new Date(iso).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

export default function MessageStack({ messages, currentUserId, typingUsers, loading }) {
  const stackRef = useRef(null);

  useEffect(() => {
    if (stackRef.current) stackRef.current.scrollTop = stackRef.current.scrollHeight;
  }, [messages.length, typingUsers.length]);

  return (
    <div className="stack" ref={stackRef}>
      {loading && <div className="system-row">Loading messages…</div>}
      {!loading && messages.length === 0 && (
        <div className="system-row">This room just formed — say hi to kick things off.</div>
      )}
      {!loading && messages.length > 0 && <div className="system-row">Room open — jump in.</div>}

      {messages.map((m) => {
        const isBot = m.displayName === 'Tether';
        const isMe = m.userId === currentUserId;
        return (
          <MessageRow
            key={m.id}
            name={isMe ? 'You' : m.displayName}
            avatarColor={avatarColor(m.userId)}
            initial={initials(m.displayName)}
            text={m.body}
            time={formatTime(m.createdAt)}
            isMe={isMe}
            isBot={isBot}
          />
        );
      })}

      <TypingIndicator typingUsers={typingUsers} />
    </div>
  );
}
