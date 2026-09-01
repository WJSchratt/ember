export default function RoomHeader({ title, topic, subLabel, onLeave, leaving }) {
  return (
    <div className="topbar">
      <div>
        <div className="room-id-row">
          <div className="room-name display">{title}</div>
          {topic && <span className="spark-pill">{topic}</span>}
        </div>
        {subLabel && <div className="room-sub">{subLabel}</div>}
      </div>
      <button className="leave-btn" onClick={onLeave} disabled={leaving}>
        {leaving ? 'Leaving...' : 'Leave'}
      </button>
    </div>
  );
}
