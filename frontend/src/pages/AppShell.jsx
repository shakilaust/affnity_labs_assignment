import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { API_BASE, clearAuthToken, fetchJson, jsonHeaders } from '../api'
import '../App.css'
import ChatPanel from '../components/ChatPanel'
import Sidebar from '../components/Sidebar'

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
  const [isLoadingMessages, setIsLoadingMessages] = useState(false)
  const [isSending, setIsSending] = useState(false)
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
      await loadPreviews()
    } catch (err) {
      handleError(err)
    }
  }

  const loadPreviews = async () => {
    try {
      const data = await fetchJson(`${API_BASE}/projects/previews/`)
      setProjectPreviews(data || {})
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
      setIsLoadingMessages(true)
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
    } finally {
      setIsLoadingMessages(false)
    }
  }

  const appendMessage = (message) => {
    setMessages((prev) => [...prev, message])
  }

  const updateMessageById = (id, updater) => {
    setMessages((prev) =>
      prev.map((message) => (message.id === id ? updater(message) : message))
    )
  }

  const revealAssistantText = (id, fullText) => {
    const words = fullText.split(' ')
    let index = 0
    const interval = setInterval(() => {
      index += 1
      updateMessageById(id, (message) => ({
        ...message,
        content: words.slice(0, index).join(' '),
      }))
      if (index >= words.length) {
        clearInterval(interval)
      }
    }, Math.max(25, 800 / Math.max(words.length, 1)))
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
    if (isSending) {
      return
    }
    const tempUserId = `temp-user-${Date.now()}`
    const tempAssistantId = `temp-assistant-${Date.now()}`
    appendMessage({
      id: tempUserId,
      role: 'user',
      content: textToSend,
      created_at: new Date().toISOString(),
    })
    appendMessage({
      id: tempAssistantId,
      role: 'assistant',
      content: 'Thinking...',
      created_at: new Date().toISOString(),
      isPending: true,
      retryText: textToSend,
    })
    setChatInput('')
    setIsSending(true)
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
      updateMessageById(tempAssistantId, (message) => ({
        ...message,
        content: data.assistant_message,
        isPending: false,
        metadata_json: {
          design_options: data.design_options || [],
          resolved_context: data.resolved_context || null,
          version_id: data.created_version_id || null,
        },
      }))
      revealAssistantText(tempAssistantId, data.assistant_message)
      setProjectPreviews((prev) => ({
        ...prev,
        [selectedProjectId]: {
          role: 'assistant',
          content: data.assistant_message,
          created_at: new Date().toISOString(),
        },
      }))
    } catch (err) {
      updateMessageById(tempAssistantId, (message) => ({
        ...message,
        content: 'Something went wrong. Please try again.',
        isPending: false,
        isError: true,
      }))
      handleError(err)
    } finally {
      setIsSending(false)
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

  const retryAssistant = async (messageId, text) => {
    if (!text) {
      return
    }
    updateMessageById(messageId, (message) => ({
      ...message,
      content: 'Thinking...',
      isPending: true,
      isError: false,
    }))
    setIsSending(true)
    try {
      const payload = {
        project_id: Number(selectedProjectId),
        message: text,
      }
      const data = await fetchJson(`${API_BASE}/agent/chat`, {
        method: 'POST',
        headers: jsonHeaders,
        body: JSON.stringify(payload),
      })
      updateMessageById(messageId, (message) => ({
        ...message,
        content: data.assistant_message,
        isPending: false,
        metadata_json: {
          design_options: data.design_options || [],
          resolved_context: data.resolved_context || null,
          version_id: data.created_version_id || null,
        },
      }))
      revealAssistantText(messageId, data.assistant_message)
    } catch (err) {
      updateMessageById(messageId, (message) => ({
        ...message,
        content: 'Something went wrong. Please try again.',
        isPending: false,
        isError: true,
      }))
      handleError(err)
    } finally {
      setIsSending(false)
    }
  }

  const saveDesign = async () => {
    if (!selectedProjectId || !currentUser?.id) {
      handleError(new Error('Select a project first'))
      return
    }
    const latestAssistantWithVersion = [...messages]
      .reverse()
      .find((m) => m.role === 'assistant' && m.metadata_json?.version_id)
    const designVersionId = latestAssistantWithVersion?.metadata_json?.version_id || null
    try {
      await fetchJson(`${API_BASE}/feedback/`, {
        method: 'POST',
        headers: jsonHeaders,
        body: JSON.stringify({
          user: Number(currentUser.id),
          project: Number(selectedProjectId),
          design_version: designVersionId,
          event_type: 'save',
          payload_json: { note: 'saved via chat UI' },
        }),
      })
      await fetchJson(`${API_BASE}/projects/${selectedProjectId}/messages/`, {
        method: 'POST',
        headers: jsonHeaders,
        body: JSON.stringify({
          role: 'user',
          content: 'Save this design.',
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
    setChatInput('')
    setIsLoadingMessages(true)
    setMessages([])
    setSelectedProjectId(projectId)
  }

  const handleStarterPrompt = (prompt) => {
    setChatInput(prompt)
    sendMessage(prompt)
  }

  return (
    <div className="app-shell">
      <Sidebar
        projects={projects}
        activeProjectId={selectedProjectId}
        previews={projectPreviews}
        onNewProject={() => setShowProjectModal(true)}
        onRefresh={loadProjects}
        onDemoSeed={runDemoSeed}
        onSelectProject={handleProjectSelect}
        onLogout={handleLogout}
      />

      <ChatPanel
        health={health}
        selectedProject={selectedProject}
        messages={messages}
        starterPrompts={starterPrompts}
        onSelectOption={selectDesignOption}
        onSendMessage={sendMessage}
        onPromptClick={handleStarterPrompt}
        chatInput={chatInput}
        setChatInput={setChatInput}
        chatEndRef={chatEndRef}
        disabled={!selectedProjectId || isSending || isLoadingMessages}
        onRetry={retryAssistant}
        isLoading={isLoadingMessages}
        onSaveDesign={saveDesign}
      />

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
