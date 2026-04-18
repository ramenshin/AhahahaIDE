interface OpenProject {
  path: string
  name: string
  status: 'running' | 'hibernate' | 'error'
  unreadCount?: number
}

interface Props {
  openProjects: OpenProject[]
  activePath: string | null
  onActivate?: (path: string) => void
  onClose?: (path: string) => void
}

export function ProjectTabBar({
  openProjects,
  activePath,
  onActivate,
  onClose
}: Props) {
  return (
    <div className="project-tabs">
      {openProjects.length === 0 && (
        <div className="tabs-empty">열린 프로젝트 없음 — 좌측에서 폴더를 선택하세요</div>
      )}
      {openProjects.map((p) => (
        <div
          key={p.path}
          className={`project-tab${p.path === activePath ? ' active' : ''}`}
          onClick={() => onActivate?.(p.path)}
          title={p.path}
        >
          <span className={`dot ${p.status}`} />
          <span className="name">{p.name}</span>
          <span
            className="close"
            onClick={(e) => {
              e.stopPropagation()
              onClose?.(p.path)
            }}
          >
            ×
          </span>
        </div>
      ))}
    </div>
  )
}
