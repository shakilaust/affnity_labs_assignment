import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { API_BASE, clearAuthToken, fetchJson, jsonHeaders } from '../api'
import '../App.css'

const ROOM_OPTIONS = [
  { value: 'bedroom', label: 'Bedroom' },
  { value: 'living_room', label: 'Living Room' },
  { value: 'office', label: 'Office' },
  { value: 'other', label: 'Other' },
]

const initialProjectForm = { title: '', room_type: 'bedroom' }

export default function AppShell() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const [health, setHealth] = useState({ status: 'loading', error: '' })
  const [currentUser, setCurrentUser] = useState(null)
  const [projectForm, setProjectForm] = useState(initialProjectForm)
  const [projects, setProjects] = useState([])
  const [selectedProjectId, setSelectedProjectId] = useState('')
  const [messages, setMessages] = useState([])
  const [chatInput, setChatInput] = useState('')
  const [actionError, setActionError] = useState('')
  const [showProjectModal, setShowProjectModal] = useState(false)
  const [projectPreviews, setProjectPreviews] = useState({})
  const chatEndRef = useRef(null)

  const selectedProject = useMemo(
    () => projects.find((project) => `${project.id}` === `${selectedProjectId}`),
    [projects, selectedProjectId]
  )

  const starterPrompts = useMemo(() => {
    if (!selectedProject) {
      return []
    }
    const promptsByRoom = {
      bedroom: [
        'Design a calm modern bedroom with warm tones.',
        'I want a cozy bedroom with soft lighting.',
      ],
      living_room: [
        'Create a living room that matches my bedroom vibe.',
        'I want a bright, modern living room with texture.',
      ],
      office: [
        'Design a simple, focused home office.',
        'Make the office minimal with warm wood accents.',
      ],
      other: ['Suggest a style direction for this space.'],
    }
    return promptsByRoom[selectedProject.room_type] || promptsByRoom.other
  }, [selectedProject])

  useEffect(() => {
    let isMounted = true
    fetchJson(`${API_BASE}/health`)
      .then((data) => {
        if (isMounted) {
          setHealth({ status: data.status ?? 'unknown', error: '' })
        }
      })
      .catch((err) => {
        if (isMounted) {
          setHealth({ status: 'error', error: err.message })
        }
      })
    return () => {
      isMounted = false
    }
  }, [])

  useEffect(() => {
    const loadMe = async () => {
      try {
        const data = await fetchJson(`${API_BASE}/auth/me`)
        setCurrentUser(data)
      } catch (err) {
        handleError(err)
      }
    }
    loadMe()
  }, [])

  useEffect(() => {
    if (currentUser?.id) {
      loadProjects()
    }
  }, [currentUser])

  useEffect(() => {
    if (selectedProjectId) {
      loadMessages(selectedProjectId)
      window.localStorage.setItem('active_project_id', selectedProjectId)
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev)
        next.set('p', selectedProjectId)
        return next
      })
    }
  }, [selectedProjectId, setSearchParams])

  useEffect(() => {
    if (chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [messages])

  useEffect(() => {
    const urlProjectId = searchParams.get('p')
    const storedProjectId = window.localStorage.getItem('active_project_id')
    const preferredId = urlProjectId || storedProjectId
    if (preferredId && preferredId !== selectedProjectId) {
      setSelectedProjectId(preferredId)
    }
  }, [searchParams, selectedProjectId])

  const handleError = (err) => {
    setActionError(err.message || 'Something went wrong')
    setTimeout(() => setActionError(''), 4000)
  }

  const loadProjects = async () => {
    if (!currentUser?.id) {
      handleError(new Error('Set a user id first'))
      return
    }
    try {
      const data = await fetchJson(`${API_BASE}/projects/?user_id=${currentUser.id}`)
      setProjects(data)
      if (data.length && !selectedProjectId) {
        setSelectedProjectId(`${data[0].id}`)
      }
    } catch (err) {
      handleError(err)
    }
  }

  const createProject = async () => {
    if (!currentUser?.id) {
      handleError(new Error('Set a user id first'))
      return
    }
    try {
      const payload = JSON.stringify({ ...projectForm, user: Number(currentUser.id) })
      const data = await fetchJson(`${API_BASE}/projects/`, {
        method: 'POST',
        headers: jsonHeaders,
        body: payload,
      })
      setProjects((prev) => [data, ...prev])
      setProjectForm(initialProjectForm)
      setSelectedProjectId(`${data.id}`)
      setShowProjectModal(false)
    } catch (err) {
      handleError(err)
    }
  }

  const loadMessages = async (projectId) => {
    if (!projectId) {
      return
    }
    try {
      setMessages([])
      const data = await fetchJson(`${API_BASE}/projects/${projectId}/messages/`)
      setMessages(data)
      const lastMessage = data[data.length - 1]
      if (lastMessage) {
        setProjectPreviews((prev) => ({
          ...prev,
          [projectId]: lastMessage,
        }))
      }
    } catch (err) {
      handleError(err)
    }
  }

  const sendMessage = async (overrideText) => {
    if (!selectedProjectId) {
      handleError(new Error('Select a project first'))
      return
    }
    const textToSend = (overrideText ?? chatInput).trim()
    if (!textToSend) {
      return
    }
    try {
      const payload = {
        project_id: Number(selectedProjectId),
        message: textToSend,
      }
      const data = await fetchJson(`${API_BASE}/agent/chat`, {
        method: 'POST',
        headers: jsonHeaders,
        body: JSON.stringify(payload),
      })
      setChatInput('')
      await loadMessages(selectedProjectId)
      setProjectPreviews((prev) => ({
        ...prev,
        [selectedProjectId]: {
          role: 'assistant',
          content: data.assistant_message,
          created_at: new Date().toISOString(),
        },
      }))
    } catch (err) {
      handleError(err)
    }
  }

  const selectDesignOption = async (optionIndex) => {
    if (!selectedProjectId || !currentUser?.id) {
      handleError(new Error('Select a project first'))
      return
    }
    try {
      await fetchJson(`${API_BASE}/feedback/`, {
        method: 'POST',
        headers: jsonHeaders,
        body: JSON.stringify({
          user: Number(currentUser.id),
          project: Number(selectedProjectId),
          design_version: null,
          event_type: 'select',
          payload_json: { selected_option_index: optionIndex },
        }),
      })
      await fetchJson(`${API_BASE}/projects/${selectedProjectId}/messages/`, {
        method: 'POST',
        headers: jsonHeaders,
        body: JSON.stringify({
          role: 'user',
          content: `I choose option ${optionIndex}.`,
        }),
      })
      await loadMessages(selectedProjectId)
    } catch (err) {
      handleError(err)
    }
  }

  const handleLogout = async () => {
    try {
      await fetchJson(`${API_BASE}/auth/logout`, { method: 'POST', headers: jsonHeaders })
    } catch (err) {
      handleError(err)
    } finally {
      clearAuthToken()
      navigate('/')
    }
  }

  const handleInputKeyDown = (event) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault()
      sendMessage()
    }
  }

  const runDemoSeed = async () => {
    try {
      const data = await fetchJson(`${API_BASE}/demo/seed`, {
        method: 'POST',
        headers: jsonHeaders,
      })
      const bedroom = data.projects?.find((project) => project.room_type === 'bedroom')
      await loadProjects()
      if (bedroom) {
        setSelectedProjectId(`${bedroom.id}`)
      }
    } catch (err) {
      handleError(err)
    }
  }

  const handleProjectSelect = (projectId) => {
    setSelectedProjectId(projectId)
  }

  const handleStarterPrompt = (prompt) => {
    setChatInput(prompt)
    sendMessage(prompt)
  }

  const formatTimestamp = (value) => {
    if (!value) {
      return ''
    }
    const date = new Date(value)
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  }

  const renderContextSummary = (context) => {
    if (!context) {
      return null
    }
    const preferences = context.preferences || []
    const reference = context.reference_project
    const referenceSummary = context.reference_summary || {}
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
        </div>
        <div className="context-stats">
          <span>Ref images: {recentImages.length}</span>
          <span>Ref events: {recentEvents.length}</span>
          <span>Target events: {targetEvents.length}</span>
        </div>
      </div>
    )
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="sidebar-header">
          <div>
            <p className="eyebrow">Design Memory</p>
            <h2>Projects</h2>
          </div>
          <button className="ghost" onClick={handleLogout} type="button">
            Logout
          </button>
        </div>
        <button className="primary" onClick={() => setShowProjectModal(true)} type="button">
          + New Project
        </button>
        <button className="ghost" onClick={loadProjects} type="button">
          Refresh
        </button>
        <button className="ghost" onClick={runDemoSeed} type="button">
          Demo Setup
        </button>
        <div className="project-list">
          {projects.map((project) => (
            <button
              key={project.id}
              className={`project-item ${selectedProjectId == project.id ? 'active' : ''}`}
              type="button"
              onClick={() => handleProjectSelect(`${project.id}`)}
            >
              <div className="project-row">
                <div>
                  <p className="project-title">{project.title}</p>
                  <p className="project-preview">
                    {projectPreviews[project.id]?.content || 'No messages yet'}
                  </p>
                </div>
                <div className="project-meta">
                  <span className="badge">{project.room_type}</span>
                  <span className="timestamp">
                    {formatTimestamp(projectPreviews[project.id]?.created_at)}
                  </span>
                </div>
              </div>
            </button>
          ))}
          {!projects.length && <p className="muted">No projects yet.</p>}
        </div>
      </aside>

      <main className="chat-panel">
        <header className="chat-header">
          <div>
            <h1>{selectedProject ? selectedProject.title : 'Select a project'}</h1>
            <p className="muted">
              {selectedProject ? selectedProject.room_type : 'Choose from the sidebar'}
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

        {actionError && <div className="toast">{actionError}</div>}

        <div className="chat-history">
          {!selectedProjectId && (
            <div className="chat-empty">
              <p className="muted">Pick a project or create a new one to start chatting.</p>
            </div>
          )}
          {selectedProjectId && !messages.length && (
            <div className="chat-empty">
              <p className="muted">Tell me what vibe you want.</p>
              <div className="starter-prompts">
                {starterPrompts.map((prompt) => (
                  <button
                    key={prompt}
                    type="button"
                    className="ghost"
                    onClick={() => handleStarterPrompt(prompt)}
                  >
                    {prompt}
                  </button>
                ))}
              </div>
            </div>
          )}
          {messages.map((message) => {
            const metadata = message.metadata_json || {}
            const options = metadata.design_options || []
            const context = metadata.context
            return (
              <div key={message.id} className={`chat-bubble ${message.role}`}>
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
                            onClick={() => selectDesignOption(index + 1)}
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
                    {renderContextSummary(context)}
                  </details>
                )}
              </div>
            )
          })}
          <div ref={chatEndRef} />
        </div>

        <div className="chat-input">
          <textarea
            value={chatInput}
            onChange={(event) => setChatInput(event.target.value)}
            onKeyDown={handleInputKeyDown}
            placeholder="Describe the next design change..."
            rows={2}
            className="chat-textarea"
          />
          <button onClick={sendMessage} type="button" disabled={!selectedProjectId}>
            Send
          </button>
        </div>
      </main>

      {showProjectModal && (
        <div className="modal-overlay" role="presentation">
          <div className="modal">
            <div className="panel-header">
              <h2>Create Project</h2>
              <button
                className="ghost"
                onClick={() => setShowProjectModal(false)}
                type="button"
              >
                Close
              </button>
            </div>
            <div className="field">
              <label htmlFor="projectTitle">Project title</label>
              <input
                id="projectTitle"
                value={projectForm.title}
                onChange={(event) =>
                  setProjectForm((prev) => ({ ...prev, title: event.target.value }))
                }
                placeholder="Cozy bedroom refresh"
              />
            </div>
            <div className="field">
              <label htmlFor="projectRoom">Room type</label>
              <select
                id="projectRoom"
                value={projectForm.room_type}
                onChange={(event) =>
                  setProjectForm((prev) => ({ ...prev, room_type: event.target.value }))
                }
              >
                {ROOM_OPTIONS.map((room) => (
                  <option key={room.value} value={room.value}>
                    {room.label}
                  </option>
                ))}
              </select>
            </div>
            <button className="primary" onClick={createProject} type="button">
              Create project
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
