import '../App.css'

export default function Composer({
  value,
  onChange,
  onSend,
  disabled,
}) {
  const handleKeyDown = (event) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault()
      onSend()
    }
  }

  return (
    <div className="chat-input">
      <textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Describe the next design change..."
        rows={2}
        className="chat-textarea"
      />
      <button onClick={onSend} type="button" disabled={disabled}>
        Send
      </button>
    </div>
  )
}
