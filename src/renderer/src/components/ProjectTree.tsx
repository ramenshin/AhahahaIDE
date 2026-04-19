import type { ProjectFolder } from '@shared/types'

interface Props {
  folders: ProjectFolder[]
  loading: boolean
  error: string | null
  rootPath: string | null
  selectedPath: string | null
  openedPaths: string[]
  onSelect: (path: string) => void
  onRefresh: () => void
}

export function ProjectTree({
  folders,
  loading,
  error,
  rootPath,
  selectedPath,
  openedPaths,
  onSelect,
  onRefresh
}: Props) {
  const openedSet = new Set(openedPaths)
  return (
    <div className="panel">
      <div className="panel-header">
        <span className="title">프로젝트 ({folders.length})</span>
        <div className="actions">
          <button title="새로고침" type="button" onClick={onRefresh} disabled={loading}>
            ↻
          </button>
        </div>
      </div>
      <div className="panel-body">
        {loading && <div className="placeholder">스캔 중...</div>}
        {error && (
          <div className="placeholder" style={{ color: 'var(--red)' }}>
            폴더 스캔 실패
            <br />
            <small style={{ color: 'var(--text-2)' }}>{error}</small>
          </div>
        )}
        {!loading && !error && (
          <>
            <div className="folder-section-title">
              전체 {rootPath ? `(${rootPath})` : ''}
            </div>
            <div className="folder-list">
              {folders.map((f) => {
                const isActive = f.path === selectedPath
                const isOpened = openedSet.has(f.path)
                const cls = [
                  'folder-item',
                  isOpened && 'opened',
                  isActive && 'active'
                ]
                  .filter(Boolean)
                  .join(' ')
                return (
                  <div
                    key={f.path}
                    className={cls}
                    onClick={() => onSelect(f.path)}
                    title={f.path}
                  >
                    <span
                      className={`icon-status${isOpened ? ' running' : ''}`}
                      title={isOpened ? '세션 실행 중' : undefined}
                    />
                    <span className="name">{f.name}</span>
                    {f.hasVenv && <span className="tag" title="Python venv 감지됨">venv</span>}
                    {f.hasDevIdeToolConfig && <span className="tag" title="프로젝트 설정 파일 있음">cfg</span>}
                  </div>
                )
              })}
              {folders.length === 0 && (
                <div className="placeholder" style={{ fontSize: 11 }}>
                  스캔된 폴더 없음
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
