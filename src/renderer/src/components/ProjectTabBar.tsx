interface OpenProject {
  path: string
  name: string
  status: 'running' | 'hibernate' | 'error'
  unreadCount?: number
}

interface Props {
  openProjects: OpenProject[]
  activePath: string | null
}

export function ProjectTabBar({ openProjects, activePath }: Props) {
  return (
    <div className="project-tabs">
      {openProjects.length === 0 && (
        <div className="tabs-empty">열린 프로젝트 없음 — 좌측에서 폴더를 선택하세요</div>
      )}
      {openProjects.map((p) => (
        <div
          key={p.path}
          className={`project-tab${p.path === activePath ? ' active' : ''}`}
        >
          <span className={`dot ${p.status}`} />
          <span className="name">{p.name}</span>
          <span className="close">×</span>
        </div>
      ))}
      {openProjects.length > 0 && (
        <div className="tab-add" title="프로젝트 열기">＋</div>
      )}
    </div>
  )
}
