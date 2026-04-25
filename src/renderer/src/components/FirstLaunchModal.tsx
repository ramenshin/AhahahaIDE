import { useEffect, useRef, useState } from 'react'

interface Props {
  // 마법사 완료 시 메인이 호출. App이 setConfig + 메인 UI 로드.
  onComplete: (chosenRootPath: string) => void
  // 사용자가 취소하면 앱 종료.
  onCancel: () => void
}

export function FirstLaunchModal({ onComplete, onCancel }: Props) {
  const [path, setPath] = useState('')
  const [loadingDefault, setLoadingDefault] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [confirmingMkdir, setConfirmingMkdir] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    let cancelled = false
    window.api
      .defaultRootSuggestion()
      .then((suggestion) => {
        if (cancelled) return
        setPath(suggestion)
        setLoadingDefault(false)
        // 기본값 로드 후 입력창 끝으로 커서
        inputRef.current?.focus()
      })
      .catch((err) => {
        if (cancelled) return
        setError(`기본 경로 조회 실패: ${String(err)}`)
        setLoadingDefault(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const handleBrowse = async () => {
    try {
      const picked = await window.api.pickFolder(path || undefined)
      if (picked) {
        setPath(picked)
        setError(null)
      }
    } catch (err) {
      setError(String(err))
    }
  }

  const trySubmit = async () => {
    if (submitting) return
    const trimmed = path.trim()
    if (!trimmed) {
      setError('경로를 입력하세요.')
      return
    }
    setError(null)
    setSubmitting(true)
    try {
      const exists = await window.api.fs.dirExists(trimmed)
      if (exists) {
        // 폴더 존재 → 바로 완료
        onComplete(trimmed)
        return
      }
      // 폴더 미존재 → 사용자 명시 확인 단계로
      setConfirmingMkdir(true)
    } catch (err) {
      setError(String(err))
    } finally {
      setSubmitting(false)
    }
  }

  const handleConfirmMkdir = async () => {
    if (submitting) return
    setSubmitting(true)
    try {
      await window.api.fs.mkdir(path.trim())
      onComplete(path.trim())
    } catch (err) {
      setError(`폴더 생성 실패: ${err instanceof Error ? err.message : String(err)}`)
      setConfirmingMkdir(false)
    } finally {
      setSubmitting(false)
    }
  }

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault()
      onCancel()
    } else if (e.key === 'Enter' && !confirmingMkdir) {
      e.preventDefault()
      trySubmit()
    }
  }

  return (
    <div className="modal-backdrop">
      <div className="modal modal-compact" onKeyDown={handleKey}>
        <div className="modal-header">
          <span className="title">🎉 AhahahaIDE에 오신 것을 환영합니다</span>
        </div>
        <div className="modal-body">
          {!confirmingMkdir ? (
            <>
              <p className="settings-hint">
                AhahahaIDE는 한 폴더 아래의 프로젝트들을 관리합니다.
                프로젝트들이 있는(또는 새로 만들) 폴더를 선택해주세요.
              </p>
              <div className="path-row" style={{ marginTop: 12 }}>
                <input
                  ref={inputRef}
                  type="text"
                  className="new-project-input"
                  value={path}
                  onChange={(e) => {
                    setPath(e.target.value)
                    if (error) setError(null)
                  }}
                  spellCheck={false}
                  autoComplete="off"
                  disabled={loadingDefault || submitting}
                  placeholder={loadingDefault ? '기본 경로 불러오는 중…' : ''}
                />
                <button
                  className="btn-secondary"
                  type="button"
                  onClick={handleBrowse}
                  disabled={loadingDefault || submitting}
                  style={{ marginLeft: 8 }}
                >
                  📁 찾아보기…
                </button>
              </div>
              {error && <div className="new-project-error">⚠ {error}</div>}
              <p className="settings-hint" style={{ marginTop: 12 }}>
                예: <code>C:\Users\YourName\Projects</code>
                <br />
                폴더가 없으면 다음 단계에서 생성 여부를 확인합니다.
              </p>
            </>
          ) : (
            <>
              <p className="settings-hint">
                다음 폴더가 존재하지 않습니다:
              </p>
              <div className="path-row" style={{ marginTop: 8 }}>
                <code className="path-display" title={path}>
                  {path}
                </code>
              </div>
              <p className="settings-hint" style={{ marginTop: 12 }}>
                새로 만들까요? (취소하면 경로 입력 단계로 돌아갑니다.)
              </p>
              {error && <div className="new-project-error">⚠ {error}</div>}
            </>
          )}
        </div>
        <div className="modal-footer">
          {!confirmingMkdir ? (
            <>
              <button
                className="btn-secondary"
                type="button"
                onClick={onCancel}
                disabled={submitting}
              >
                취소 (앱 종료)
              </button>
              <button
                className="btn-primary"
                type="button"
                onClick={trySubmit}
                disabled={loadingDefault || submitting || !path.trim()}
              >
                {submitting ? '확인 중…' : '시작하기'}
              </button>
            </>
          ) : (
            <>
              <button
                className="btn-secondary"
                type="button"
                onClick={() => {
                  setConfirmingMkdir(false)
                  setError(null)
                }}
                disabled={submitting}
              >
                돌아가기
              </button>
              <button
                className="btn-primary"
                type="button"
                onClick={handleConfirmMkdir}
                disabled={submitting}
              >
                {submitting ? '생성 중…' : '폴더 생성 후 시작'}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
