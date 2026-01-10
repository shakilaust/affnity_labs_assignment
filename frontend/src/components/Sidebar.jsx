import '../App.css'
import ProjectRow from './ProjectRow'

export default function Sidebar({
  projects,
  activeProjectId,
  previews,
  onNewProject,
  onRefresh,
  onSelectProject,
  onLogout,
}) {
  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <div>
          <p className="eyebrow">Design Memory</p>
          <h2>Chats</h2>
        </div>
        <button className="ghost small" onClick={onLogout} type="button">
          Logout
        </button>
      </div>

      <div className="sidebar-section">
        <div className="section-heading">
          <h4>New chat</h4>
        </div>
        <div className="sidebar-actions">
          <button className="primary small" onClick={onNewProject} type="button">
            + New project
          </button>
          <button className="ghost small" onClick={onRefresh} type="button">
            Refresh
          </button>
          <button className="ghost small" onClick={onSelectProject.bind(null, '')} type="button">
            Clear selection
          </button>
        </div>
      </div>

      <div className="sidebar-section">
        <div className="section-heading">
          <h4>Projects</h4>
        </div>
        <div className="project-list flat">
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
      </div>
    </aside>
  )
}
