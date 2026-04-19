import { useCallback, useEffect, useState } from 'react'
import type { AppConfig } from '@shared/types'
import { ZOOM_MAX, ZOOM_MIN, ZOOM_STEP, clampZoom } from '@shared/types'


interface Props {
  config: AppConfig
  onClose: () => void
  onSave: (next: AppConfig) => void | Promise<void>
}

export function SettingsModal({ config, onClose, onSave }: Props) {
  const originalZoom = config.ui.zoomFactor
  const [draftZoom, setDraftZoom] = useState<number>(originalZoom)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    window.api.setZoom(draftZoom)
  }, [draftZoom])

  const handleCancel = useCallback(() => {
    window.api.setZoom(originalZoom)
    onClose()
  }, [originalZoom, onClose])

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

  const handleSave = async () => {
    setSaving(true)
    const next: AppConfig = {
      ...config,
      ui: { ...config.ui, zoomFactor: clampZoom(draftZoom) }
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
