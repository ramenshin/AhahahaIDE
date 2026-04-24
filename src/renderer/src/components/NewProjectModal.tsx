import { useEffect, useRef, useState } from 'react'

interface Props {
  rootPath: string
  onClose: () => void
  onCreated: (createdPath: string) => void
}

export function NewProjectModal({ rootPath, onClose, onCreated }: Props) {
  const [name, setName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault()
    if (submitting) return
    const trimmed = name.trim()
    if (!trimmed) {
      setError('폴더 이름을 입력하세요.')
      return
    }
    setSubmitting(true)
    setError(null)
    try {
      const created = await window.api.createFolder(trimmed)
      onCreated(created)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <div
        className="modal modal-compact"
        onMouseDown={(e) => e.stopPropagation()}
        onKeyDown={(e) => {
          if (e.key === 'Escape') onClose()
        }}
      >
        <div className="modal-header">
          <span className="title">＋ 새 프로젝트</span>
          <button
            className="icon-btn"
            type="button"
            onClick={onClose}
            title="닫기 (Esc)"
            disabled={submitting}
          >
            ×
          </button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            <p className="settings-hint">
              루트(<code>{rootPath}</code>) 아래에 새 폴더를 만듭니다. 이 모달은
              폴더만 생성하며, 자동으로 프로젝트 세션을 열지 않습니다.
            </p>
            <input
              ref={inputRef}
              type="text"
              value={name}
              onChange={(e) => {
                setName(e.target.value)
                if (error) setError(null)
              }}
              placeholder="예: my-new-project"
              className="new-project-input"
              spellCheck={false}
              autoComplete="off"
              disabled={submitting}
            />
            {error && <div className="new-project-error">⚠ {error}</div>}
          </div>
          <div className="modal-footer">
            <button
              className="btn-secondary"
              type="button"
              onClick={onClose}
              disabled={submitting}
            >
              취소
            </button>
            <button
              className="btn-primary"
              type="submit"
              disabled={submitting || !name.trim()}
            >
              {submitting ? '생성 중…' : '생성'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
