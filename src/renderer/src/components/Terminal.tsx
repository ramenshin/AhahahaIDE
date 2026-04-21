import { useEffect, useRef } from 'react'
import { Terminal as XTerm, type ITheme } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import { WebLinksAddon } from '@xterm/addon-web-links'
import '@xterm/xterm/css/xterm.css'
import type { PtyKind } from '@shared/types'

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

export function Terminal({ folderPath, kind }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const term = new XTerm({
      cursorBlink: true,
      fontFamily: 'Consolas, "Cascadia Mono", monospace',
      fontSize: 13,
      scrollback: 10000,
      theme: buildTheme()
    })
    const fit = new FitAddon()
    const links = new WebLinksAddon()
    term.loadAddon(fit)
    term.loadAddon(links)
    term.open(container)

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
          if (pid === id) term.write(data)
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

  return <div ref={containerRef} className="xterm-host" />
}
