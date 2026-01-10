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
}) {
  return (
    <main className="chat-panel">
      <header className="chat-header">
        <div>
          <h1>{selectedProject ? selectedProject.title : 'Select a project'}</h1>
          <p className="muted">
            {selectedProject ? formatRoomType(selectedProject.room_type) : 'Choose from the sidebar'}
          </p>
        </div>
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
            <p className="muted">Pick a project or create a new one to start chatting.</p>
          </div>
        )}
        {selectedProject && !messages.length && (
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
        {messages.map((message) => (
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
