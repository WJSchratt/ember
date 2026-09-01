export default function MessageRow({ name, avatarColor, initial, text, time, isMe, isBot }) {
  return (
    <div className={`row${isMe ? ' me' : ''} new`}>
      <div className="row-avatar" style={isBot ? { background: 'var(--ink)', color: 'var(--bg)' } : { background: avatarColor }}>
        {isBot ? <i className="ti ti-flame" style={{ fontSize: 13 }} aria-hidden="true" /> : initial}
      </div>
      <div className="row-body">
        <div className="row-meta">
          <span className="row-name">{name}</span>
          <span className="row-time">{time}</span>
        </div>
        <div className={`row-text${isBot ? ' bot-text' : ''}`}>{text}</div>
      </div>
    </div>
  );
}
