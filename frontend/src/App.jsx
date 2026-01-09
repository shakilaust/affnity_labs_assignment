import { useEffect, useMemo, useState } from 'react'
import './App.css'

const API_BASE = 'http://localhost:8000/api'
const ROOM_OPTIONS = [
  { value: 'living_room', label: 'Living Room' },
  { value: 'bedroom', label: 'Bedroom' },
  { value: 'kitchen', label: 'Kitchen' },
  { value: 'bathroom', label: 'Bathroom' },
  { value: 'office', label: 'Office' },
  { value: 'other', label: 'Other' },
]

const initialUserForm = { username: '', display_name: '', email: '' }
const initialProjectForm = { title: '', room_type: 'living_room' }
const initialVersionForm = { parent_version: '', notes: '' }

const jsonHeaders = { 'Content-Type': 'application/json' }

async function fetchJson(url, options = {}) {
  const response = await fetch(url, options)
  if (!response.ok) {
    const text = await response.text()
    throw new Error(text || `Request failed: ${response.status}`)
  }
  return response.json()
}

function App() {
  const [health, setHealth] = useState({ status: 'loading', error: '' })
  const [userForm, setUserForm] = useState(initialUserForm)
  const [userId, setUserId] = useState('')
  const [users, setUsers] = useState([])
  const [projectForm, setProjectForm] = useState(initialProjectForm)
  const [projects, setProjects] = useState([])
  const [selectedProjectId, setSelectedProjectId] = useState('')
  const [versions, setVersions] = useState([])
  const [versionForm, setVersionForm] = useState(initialVersionForm)
  const [selectedVersionId, setSelectedVersionId] = useState('')
  const [images, setImages] = useState([])
  const [feedbackForm, setFeedbackForm] = useState({
    event_type: 'modify',
    text: '',
    selected_option_index: 1,
  })
  const [contextMessage, setContextMessage] = useState('')
  const [contextResult, setContextResult] = useState(null)
  const [assistantMessage, setAssistantMessage] = useState('')
  const [assistantResult, setAssistantResult] = useState(null)
  const [assistantStatus, setAssistantStatus] = useState('')
  const [actionError, setActionError] = useState('')
  const [demoProjects, setDemoProjects] = useState([])
  const [demoLog, setDemoLog] = useState([])

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
    const savedUserId = window.localStorage.getItem('demo_user_id')
    if (savedUserId) {
      setUserId(savedUserId)
    }
    return () => {
      isMounted = false
    }
  }, [])

  const handleError = (err) => {
    setActionError(err.message || 'Something went wrong')
    setTimeout(() => setActionError(''), 4000)
  }

  const pushLog = (label, payload) => {
    const id = `${Date.now()}-${Math.random().toString(16).slice(2)}`
    setDemoLog((prev) => [
      {
        id,
        label,
        payload,
      },
      ...prev,
    ])
  }

  const loadUsers = async () => {
    try {
      const data = await fetchJson(`${API_BASE}/users/`)
      setUsers(data)
    } catch (err) {
      handleError(err)
    }
  }

  const createUser = async () => {
    try {
      const payload = JSON.stringify(userForm)
      const data = await fetchJson(`${API_BASE}/users/`, {
        method: 'POST',
        headers: jsonHeaders,
        body: payload,
      })
      setUsers((prev) => [data, ...prev])
      setUserId(`${data.user}`)
      setUserForm(initialUserForm)
    } catch (err) {
      handleError(err)
    }
  }

  const createDemoUser = async () => {
    try {
      const data = await fetchJson(`${API_BASE}/demo/create-user`, {
        method: 'POST',
        headers: jsonHeaders,
      })
      setUserId(`${data.user_id}`)
      window.localStorage.setItem('demo_user_id', `${data.user_id}`)
      pushLog('Create demo user', data)
    } catch (err) {
      handleError(err)
    }
  }

  const seedDemoProjects = async () => {
    if (!userId) {
      handleError(new Error('Set a user id first'))
      return
    }
    try {
      const data = await fetchJson(`${API_BASE}/demo/seed-projects`, {
        method: 'POST',
        headers: jsonHeaders,
        body: JSON.stringify({ user_id: Number(userId) }),
      })
      setDemoProjects(data.projects || [])
      pushLog('Seed demo projects', data)
    } catch (err) {
      handleError(err)
    }
  }

  const seedDemoStory = async () => {
    if (!userId) {
      handleError(new Error('Set a user id first'))
      return
    }
    try {
      const data = await fetchJson(`${API_BASE}/demo/seed-story`, {
        method: 'POST',
        headers: jsonHeaders,
        body: JSON.stringify({ user_id: Number(userId) }),
      })
      pushLog('Seed full story', data)
    } catch (err) {
      handleError(err)
    }
  }

  const resetDemo = async () => {
    try {
      const data = await fetchJson(`${API_BASE}/demo/reset`, {
        method: 'POST',
        headers: jsonHeaders,
      })
      setDemoProjects([])
      pushLog('Reset demo', data)
    } catch (err) {
      handleError(err)
    }
  }

  const loadProjects = async () => {
    if (!userId) {
      handleError(new Error('Set a user id first'))
      return
    }
    try {
      const data = await fetchJson(`${API_BASE}/projects/?user_id=${userId}`)
      setProjects(data)
      if (data.length && !selectedProjectId) {
        setSelectedProjectId(`${data[0].id}`)
      }
    } catch (err) {
      handleError(err)
    }
  }

  const createProject = async () => {
    if (!userId) {
      handleError(new Error('Set a user id first'))
      return
    }
    try {
      const payload = JSON.stringify({ ...projectForm, user: Number(userId) })
      const data = await fetchJson(`${API_BASE}/projects/`, {
        method: 'POST',
        headers: jsonHeaders,
        body: payload,
      })
      setProjects((prev) => [data, ...prev])
      setProjectForm(initialProjectForm)
      setSelectedProjectId(`${data.id}`)
    } catch (err) {
      handleError(err)
    }
  }

  const loadVersions = async (projectId) => {
    if (!projectId) {
      return
    }
    try {
      const data = await fetchJson(`${API_BASE}/projects/${projectId}/versions/`)
      setVersions(data)
      if (data.length) {
        setSelectedVersionId(`${data[0].id}`)
      }
    } catch (err) {
      handleError(err)
    }
  }

  useEffect(() => {
    if (selectedProjectId) {
      loadVersions(selectedProjectId)
    }
  }, [selectedProjectId])

  const createVersion = async () => {
    if (!selectedProjectId) {
      handleError(new Error('Select a project first'))
      return
    }
    try {
      const payload = {
        notes: versionForm.notes,
      }
      if (versionForm.parent_version) {
        payload.parent_version = Number(versionForm.parent_version)
      }
      const data = await fetchJson(`${API_BASE}/projects/${selectedProjectId}/versions/`, {
        method: 'POST',
        headers: jsonHeaders,
        body: JSON.stringify(payload),
      })
      setVersions((prev) => [data, ...prev])
      setSelectedVersionId(`${data.id}`)
      setVersionForm(initialVersionForm)
    } catch (err) {
      handleError(err)
    }
  }

  const loadImages = async () => {
    if (!selectedVersionId) {
      handleError(new Error('Select a version first'))
      return
    }
    try {
      const data = await fetchJson(`${API_BASE}/versions/${selectedVersionId}/images/`)
      setImages(data)
    } catch (err) {
      handleError(err)
    }
  }

  const submitFeedback = async () => {
    if (!selectedProjectId || !userId) {
      handleError(new Error('Select a project and user first'))
      return
    }
    const payload = {
      user: Number(userId),
      project: Number(selectedProjectId),
      design_version: selectedVersionId ? Number(selectedVersionId) : null,
      event_type: feedbackForm.event_type,
      payload_json: {},
    }
    if (feedbackForm.event_type === 'select') {
      payload.payload_json.selected_option_index = Number(
        feedbackForm.selected_option_index
      )
    } else if (feedbackForm.text) {
      payload.payload_json.text = feedbackForm.text
    }
    try {
      await fetchJson(`${API_BASE}/feedback/`, {
        method: 'POST',
        headers: jsonHeaders,
        body: JSON.stringify(payload),
      })
      setFeedbackForm((prev) => ({ ...prev, text: '' }))
    } catch (err) {
      handleError(err)
    }
  }

  const resolveContext = async () => {
    if (!userId) {
      handleError(new Error('Set a user id first'))
      return
    }
    try {
      const data = await fetchJson(`${API_BASE}/context/resolve`, {
        method: 'POST',
        headers: jsonHeaders,
        body: JSON.stringify({ user_id: Number(userId), message: contextMessage }),
      })
      setContextResult(data)
    } catch (err) {
      handleError(err)
    }
  }

  const runAssistant = async () => {
    if (!userId || !selectedProjectId) {
      handleError(new Error('Select a user and project first'))
      return
    }
    setAssistantStatus('Generating...')
    try {
      const data = await fetchJson(`${API_BASE}/assistant/suggest`, {
        method: 'POST',
        headers: jsonHeaders,
        body: JSON.stringify({
          user_id: Number(userId),
          project_id: Number(selectedProjectId),
          message: assistantMessage,
        }),
      })
      setAssistantResult(data)
      setAssistantStatus('Done')
    } catch (err) {
      handleError(err)
      setAssistantStatus('')
    }
  }

  const storeAssistantVersion = async () => {
    if (!assistantResult || !assistantResult.suggestions?.length) {
      handleError(new Error('Run the assistant first'))
      return
    }
    const notes =
      assistantResult.suggestions[0].notes || assistantResult.suggestions[0].title
    try {
      const version = await fetchJson(`${API_BASE}/projects/${selectedProjectId}/versions/`, {
        method: 'POST',
        headers: jsonHeaders,
        body: JSON.stringify({ notes }),
      })
      const prompts = assistantResult.image_prompts || []
      await Promise.all(
        prompts.map((prompt, index) =>
          fetchJson(`${API_BASE}/versions/${version.id}/images/`, {
            method: 'POST',
            headers: jsonHeaders,
            body: JSON.stringify({
              prompt,
              params_json: { source: 'llm' },
              image_url: `https://example.com/generated-${version.id}-${index + 1}.jpg`,
            }),
          })
        )
      )
      setAssistantStatus('Stored new version')
      await loadVersions(selectedProjectId)
    } catch (err) {
      handleError(err)
    }
  }

  return (
    <div className="page">
      <header className="hero">
        <div>
          <p className="eyebrow">Interior Design Agent Memory System</p>
          <h1>Make memory, retrieval, and versioning visible.</h1>
          <p className="hero-subtitle">
            Manage room projects, track design versions, and test context-aware
            suggestions from the assistant.
          </p>
        </div>
        <div className="health-card">
          <p className="label">Backend status</p>
          {health.status === 'loading' && <span>Checking...</span>}
          {health.status === 'error' && <span className="error">Error: {health.error}</span>}
          {health.status !== 'loading' && health.status !== 'error' && (
            <span className="ok">Status: {health.status}</span>
          )}
        </div>
      </header>

      {actionError && <div className="toast">{actionError}</div>}

      <section className="panel">
        <div className="panel-header">
          <h2>Demo setup</h2>
          <span className="muted">Active user id: {userId || 'Not set'}</span>
        </div>
        <div className="field-row">
          <button onClick={createDemoUser} type="button">
            Create Demo User
          </button>
          <button className="ghost" onClick={seedDemoProjects} type="button">
            Seed Demo Projects
          </button>
          <button className="ghost" onClick={seedDemoStory} type="button">
            Seed Full Story
          </button>
          <button className="ghost" onClick={resetDemo} type="button">
            Reset Demo Data
          </button>
        </div>
        <div className="grid-two">
          <div className="card">
            <h3>Seeded projects</h3>
            <div className="list">
              {demoProjects.map((project) => (
                <button
                  key={project.id}
                  className="list-item"
                  type="button"
                  onClick={() => setSelectedProjectId(`${project.id}`)}
                >
                  <strong>{project.title}</strong>
                  <span>{project.room_type} · ID {project.id}</span>
                </button>
              ))}
              {!demoProjects.length && <p className="muted">No demo projects yet.</p>}
            </div>
          </div>
          <div className="card">
            <h3>Demo log</h3>
            <div className="log">
              {demoLog.map((entry) => (
                <div key={entry.id} className="log-entry">
                  <strong>{entry.label}</strong>
                  <pre>{JSON.stringify(entry.payload, null, 2)}</pre>
                </div>
              ))}
              {!demoLog.length && <p className="muted">No demo actions yet.</p>}
            </div>
          </div>
        </div>
      </section>

      <section className="panel">
        <div className="panel-header">
          <h2>Users</h2>
          <button className="ghost" onClick={loadUsers} type="button">
            Refresh
          </button>
        </div>
        <div className="grid-two">
          <div>
            <div className="field">
              <label htmlFor="username">Username</label>
              <input
                id="username"
                value={userForm.username}
                onChange={(event) =>
                  setUserForm((prev) => ({ ...prev, username: event.target.value }))
                }
                placeholder="sunny"
              />
            </div>
            <div className="field">
              <label htmlFor="displayName">Display name</label>
              <input
                id="displayName"
                value={userForm.display_name}
                onChange={(event) =>
                  setUserForm((prev) => ({ ...prev, display_name: event.target.value }))
                }
                placeholder="Sunny Patel"
              />
            </div>
            <div className="field">
              <label htmlFor="email">Email</label>
              <input
                id="email"
                type="email"
                value={userForm.email}
                onChange={(event) =>
                  setUserForm((prev) => ({ ...prev, email: event.target.value }))
                }
                placeholder="sunny@email.com"
              />
            </div>
            <button onClick={createUser} type="button">
              Create user
            </button>
          </div>
          <div>
            <div className="field">
              <label htmlFor="userId">Active user id</label>
              <input
                id="userId"
                value={userId}
                onChange={(event) => setUserId(event.target.value)}
                placeholder="User id"
              />
            </div>
            <div className="list">
              {users.map((user) => (
                <button
                  key={user.id}
                  className="list-item"
                  type="button"
                  onClick={() => setUserId(`${user.user}`)}
                >
                  <strong>{user.display_name || user.username}</strong>
                  <span>ID: {user.user}</span>
                </button>
              ))}
              {!users.length && <p className="muted">No users loaded yet.</p>}
            </div>
          </div>
        </div>
      </section>

      <section className="panel">
        <div className="panel-header">
          <h2>Projects</h2>
          <button className="ghost" onClick={loadProjects} type="button">
            Load projects
          </button>
        </div>
        <div className="grid-two">
          <div>
            <div className="field">
              <label htmlFor="projectTitle">Project title</label>
              <input
                id="projectTitle"
                value={projectForm.title}
                onChange={(event) =>
                  setProjectForm((prev) => ({ ...prev, title: event.target.value }))
                }
                placeholder="Warm loft living room"
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
            <button onClick={createProject} type="button">
              Create project
            </button>
          </div>
          <div className="list">
            {projects.map((project) => (
              <button
                key={project.id}
                className={`list-item ${selectedProjectId == project.id ? 'active' : ''}`}
                type="button"
                onClick={() => setSelectedProjectId(`${project.id}`)}
              >
                <strong>{project.title}</strong>
                <span>{project.room_type}</span>
              </button>
            ))}
            {!projects.length && <p className="muted">No projects yet.</p>}
          </div>
        </div>
      </section>

      <section className="panel">
        <div className="panel-header">
          <h2>Project detail</h2>
          <span className="muted">
            {selectedProject ? selectedProject.title : 'Select a project'}
          </span>
        </div>
        <div className="grid-two">
          <div>
            <div className="field">
              <label htmlFor="parentVersion">Parent version (optional)</label>
              <select
                id="parentVersion"
                value={versionForm.parent_version}
                onChange={(event) =>
                  setVersionForm((prev) => ({ ...prev, parent_version: event.target.value }))
                }
              >
                <option value="">None</option>
                {versions.map((version) => (
                  <option key={version.id} value={version.id}>
                    v{version.version_number} - {version.notes || 'Untitled'}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor="versionNotes">Version notes</label>
              <textarea
                id="versionNotes"
                value={versionForm.notes}
                onChange={(event) =>
                  setVersionForm((prev) => ({ ...prev, notes: event.target.value }))
                }
                placeholder="Describe the design changes..."
              />
            </div>
            <button onClick={createVersion} type="button">
              Create new version
            </button>
          </div>
          <div>
            <div className="list">
              {versions.map((version) => (
                <button
                  key={version.id}
                  className={`list-item ${selectedVersionId == version.id ? 'active' : ''}`}
                  type="button"
                  onClick={() => setSelectedVersionId(`${version.id}`)}
                >
                  <strong>v{version.version_number}</strong>
                  <span>{version.notes || 'No notes'}</span>
                </button>
              ))}
              {!versions.length && <p className="muted">No versions yet.</p>}
            </div>
          </div>
        </div>
        <div className="split">
          <button className="ghost" type="button" onClick={loadImages}>
            Load images for selected version
          </button>
          <div className="image-grid">
            {images.map((image) => (
              <div key={image.id} className="image-card">
                <div className="image-placeholder">Image</div>
                <p>{image.prompt}</p>
              </div>
            ))}
            {!images.length && <p className="muted">No images loaded.</p>}
          </div>
        </div>
        <div className="feedback">
          <h3>Feedback</h3>
          <div className="field-row">
            <select
              value={feedbackForm.event_type}
              onChange={(event) =>
                setFeedbackForm((prev) => ({ ...prev, event_type: event.target.value }))
              }
            >
              <option value="modify">Modify</option>
              <option value="select">Select</option>
              <option value="reject">Reject</option>
              <option value="save">Save</option>
            </select>
            {feedbackForm.event_type === 'select' ? (
              <input
                type="number"
                min="1"
                max="10"
                value={feedbackForm.selected_option_index}
                onChange={(event) =>
                  setFeedbackForm((prev) => ({
                    ...prev,
                    selected_option_index: event.target.value,
                  }))
                }
                placeholder="Option index"
              />
            ) : (
              <input
                value={feedbackForm.text}
                onChange={(event) =>
                  setFeedbackForm((prev) => ({ ...prev, text: event.target.value }))
                }
                placeholder="Feedback text"
              />
            )}
            <button onClick={submitFeedback} type="button">
              Send feedback
            </button>
          </div>
        </div>
      </section>

      <section className="panel">
        <div className="panel-header">
          <h2>Context resolver</h2>
        </div>
        <div className="field-row">
          <input
            value={contextMessage}
            onChange={(event) => setContextMessage(event.target.value)}
            placeholder="living room same vibe as bedroom"
          />
          <button onClick={resolveContext} type="button">
            Resolve
          </button>
        </div>
        <div className="json-card">
          <pre>{contextResult ? JSON.stringify(contextResult, null, 2) : 'No context yet.'}</pre>
        </div>
      </section>

      <section className="panel">
        <div className="panel-header">
          <h2>LLM assistant</h2>
          <span className="muted">{assistantStatus}</span>
        </div>
        <div className="field-row">
          <input
            value={assistantMessage}
            onChange={(event) => setAssistantMessage(event.target.value)}
            placeholder="Create a warmer, plant-friendly update"
          />
          <button onClick={runAssistant} type="button">
            Generate
          </button>
          <button className="ghost" onClick={storeAssistantVersion} type="button">
            Store as new version
          </button>
        </div>
        {assistantResult ? (
          <div className="grid-two">
            <div className="card">
              <h3>Suggestions</h3>
              <div className="list">
                {assistantResult.suggestions.map((suggestion, index) => (
                  <div key={index} className="list-item">
                    <strong>{suggestion.title}</strong>
                    <span>{suggestion.notes}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="card">
              <h3>Image prompts</h3>
              <ul className="prompt-list">
                {assistantResult.image_prompts.map((prompt, index) => (
                  <li key={index}>{prompt}</li>
                ))}
              </ul>
            </div>
          </div>
        ) : (
          <p className="muted">No suggestions yet.</p>
        )}
      </section>
    </div>
  )
}

export default App
