import { useEffect, useMemo, useState } from 'react'
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

  const loadMessages = async (projectId) => {
    if (!projectId) {
      return
    }
    try {
      const data = await fetchJson(`${API_BASE}/feedback/?project_id=${projectId}`)
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
    try {
      const payload = {
        user: Number(currentUser.id),
        project: Number(selectedProjectId),
        design_version: null,
        event_type: 'modify',
        payload_json: { text: chatInput },
      }
      await fetchJson(`${API_BASE}/feedback/`, {
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
          {messages.length ? (
            messages
              .slice()
              .reverse()
              .map((message) => (
                <div key={message.id} className="chat-bubble">
                  <p className="chat-meta">
                    {message.event_type} · {new Date(message.created_at).toLocaleString()}
                  </p>
                  <p>{message.payload_json?.text || JSON.stringify(message.payload_json)}</p>
                </div>
              ))
          ) : (
            <div className="chat-empty">
              <p className="muted">No messages yet. Start a conversation.</p>
            </div>
          )}
        </div>

        <div className="chat-input">
          <input
            value={chatInput}
            onChange={(event) => setChatInput(event.target.value)}
            placeholder="Describe the next design change..."
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
