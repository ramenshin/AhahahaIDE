import { useCallback, useEffect, useMemo, useState } from 'react'
import type { AppConfig, ColorScheme, LayoutMode } from '@shared/types'
import { MAX_SESSIONS_LIMIT, ZOOM_MAX, ZOOM_MIN, ZOOM_STEP, clampZoom } from '@shared/types'

interface Props {
  config: AppConfig
  // 부팅 시 결정된 렌더 레이아웃. 저장된 레이아웃과 다르면 "재시작 대기" 뱃지.
  initialLayoutMode: LayoutMode | null
  onClose: () => void
  onSave: (next: AppConfig) => void | Promise<void>
}

const LAYOUT_META: { id: LayoutMode; label: string; hint: string }[] = [
  { id: 'row3', label: '가로 3단 (상/중/하)', hint: '에디터 · Claude · PowerShell 을 위→아래 3단' },
  { id: 'col3', label: '세로 3열 (좌/중/우)', hint: '에디터 · Claude · PowerShell 을 좌→우 3열' },
  { id: 'rowcol', label: '에디터 위 · Claude|PS 아래 2열', hint: '상단=에디터, 하단을 Claude · PowerShell 로 2열 분할' }
]

const SCHEME_META: { id: ColorScheme; label: string; hint: string }[] = [
  { id: 'a', label: 'A', hint: '라벤더 블루' },
  { id: 'b', label: 'B', hint: '모브 퍼플' },
  { id: 'c', label: 'C', hint: '스카이 블루' },
  { id: 'd', label: 'D', hint: '틸 그린 (기본)' },
  { id: 'e', label: 'E', hint: '드라큘라 핑크' },
  { id: 'f', label: 'F', hint: 'One Dark 블루' },
  { id: 'g', label: 'G', hint: 'Solarized' },
  { id: 'h', label: 'H', hint: 'Gruvbox 옐로' }
]

function applySchemePreview(scheme: ColorScheme): void {
  document.body.className = `scheme-${scheme}`
}

function parseExcludeText(text: string): string[] {
  return Array.from(
    new Set(
      text
        .split(/\r?\n/)
        .map((s) => s.trim())
        .filter((s) => s.length > 0)
    )
  )
}

export function SettingsModal({ config, initialLayoutMode, onClose, onSave }: Props) {
  const originalZoom = config.ui.zoomFactor
  const originalScheme = config.ui.colorScheme
  const [draftZoom, setDraftZoom] = useState<number>(originalZoom)
  const [draftScheme, setDraftScheme] = useState<ColorScheme>(originalScheme)
  const [draftRootPath, setDraftRootPath] = useState<string>(config.rootPath)
  const [draftMaxSessions, setDraftMaxSessions] = useState<number>(config.maxSessions)
  const [draftLayoutMode, setDraftLayoutMode] = useState<LayoutMode>(config.ui.layoutMode)
  const [excludeText, setExcludeText] = useState<string>(
    config.excludePatterns.join('\n')
  )
  const [saving, setSaving] = useState(false)
  const [appVersion, setAppVersion] = useState<string>('')

  useEffect(() => {
    // 방어: preload가 새 빌드로 갱신 안 됐으면 함수가 없을 수 있음
    const fn = window.api.getAppVersion
    if (typeof fn !== 'function') return
    fn().then(setAppVersion).catch(() => {})
  }, [])

  useEffect(() => {
    window.api.setZoom(draftZoom)
  }, [draftZoom])

  useEffect(() => {
    applySchemePreview(draftScheme)
  }, [draftScheme])

  const handleCancel = useCallback(() => {
    window.api.setZoom(originalZoom)
    applySchemePreview(originalScheme)
    onClose()
  }, [originalZoom, originalScheme, onClose])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleCancel()
        return
      }
      if (!e.ctrlKey || e.altKey || e.shiftKey || e.metaKey) return
      if (e.key === '=' || e.key === '+') {
        e.preventDefault()
        setDraftZoom((z) => clampZoom(z + ZOOM_STEP))
      } else if (e.key === '-' || e.key === '_') {
        e.preventDefault()
        setDraftZoom((z) => clampZoom(z - ZOOM_STEP))
      } else if (e.key === '0') {
        e.preventDefault()
        setDraftZoom(1.0)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [handleCancel])

  const excludePatterns = useMemo(() => parseExcludeText(excludeText), [excludeText])

  const rootPathChanged = draftRootPath !== config.rootPath
  const excludeChanged =
    JSON.stringify(excludePatterns) !== JSON.stringify(config.excludePatterns)

  const handlePickFolder = async () => {
    const picked = await window.api.pickFolder(draftRootPath)
    if (picked) setDraftRootPath(picked)
  }

  const handleSave = async () => {
    const clampedSessions = Math.min(
      MAX_SESSIONS_LIMIT,
      Math.max(1, Math.round(draftMaxSessions))
    )
    let finalLayoutMode = draftLayoutMode
    // 레이아웃이 바뀌었으면 Y/N 확인. N이면 레이아웃만 원복하고 나머지는 저장.
    if (draftLayoutMode !== config.ui.layoutMode) {
      const ok = window.confirm(
        '레이아웃을 변경하면 앱을 재시작해야 새 레이아웃이 적용됩니다.\n' +
          '현재 세션(터미널/에디터)은 유지됩니다.\n\n' +
          '변경하시겠습니까?'
      )
      if (!ok) {
        finalLayoutMode = config.ui.layoutMode
        setDraftLayoutMode(config.ui.layoutMode)
      }
    }
    setSaving(true)
    const next: AppConfig = {
      ...config,
      rootPath: draftRootPath,
      excludePatterns,
      maxSessions: clampedSessions,
      ui: {
        ...config.ui,
        zoomFactor: clampZoom(draftZoom),
        colorScheme: draftScheme,
        layoutMode: finalLayoutMode
      }
    }
    try {
      await onSave(next)
      onClose()
    } finally {
      setSaving(false)
    }
  }

  // 저장된 레이아웃(config.ui.layoutMode) ≠ 부팅 시 적용된 레이아웃(initialLayoutMode)
  // 이면 재시작 대기 중. 사용자에게 명시.
  const layoutRestartPending =
    initialLayoutMode !== null && initialLayoutMode !== config.ui.layoutMode

  const pct = Math.round(draftZoom * 100)

  return (
    <div className="modal-backdrop" onMouseDown={handleCancel}>
      <div className="modal" onMouseDown={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <span className="title">⚙ 설정</span>
          <button className="icon-btn" type="button" onClick={handleCancel} title="닫기 (Esc)">
            ×
          </button>
        </div>
        <div className="modal-body">
          <section className="settings-section">
            <h3 className="settings-section-title">화면 · 테마</h3>
            <p className="settings-hint">프리셋을 선택하면 즉시 미리보기. 취소 시 원래대로.</p>
            <div className="scheme-grid">
              {SCHEME_META.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  className={`scheme-swatch scheme-preview-${m.id}${
                    draftScheme === m.id ? ' selected' : ''
                  }`}
                  onClick={() => setDraftScheme(m.id)}
                  title={m.hint}
                >
                  <span className="scheme-swatch-bar" />
                  <span className="scheme-swatch-label">{m.label}</span>
                </button>
              ))}
            </div>
          </section>

          <section className="settings-section">
            <h3 className="settings-section-title">화면 · 글자 크기</h3>
            <p className="settings-hint">
              UI와 터미널 전체에 적용됩니다. 모니터가 바뀌면 여기서 조절하세요.
            </p>
            <div className="zoom-row">
              <input
                type="range"
                min={ZOOM_MIN}
                max={ZOOM_MAX}
                step={ZOOM_STEP}
                value={draftZoom}
                onChange={(e) => setDraftZoom(parseFloat(e.target.value))}
                className="zoom-slider"
              />
              <span className="zoom-value">{pct}%</span>
              <button
                className="btn-ghost"
                type="button"
                onClick={() => setDraftZoom(1.0)}
                title="기본(100%)으로 리셋"
              >
                리셋
              </button>
            </div>
            <div className="zoom-marks">
              <span>80%</span>
              <span>100%</span>
              <span>150%</span>
            </div>
            <p className="settings-hint kbd-hint">
              단축키: <span className="kbd">Ctrl</span> <span className="kbd">+</span> 확대 ·{' '}
              <span className="kbd">Ctrl</span> <span className="kbd">-</span> 축소 ·{' '}
              <span className="kbd">Ctrl</span> <span className="kbd">0</span> 리셋
            </p>
          </section>

          <section className="settings-section">
            <h3 className="settings-section-title">프로젝트 · 루트 폴더</h3>
            <p className="settings-hint">
              앱이 프로젝트 폴더를 스캔할 최상위 경로입니다.
            </p>
            <div className="path-row">
              <code className="path-display" title={draftRootPath}>
                {draftRootPath}
              </code>
              <button className="btn-secondary" type="button" onClick={handlePickFolder}>
                변경…
              </button>
            </div>
            {rootPathChanged && (
              <p className="settings-hint warn">
                ⚠ 저장 시 폴더 목록을 다시 스캔합니다. 이미 열린 세션은 유지됩니다.
              </p>
            )}
          </section>

          <section className="settings-section">
            <h3 className="settings-section-title">프로젝트 · 제외 패턴</h3>
            <p className="settings-hint">
              스캔/파일 감시에서 제외할 폴더명. 한 줄에 하나씩. 대소문자 무시.
            </p>
            <textarea
              className="exclude-editor"
              value={excludeText}
              onChange={(e) => setExcludeText(e.target.value)}
              spellCheck={false}
              rows={7}
              placeholder="venv&#10;node_modules&#10;.git"
            />
            {excludeChanged && (
              <p className="settings-hint">저장 시 {excludePatterns.length}개 패턴 적용.</p>
            )}
          </section>

          <section className="settings-section">
            <h3 className="settings-section-title">프로젝트 · 최대 동시 세션</h3>
            <p className="settings-hint">
              동시에 열 수 있는 프로젝트 탭 수. 1~{MAX_SESSIONS_LIMIT}개.
            </p>
            <div className="zoom-row">
              <input
                type="number"
                min={1}
                max={MAX_SESSIONS_LIMIT}
                step={1}
                value={draftMaxSessions}
                onChange={(e) => setDraftMaxSessions(parseInt(e.target.value, 10) || 1)}
                className="max-sessions-input"
              />
              <span className="settings-hint">개</span>
            </div>
          </section>

          <section className="settings-section">
            <h3 className="settings-section-title">
              화면 · 작업공간 레이아웃
              {layoutRestartPending && (
                <span className="restart-badge" title="앱 재시작 후 적용됩니다">
                  ⏱ 재시작 대기 중
                </span>
              )}
            </h3>
            <p className="settings-hint">
              에디터 · Claude · PowerShell 3개 패널의 배치. 변경 시 Y/N 확인 후 저장되며,
              <b> 앱을 재시작해야 새 레이아웃이 적용</b>됩니다. 현재 세션은 유지됩니다.
            </p>
            <div className="layout-options">
              {LAYOUT_META.map((m) => (
                <label
                  key={m.id}
                  className={`layout-option${draftLayoutMode === m.id ? ' selected' : ''}`}
                >
                  <input
                    type="radio"
                    name="layoutMode"
                    value={m.id}
                    checked={draftLayoutMode === m.id}
                    onChange={() => setDraftLayoutMode(m.id)}
                  />
                  <div className="layout-option-body">
                    <div className="layout-option-label">{m.label}</div>
                    <div className="layout-option-hint">{m.hint}</div>
                  </div>
                </label>
              ))}
            </div>
            {layoutRestartPending && (
              <p className="settings-hint warn">
                ⚠ 저장된 레이아웃과 현재 렌더 중인 레이아웃이 다릅니다. 앱을 재시작하세요.
              </p>
            )}
          </section>

          <section className="settings-section about-section">
            <h3 className="settings-section-title">About</h3>
            <p className="about-message">
              Built to manage multiple Claude Code projects more comfortably.
              Try it out, and please email me with bug reports or feature suggestions.
            </p>
            <dl className="about-list">
              <dt>Developer</dt>
              <dd>
                ramenshin &lt;
                <a href="mailto:londongvmisushi@gmail.com">
                  londongvmisushi@gmail.com
                </a>
                &gt;
              </dd>
              <dt>GitHub</dt>
              <dd>
                <a
                  href="https://github.com/ramenshin/AhahahaIDE"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  github.com/ramenshin/AhahahaIDE
                </a>
              </dd>
              <dt>License</dt>
              <dd>
                <a
                  href="https://www.gnu.org/licenses/gpl-3.0.html"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  GPL-3.0-or-later
                </a>
              </dd>
              <dt>Version</dt>
              <dd>{appVersion || '...'} (2026.04)</dd>
            </dl>
          </section>
        </div>
        <div className="modal-footer">
          <button className="btn-secondary" type="button" onClick={handleCancel} disabled={saving}>
            취소
          </button>
          <button className="btn-primary" type="button" onClick={handleSave} disabled={saving}>
            {saving ? '저장 중…' : '저장'}
          </button>
        </div>
      </div>
    </div>
  )
}
