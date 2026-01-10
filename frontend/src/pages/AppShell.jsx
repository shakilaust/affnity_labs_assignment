import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
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
  const [health, setHealth] = useState({ status: 'loading', error: '' })
  const [currentUser, setCurrentUser] = useState(null)
  const [projectForm, setProjectForm] = useState(initialProjectForm)
  const [projects, setProjects] = useState([])
  const [selectedProjectId, setSelectedProjectId] = useState('')
  const [messages, setMessages] = useState([])
  const [chatInput, setChatInput] = useState('')
  const [actionError, setActionError] = useState('')
  const [showProjectModal, setShowProjectModal] = useState(false)
  const chatEndRef = useRef(null)

  const selectedProject = useMemo(
    () => projects.find((project) => `${project.id}` === `${selectedProjectId}`),
    [projects, selectedProjectId]
  )

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

  useEffect(() => {
    if (selectedProjectId) {
      loadMessages(selectedProjectId)
    }
  }, [selectedProjectId])

  useEffect(() => {
    if (chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [messages])

  const loadMessages = async (projectId) => {
    if (!projectId) {
      return
    }
    try {
      const data = await fetchJson(`${API_BASE}/projects/${projectId}/messages/`)
      setMessages(data)
    } catch (err) {
      handleError(err)
    }
  }

  const sendMessage = async () => {
    if (!selectedProjectId) {
      handleError(new Error('Select a project first'))
      return
    }
    if (!chatInput.trim()) {
      return
    }
    try {
      const payload = {
        project_id: Number(selectedProjectId),
        message: chatInput,
      }
      const data = await fetchJson(`${API_BASE}/agent/chat`, {
        method: 'POST',
        headers: jsonHeaders,
        body: JSON.stringify(payload),
      })
      setChatInput('')
      await loadMessages(selectedProjectId)
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
          New Project
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
              onClick={() => setSelectedProjectId(`${project.id}`)}
            >
              <strong>{project.title}</strong>
              <span>{project.room_type}</span>
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
                    <pre>{JSON.stringify(context, null, 2)}</pre>
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
