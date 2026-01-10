import '../App.css'

const ROOM_LABELS = {
  bedroom: 'Bedroom',
  living_room: 'Living room',
  office: 'Office',
  other: 'Other',
}

const formatRoomType = (value) => ROOM_LABELS[value] || value

const formatRelativeTime = (value) => {
  if (!value) {
    return ''
  }
  const diffMs = Date.now() - new Date(value).getTime()
  const minutes = Math.floor(diffMs / 60000)
  if (minutes < 1) {
    return 'Just now'
  }
  if (minutes < 60) {
    return `${minutes}m ago`
  }
  const hours = Math.floor(minutes / 60)
  if (hours < 24) {
    return `${hours}h ago`
  }
  const days = Math.floor(hours / 24)
  return days === 1 ? 'Yesterday' : `${days}d ago`
}

export default function ProjectRow({
  project,
  isActive,
  preview,
  onSelect,
}) {
  return (
    <button
      type="button"
      className={`project-item flat ${isActive ? 'active' : ''}`}
      onClick={() => onSelect(`${project.id}`)}
    >
      <div className="project-row">
        <div>
          <p className="project-title">{project.title}</p>
          <p className="project-preview">{preview?.content || 'No messages yet'}</p>
        </div>
        <div className="project-meta">
          <span className="badge">{formatRoomType(project.room_type)}</span>
          <span className="timestamp">{formatRelativeTime(preview?.created_at)}</span>
        </div>
      </div>
    </button>
  )
}
