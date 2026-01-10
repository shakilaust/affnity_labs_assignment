import '../App.css'

export default function MessageBubble({ message, onSelectOption, onRetry }) {
  const metadata = message.metadata_json || {}
  const options = metadata.design_options || []
  const versionId = metadata.version_id
  const saved = metadata.saved

  return (
    <div className={`bubble-row ${message.role}`}>
      {message.role === 'assistant' && (
        <div className="avatar">DA</div>
      )}
      <div className={`chat-bubble ${message.role}`}>
        {message.role === 'assistant' && (
          <p className="chat-agent">Design Agent</p>
        )}
        <p className="chat-meta">
          {message.role} · {new Date(message.created_at).toLocaleString()}
        </p>
        <p>
          {message.isPending ? (
            <span className="thinking">
              Thinking<span className="dots">...</span>
            </span>
          ) : (
            message.content
          )}
        </p>
        {message.isError && (
          <button
            className="ghost small"
            type="button"
            onClick={() => onRetry?.(message.id, message.retryText)}
          >
            Retry
          </button>
        )}
        {message.role === 'assistant' && (versionId || saved) && (
          <div className="status-row">
            {versionId && <span className="status-pill">Revision created (v{versionId})</span>}
            {saved && <span className="status-pill success">Saved ✓</span>}
          </div>
        )}
        {message.role === 'assistant' && options.length > 0 && (
          <div className="options-panel">
            <h3>Design options</h3>
            <div className="options-grid">
              {options.map((option, index) => (
                <div key={index} className="option-card">
                  {option.image_url && (
                    <img
                      src={option.image_url}
                      alt={option.title}
                      loading="lazy"
                      onError={(event) => {
                        event.currentTarget.style.display = 'none'
                        const fallback = event.currentTarget.nextSibling
                        if (fallback) {
                          fallback.classList.add('show')
                        }
                        console.warn('Image failed to load', option.image_url)
                      }}
                    />
                  )}
                  <div className="image-fallback">Image failed to load</div>
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
      </div>
    </div>
  )
}
