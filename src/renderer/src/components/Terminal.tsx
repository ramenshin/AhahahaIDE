import { useEffect, useRef, useState } from 'react'
import { Terminal as XTerm, type ITheme } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import { WebLinksAddon } from '@xterm/addon-web-links'
import { Unicode11Addon } from '@xterm/addon-unicode11'
// WebglAddon import 보류 — 검은 화면 유발. 진단 후 재검토.
// import { WebglAddon } from '@xterm/addon-webgl'
import '@xterm/xterm/css/xterm.css'
import type { PtyKind } from '@shared/types'

// 디버그 토글 — DevTools 콘솔에서 `window.__terminalRawDump = true` 로 켜면
// PTY → terminal 로 들어오는 모든 바이트가 콘솔에 hex+텍스트로 찍힘.
// 깨짐 재현 직전에 켜고 재현 후 끄기 권장(스팸 양 큼).
declare global {
  interface Window {
    __terminalRawDump?: boolean
  }
}

// 사람이 읽기 쉬운 hex+printable 형태로 변환 (ESC=\x1b, ESC[ 같은 시퀀스 강조)
function rawDump(label: string, data: string): void {
  if (!window.__terminalRawDump) return
  const printable = data
    .replace(/\x1b/g, '⎋')
    .replace(/\r/g, '\\r')
    .replace(/\n/g, '\\n\n')
  const hex = Array.from(data)
    .map((c) => c.charCodeAt(0).toString(16).padStart(2, '0'))
    .join(' ')
  console.log(`[pty:${label}]`, printable)
  console.log(`[pty:${label}:hex]`, hex)
}

interface Props {
  folderPath: string
  kind: PtyKind
}

function readCssVar(name: string, fallback: string): string {
  const v = getComputedStyle(document.body).getPropertyValue(name).trim()
  return v || fallback
}

function buildTheme(): ITheme {
  return {
    background: '#000000',
    foreground: readCssVar('--text-0', '#e6edf3'),
    cursor: readCssVar('--accent', '#36b289'),
    cursorAccent: '#000000',
    selectionBackground: readCssVar('--bg-active', '#2a3138')
  }
}

// 디버그용 — 단계별 로그 + 실패 단계 식별. 문제 해결 후 제거 또는 단순화.
const dbg = (msg: string, ...args: unknown[]) =>
  console.log(`[terminal] ${msg}`, ...args)

export function Terminal({ folderPath, kind }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  // 마운트 실패 시 사용자에게 보일 에러 (UI 먹통 방지)
  const [mountError, setMountError] = useState<string | null>(null)

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    dbg(`mount START — folderPath=${folderPath}, kind=${kind}`)

    let term: XTerm
    let fit: FitAddon
    try {
      dbg('step 1: new XTerm')
      term = new XTerm({
        cursorBlink: true,
        fontFamily: 'Consolas, "Cascadia Mono", monospace',
        fontSize: 13,
        scrollback: 10000,
        theme: buildTheme()
      })
      dbg('step 2: load fit + links addons')
      fit = new FitAddon()
      const links = new WebLinksAddon()
      term.loadAddon(fit)
      term.loadAddon(links)
      dbg('step 3: term.open(container)')
      term.open(container)
      dbg('step 4: load unicode11 + activate')
      try {
        term.loadAddon(new Unicode11Addon())
        term.unicode.activeVersion = '11'
        dbg('step 4 OK')
      } catch (err) {
        // 이 실패는 치명적이지 않음 — 한글이 깨질 뿐 동작은 됨
        console.warn('[terminal] unicode11 init failed (non-fatal):', err)
      }
      // WebGL 렌더러는 검은 화면을 유발해서 비활성화. 데이터 진단 후 재검토.
      // (코드는 보존 — 추후 옵션화 가능)
      dbg('step 4b: WebGL renderer SKIPPED (caused black screen)')
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error('[terminal] mount FAILED:', err)
      setMountError(msg)
      return
    }
    dbg('step 5: setup ResizeObserver, key handlers, contextmenu')

    const initialFitHandle = requestAnimationFrame(() => {
      try { fit.fit() } catch { /* container not sized yet */ }
    })

    let ptyId: string | null = null
    let disposeData: (() => void) | null = null
    let disposeExit: (() => void) | null = null
    let inputDisposable: { dispose: () => void } | null = null
    let resizeDisposable: { dispose: () => void } | null = null
    let cancelled = false

    const ro = new ResizeObserver(() => {
      try { fit.fit() } catch { /* ignore */ }
    })
    ro.observe(container)

    // 복사/붙여넣기 키바인딩. Ctrl+C/V를 쓰면 shell의 SIGINT/쓰기와 충돌하므로
    // Windows Terminal 관례인 Ctrl+Shift+C/V 사용.
    term.attachCustomKeyEventHandler((e) => {
      if (e.type !== 'keydown') return true
      const key = e.key.toLowerCase()
      if (e.ctrlKey && e.shiftKey && !e.altKey && key === 'c') {
        const sel = term.getSelection()
        if (sel) navigator.clipboard.writeText(sel).catch(() => {})
        return false
      }
      if (e.ctrlKey && e.shiftKey && !e.altKey && key === 'v') {
        navigator.clipboard
          .readText()
          .then((text) => {
            if (ptyId && text) window.api.pty.write(ptyId, text)
          })
          .catch(() => {})
        return false
      }
      return true
    })

    // 우클릭: 선택된 텍스트 있으면 복사, 없으면 붙여넣기 (PuTTY/Windows Terminal 관례).
    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault()
      const sel = term.getSelection()
      if (sel) {
        navigator.clipboard.writeText(sel).catch(() => {})
        term.clearSelection()
      } else {
        navigator.clipboard
          .readText()
          .then((text) => {
            if (ptyId && text) window.api.pty.write(ptyId, text)
          })
          .catch(() => {})
      }
    }
    container.addEventListener('contextmenu', handleContextMenu)

    ;(async () => {
      try {
        const id = await window.api.pty.create({
          folderPath,
          kind,
          cols: term.cols || 80,
          rows: term.rows || 24
        })
        if (cancelled) {
          window.api.pty.close(id)
          return
        }
        ptyId = id
        disposeData = window.api.pty.onData(({ ptyId: pid, data }) => {
          if (pid !== id) return
          rawDump(`${kind}<-`, data)
          // xterm.js 5.5의 DEC Mode 2026(Synchronized Output) 처리 버그 우회.
          // Claude Code TUI가 매 청크마다 ?2026h/?2026l 로 감싸 보내는데,
          // xterm이 이 영역 내 커서 이동·컬러·CJK 와이드 문자 섞이면 셀 위치
          // 계산이 어긋나 글자 뭉개짐. 마커 제거 → 즉시 렌더 → 정확도 우선.
          const cleaned = data.replace(/\x1b\[\?2026[hl]/g, '')
          term.write(cleaned)
        })
        disposeExit = window.api.pty.onExit(({ ptyId: pid, exitCode }) => {
          if (pid === id) {
            term.write(`\r\n\x1b[90m[process exited: ${exitCode}]\x1b[0m\r\n`)
          }
        })
        inputDisposable = term.onData((d) => window.api.pty.write(id, d))
        resizeDisposable = term.onResize(({ cols, rows }) =>
          window.api.pty.resize(id, cols, rows)
        )
      } catch (err) {
        term.write(`\r\n\x1b[31m[pty create failed: ${String(err)}]\x1b[0m\r\n`)
      }
    })()

    return () => {
      cancelled = true
      cancelAnimationFrame(initialFitHandle)
      ro.disconnect()
      container.removeEventListener('contextmenu', handleContextMenu)
      inputDisposable?.dispose()
      resizeDisposable?.dispose()
      disposeData?.()
      disposeExit?.()
      if (ptyId) window.api.pty.close(ptyId)
      term.dispose()
    }
  }, [folderPath, kind])

  if (mountError) {
    return (
      <div className="terminal-mount-error">
        터미널 초기화 실패: {mountError}
      </div>
    )
  }
  return <div ref={containerRef} className="xterm-host" />
}
