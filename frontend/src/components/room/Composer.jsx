export default function Composer({ value, onChange, onSend, onTyping, disabled }) {
  function handleChange(e) {
    onChange(e.target.value);
    if (e.target.value.trim()) onTyping();
  }

  function submit() {
    if (disabled || !value.trim()) return;
    onSend();
  }

  return (
    <div className="composer">
      <div className={`composer-inner${disabled ? ' disabled' : ''}`}>
        <input
          type="text"
          value={value}
          onChange={handleChange}
          onKeyDown={(e) => {
            if (e.key === 'Enter') submit();
          }}
          placeholder={disabled ? 'This room is closed' : 'Say something...'}
          disabled={disabled}
        />
        <button className="send-btn" onClick={submit} disabled={disabled || !value.trim()}>
          Send
        </button>
      </div>
    </div>
  );
}
