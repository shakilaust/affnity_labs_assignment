import '../App.css'
import Composer from './Composer'
import MessageBubble from './MessageBubble'

const ROOM_LABELS = {
  bedroom: 'Bedroom',
  living_room: 'Living room',
  office: 'Office',
  other: 'Other',
}

const formatRoomType = (value) => ROOM_LABELS[value] || value

export default function ChatPanel({
  health,
  selectedProject,
  messages,
  starterPrompts,
  onSelectOption,
  onSendMessage,
  onPromptClick,
  chatInput,
  setChatInput,
  chatEndRef,
  disabled,
  onRetry,
  isLoading,
  onSaveDesign,
}) {
  return (
    <main className="chat-panel">
      <header className="chat-header">
        <div>
          <h1>{selectedProject ? selectedProject.title : 'ChatGPT-style designer'}</h1>
          <p className="muted">
            {selectedProject
              ? formatRoomType(selectedProject.room_type)
              : 'Select a project or create a new one to begin'}
          </p>
        </div>
        {selectedProject && (
          <div className="header-actions">
            <button className="ghost small" type="button" onClick={onSaveDesign}>
              Save design
            </button>
          </div>
        )}
        <div className="health-pill">
          {health.status === 'loading' && <span>Checking...</span>}
          {health.status === 'error' && <span className="error">Error</span>}
          {health.status !== 'loading' && health.status !== 'error' && (
            <span className="ok">API {health.status}</span>
          )}
        </div>
      </header>

      <div className="chat-history">
        {!selectedProject && (
          <div className="chat-empty">
            <p className="muted large">Ready when you are.</p>
            <p className="muted">Select a project or create one on the left.</p>
          </div>
        )}
        {selectedProject && isLoading && (
          <div className="chat-empty">
            <div className="spinner" aria-label="Loading messages" />
            <p className="muted">Loading messages...</p>
          </div>
        )}
        {selectedProject && !isLoading && !messages.length && (
          <div className="chat-empty">
            <p className="muted">Tell me what vibe you want.</p>
            <div className="starter-prompts">
              {starterPrompts.map((prompt) => (
                <button
                  key={prompt}
                  type="button"
                  className="ghost"
                  onClick={() => onPromptClick(prompt)}
                >
                  {prompt}
                </button>
              ))}
            </div>
          </div>
        )}
        {!isLoading &&
          messages.map((message) => (
            <MessageBubble
              key={message.id}
            message={message}
            onSelectOption={onSelectOption}
            onRetry={onRetry}
          />
        ))}
        <div ref={chatEndRef} />
      </div>

      <Composer
        value={chatInput}
        onChange={setChatInput}
        onSend={onSendMessage}
        disabled={disabled}
      />
    </main>
  )
}
