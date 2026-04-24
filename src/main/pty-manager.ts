import { spawn, type IPty } from 'node-pty'
import { randomUUID } from 'node:crypto'
import type { PtyCreateOptions, PtyExitPayload, PtyKind } from '@shared/types'

interface PtyEntry {
  id: string
  proc: IPty
  kind: PtyKind
  folderPath: string
}

type DataListener = (ptyId: string, data: string) => void
type ExitListener = (payload: PtyExitPayload) => void

const ptyMap = new Map<string, PtyEntry>()
const SHELL = process.env.COMSPEC ? 'powershell.exe' : 'powershell.exe'

function escapeSingleQuotes(value: string): string {
  return value.replace(/'/g, "''")
}

function buildStartupCommand(folderPath: string, kind: PtyKind): string {
  const cdCmd = `Set-Location -LiteralPath '${escapeSingleQuotes(folderPath)}'`
  const venvCmd =
    `if (Test-Path .\\venv\\Scripts\\Activate.ps1) { & .\\venv\\Scripts\\Activate.ps1 } ` +
    `elseif (Test-Path .\\.venv\\Scripts\\Activate.ps1) { & .\\.venv\\Scripts\\Activate.ps1 }`
  const base = `${cdCmd}; ${venvCmd}; Clear-Host`
  if (kind === 'claude') {
    return `${base}; claude`
  }
  return base
}

export function createPty(
  opts: PtyCreateOptions,
  onData: DataListener,
  onExit: ExitListener
): string {
  const id = randomUUID()
  const proc = spawn(SHELL, [], {
    name: 'xterm-256color',
    cols: Math.max(opts.cols || 80, 20),
    rows: Math.max(opts.rows || 24, 5),
    cwd: opts.folderPath,
    env: { ...process.env } as Record<string, string>
  })

  ptyMap.set(id, { id, proc, kind: opts.kind, folderPath: opts.folderPath })

  proc.onData((data) => onData(id, data))
  proc.onExit(({ exitCode, signal }) => {
    ptyMap.delete(id)
    onExit({ ptyId: id, exitCode, signal: signal ?? 0 })
  })

  const startup = buildStartupCommand(opts.folderPath, opts.kind)
  setTimeout(() => {
    const entry = ptyMap.get(id)
    if (entry) entry.proc.write(`${startup}\r`)
  }, 250)

  return id
}

export function writePty(id: string, data: string): void {
  ptyMap.get(id)?.proc.write(data)
}

// folderPath + kind로 PTY를 찾아 write. 매칭되는 첫 항목에만 전송.
// 반환: 매칭돼 전송했으면 true, 없으면 false.
export function writePtyByFolder(
  folderPath: string,
  kind: PtyKind,
  data: string
): boolean {
  for (const entry of ptyMap.values()) {
    if (entry.folderPath === folderPath && entry.kind === kind) {
      entry.proc.write(data)
      return true
    }
  }
  return false
}

export function resizePty(id: string, cols: number, rows: number): void {
  const entry = ptyMap.get(id)
  if (!entry) return
  try {
    entry.proc.resize(Math.max(cols, 20), Math.max(rows, 5))
  } catch {
    // resize on dead pty throws; ignore
  }
}

export function closePty(id: string): void {
  const entry = ptyMap.get(id)
  if (!entry) return
  try {
    entry.proc.kill()
  } catch {
    // ignore
  }
  ptyMap.delete(id)
}

export function closeAllPtys(): void {
  for (const id of Array.from(ptyMap.keys())) closePty(id)
}
