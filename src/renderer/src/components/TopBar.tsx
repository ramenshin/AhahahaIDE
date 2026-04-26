import { useEffect, useRef, useState } from 'react'

export type SaveStateScope = 'all' | 'active'

interface Props {
  onOpenSettings: () => void
  onSaveState: (scope: SaveStateScope) => void
  onCreateProject: () => void
  onOpenQuikSearch: () => void
  hasOpenProjects: boolean
  hasActiveProject: boolean
}

export function TopBar({
  onOpenSettings,
  onSaveState,
  onCreateProject,
  onOpenQuikSearch,
  hasOpenProjects,
  hasActiveProject
}: Props) {
  const [menuOpen, setMenuOpen] = useState(false)
  const [maximized, setMaximized] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const dispose = window.api.window.onMaximizedChanged(setMaximized)
    return () => dispose()
  }, [])

  useEffect(() => {
    if (!menuOpen) return
    const onDocClick = (e: MouseEvent) => {
      if (!menuRef.current) return
      if (e.target instanceof Node && menuRef.current.contains(e.target)) return
      setMenuOpen(false)
    }
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMenuOpen(false)
    }
    document.addEventListener('mousedown', onDocClick)
    document.addEventListener('keydown', onEsc)
    return () => {
      document.removeEventListener('mousedown', onDocClick)
      document.removeEventListener('keydown', onEsc)
    }
  }, [menuOpen])

  const handlePick = (scope: SaveStateScope) => {
    setMenuOpen(false)
    onSaveState(scope)
  }

  return (
    <div className="top-bar">
      <div className="app-title">⚡ AhahahaIDE</div>
      <button
        className="btn"
        type="button"
        onClick={onCreateProject}
        title="루트 폴더 아래에 새 프로젝트 폴더 생성"
      >
        ＋ 새 프로젝트
      </button>
      <div className="save-state-wrap" ref={menuRef}>
        <button
          className="btn"
          type="button"
          onClick={() => setMenuOpen((v) => !v)}
          disabled={!hasOpenProjects}
          title={hasOpenProjects ? '열린 프로젝트 상태 저장' : '열린 프로젝트가 없습니다'}
        >
          💾 상태저장 ▾
        </button>
        {menuOpen && (
          <div className="save-state-menu" role="menu">
            <button
              type="button"
              className="save-state-menu-item"
              onClick={() => handlePick('all')}
              disabled={!hasOpenProjects}
            >
              <span className="save-state-menu-icon">🔄</span>
              <span>
                <div className="save-state-menu-label">모든 열린 프로젝트의 상태 저장</div>
                <div className="save-state-menu-hint">
                  활성 프로젝트 파일 저장 + 열린 모든 Claude 터미널에 상태 정리 지시
                </div>
              </span>
            </button>
            <button
              type="button"
              className="save-state-menu-item"
              onClick={() => handlePick('active')}
              disabled={!hasActiveProject}
            >
              <span className="save-state-menu-icon">📍</span>
              <span>
                <div className="save-state-menu-label">현재 활성 프로젝트의 상태 저장</div>
                <div className="save-state-menu-hint">
                  활성 프로젝트 파일 저장 + 활성 Claude 터미널에 상태 정리 지시
                </div>
              </span>
            </button>
          </div>
        )}
      </div>
      <button className="btn" type="button" onClick={onOpenSettings}>⚙ 설정</button>
      <div className="spacer" />
      <button
        className="btn"
        type="button"
        onClick={onOpenQuikSearch}
        title="파일명·문서·코드 검색 (Ctrl+P)"
      >
        🔍 QuikSearch <span className="kbd">Ctrl+P</span>
      </button>
      <button
        className="btn"
        type="button"
        disabled
        title="추후 검토"
      >
        명령 팔레트 <span className="kbd">Ctrl+Shift+P</span>
      </button>
      <div className="window-controls">
        <button
          className="window-control"
          type="button"
          aria-label="최소화"
          title="최소화"
          onClick={() => window.api.window.minimize()}
        >
          ─
        </button>
        <button
          className="window-control"
          type="button"
          aria-label={maximized ? '복원' : '최대화'}
          title={maximized ? '복원' : '최대화'}
          onClick={() => window.api.window.toggleMaximize()}
        >
          {maximized ? '❐' : '☐'}
        </button>
        <button
          className="window-control window-control-close"
          type="button"
          aria-label="닫기"
          title="닫기"
          onClick={() => window.api.window.close()}
        >
          ✕
        </button>
      </div>
    </div>
  )
}
