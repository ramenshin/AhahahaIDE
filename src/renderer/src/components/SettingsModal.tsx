import { useCallback, useEffect, useMemo, useState } from 'react'
import type { AppConfig, ColorScheme } from '@shared/types'
import { ZOOM_MAX, ZOOM_MIN, ZOOM_STEP, clampZoom } from '@shared/types'

interface Props {
  config: AppConfig
  onClose: () => void
  onSave: (next: AppConfig) => void | Promise<void>
}

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

export function SettingsModal({ config, onClose, onSave }: Props) {
  const originalZoom = config.ui.zoomFactor
  const originalScheme = config.ui.colorScheme
  const [draftZoom, setDraftZoom] = useState<number>(originalZoom)
  const [draftScheme, setDraftScheme] = useState<ColorScheme>(originalScheme)
  const [draftRootPath, setDraftRootPath] = useState<string>(config.rootPath)
  const [excludeText, setExcludeText] = useState<string>(
    config.excludePatterns.join('\n')
  )
  const [saving, setSaving] = useState(false)

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
    setSaving(true)
    const next: AppConfig = {
      ...config,
      rootPath: draftRootPath,
      excludePatterns,
      ui: {
        ...config.ui,
        zoomFactor: clampZoom(draftZoom),
        colorScheme: draftScheme
      }
    }
    try {
      await onSave(next)
      onClose()
    } finally {
      setSaving(false)
    }
  }

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
