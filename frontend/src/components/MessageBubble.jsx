import '../App.css'

export default function MessageBubble({ message, onSelectOption }) {
  const metadata = message.metadata_json || {}
  const options = metadata.design_options || []
  const context = metadata.context

  return (
    <div className={`chat-bubble ${message.role}`}>
      <p className="chat-meta">
        {message.role} · {new Date(message.created_at).toLocaleString()}
      </p>
      <p>{message.content}</p>
      {message.role === 'assistant' && options.length > 0 && (
        <div className="options-panel">
          <h3>Design options</h3>
          <div className="options-grid">
            {options.map((option, index) => (
              <div key={index} className="option-card">
                <h4>{option.title}</h4>
                <p>{option.description}</p>
                <p className="muted">{option.image_prompt}</p>
                <button
                  className="ghost"
                  type="button"
                  onClick={() => onSelectOption(index + 1)}
                >
                  Select option
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
      {message.role === 'assistant' && context && (
        <details className="context-panel">
          <summary>Context used</summary>
          <ContextSummary context={context} />
        </details>
      )}
    </div>
  )
}

function ContextSummary({ context }) {
  const preferences = context.preferences || []
  const reference = context.reference_project
  const referenceSummary = context.reference_summary || {}
  const canonicalVersion = referenceSummary.latest_version
  const recentImages = referenceSummary.recent_images || []
  const recentEvents = referenceSummary.recent_events || []
  const targetEvents = context.target_recent_events || []

  return (
    <div className="context-summary">
      <div>
        <strong>Preferences</strong>
        <div className="context-tags">
          {preferences.length
            ? preferences.slice(0, 6).map((pref) => (
                <span key={`${pref.key}-${pref.value}`} className="tag">
                  {pref.key}: {pref.value}
                </span>
              ))
            : 'None'}
        </div>
      </div>
      <div>
        <strong>Reference</strong>
        <p className="muted">
          {reference ? `${reference.title} (${reference.room_type})` : 'None'}
        </p>
        {canonicalVersion && (
          <p className="muted">Canonical version: v{canonicalVersion.version_number}</p>
        )}
      </div>
      <div className="context-stats">
        <span>Ref images: {recentImages.length}</span>
        <span>Ref events: {recentEvents.length}</span>
        <span>Target events: {targetEvents.length}</span>
      </div>
    </div>
  )
}
