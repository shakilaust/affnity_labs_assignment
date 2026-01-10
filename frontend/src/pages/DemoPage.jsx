import { useState } from 'react'
import { Link } from 'react-router-dom'
import { API_BASE, fetchJson, jsonHeaders } from '../api'
import '../App.css'

export default function DemoPage() {
  const [projects, setProjects] = useState([])
  const [log, setLog] = useState([])

  const pushLog = (label, payload) => {
    const id = `${Date.now()}-${Math.random().toString(16).slice(2)}`
    setLog((prev) => [{ id, label, payload }, ...prev])
  }

  const seedProjects = async () => {
    const data = await fetchJson(`${API_BASE}/demo/seed-projects`, {
      method: 'POST',
      headers: jsonHeaders,
    })
    setProjects(data.projects || [])
    pushLog('Seed projects', data)
  }

  const seedStory = async () => {
    const data = await fetchJson(`${API_BASE}/demo/seed-story`, {
      method: 'POST',
      headers: jsonHeaders,
    })
    pushLog('Seed full story', data)
  }

  return (
    <div className="page demo-page">
      <header className="panel-header">
        <div>
          <h1>Demo setup</h1>
          <p className="muted">Seed the full story for your account.</p>
        </div>
        <Link className="button ghost" to="/app">
          Back to app
        </Link>
      </header>

      <section className="panel">
        <div className="field-row">
          <button type="button" onClick={seedProjects}>
            Seed Projects
          </button>
          <button className="ghost" type="button" onClick={seedStory}>
            Seed Full Story
          </button>
        </div>
        <div className="grid-two">
          <div className="card">
            <h3>Projects</h3>
            <div className="list">
              {projects.map((project) => (
                <Link key={project.id} className="list-item" to="/app">
                  <strong>{project.title}</strong>
                  <span>
                    {project.room_type} · ID {project.id}
                  </span>
                </Link>
              ))}
              {!projects.length && <p className="muted">No projects seeded yet.</p>}
            </div>
          </div>
          <div className="card">
            <h3>Log</h3>
            <div className="log">
              {log.map((entry) => (
                <div key={entry.id} className="log-entry">
                  <strong>{entry.label}</strong>
                  <pre>{JSON.stringify(entry.payload, null, 2)}</pre>
                </div>
              ))}
              {!log.length && <p className="muted">No actions yet.</p>}
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}
