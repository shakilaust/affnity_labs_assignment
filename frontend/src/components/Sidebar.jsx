import '../App.css'
import ProjectRow from './ProjectRow'

export default function Sidebar({
  projects,
  activeProjectId,
  previews,
  onNewProject,
  onRefresh,
  onDemoSeed,
  onSelectProject,
  onLogout,
}) {
  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <div>
          <p className="eyebrow">Design Memory</p>
          <h2>Projects</h2>
        </div>
        <button className="ghost small" onClick={onLogout} type="button">
          Logout
        </button>
      </div>
      <div className="sidebar-actions">
        <button className="primary small" onClick={onNewProject} type="button">
          + New Project
        </button>
        <button className="ghost small" onClick={onDemoSeed} type="button">
          Demo Setup
        </button>
        <button className="ghost icon" onClick={onRefresh} type="button" aria-label="Refresh">
          ↻
        </button>
      </div>
      <div className="project-list">
        {projects.map((project) => (
          <ProjectRow
            key={project.id}
            project={project}
            isActive={`${project.id}` === `${activeProjectId}`}
            preview={previews[project.id]}
            onSelect={onSelectProject}
          />
        ))}
        {!projects.length && <p className="muted">No projects yet.</p>}
      </div>
    </aside>
  )
}
