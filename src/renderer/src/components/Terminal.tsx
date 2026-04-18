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
    background: readCssVar('--bg-1', '#1a1f24'),
    foreground: readCssVar('--text-0', '#e6edf3'),
    cursor: readCssVar('--accent', '#36b289'),
    cursorAccent: readCssVar('--bg-1', '#1a1f24'),
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
