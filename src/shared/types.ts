export interface ProjectFolder {
  name: string
  path: string
  hasVenv: boolean
  hasGit: boolean
  hasAhahahaConfig: boolean
  modifiedAt: number
}

export interface FolderScanResult {
  rootPath: string
  folders: ProjectFolder[]
  scannedAt: number
}

export type LayoutMode = 'row3' | 'col3' | 'rowcol'

export interface LayoutSizes {
  row3: {
    editorHeight: number
    claudeTerminalHeight: number
    plainTerminalHeight: number
  }
  col3: {
    editorWidth: number
    claudeTerminalWidth: number
    plainTerminalWidth: number
  }
  rowcol: {
    editorHeight: number
    claudeTerminalWidth: number
  }
}

export interface AppConfig {
  schemaVersion?: number
  rootPath: string
  excludePatterns: string[]
  maxSessions: number
  startupMode: 'empty' | 'restore'
  ui: {
    colorScheme: ColorScheme
    showGitBranch: boolean
    zoomFactor: number
    layoutMode: LayoutMode
    panels: {
      leftWidth: number
      folderListWidth: number
      memoHeight: number
      layouts: LayoutSizes
    }
  }
  hibernate: {
    enabled: boolean
    idleMinutes: number
  }
  notifications: {
    enabled: boolean
    onComplete: boolean
    onError: boolean
  }
}

export type ColorScheme = 'a' | 'b' | 'c' | 'd' | 'e' | 'f' | 'g' | 'h'

export const CONFIG_SCHEMA_VERSION = 2
export const MAX_SESSIONS_LIMIT = 20

export const ZOOM_MIN = 0.8
export const ZOOM_MAX = 1.5
export const ZOOM_STEP = 0.1

export function clampZoom(value: number): number {
  if (!Number.isFinite(value)) return 1.0
  return Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, value))
}

export type PtyKind = 'claude' | 'plain'

export type QuikContentMode = 'doc' | 'code'

export interface QuikFileEntry {
  relPath: string  // forward slashes, relative to root
  absPath: string
}

export interface QuikContentMatch {
  relPath: string
  absPath: string
  line: number  // 1-based
  snippet: string
}

export const QUIK_MAX_FILE_BYTES = 50 * 1024 * 1024
export const QUIK_MAX_RESULTS = 100

export const CLAUDE_SAVE_STATE_PROMPT =
  '지금까지 진행한 작업 상태를 memory에 저장해 주세요. 다음에 이어서 진행할 수 있도록 현재 진행 중인 작업·미해결 TODO·의사결정 컨텍스트를 정리해 주세요.'

export interface PtyCreateOptions {
  folderPath: string
  kind: PtyKind
  cols: number
  rows: number
}

export interface PtyDataPayload {
  ptyId: string
  data: string
}

export interface PtyExitPayload {
  ptyId: string
  exitCode: number
  signal: number
}

export interface FileNode {
  name: string
  path: string
  isDirectory: boolean
}

export interface FileTreeSnapshot {
  rootPath: string
  nodes: FileNode[]
}

export type FsChangeType = 'add' | 'addDir' | 'unlink' | 'unlinkDir' | 'change'

export interface FsChangeEvent {
  rootPath: string
  type: FsChangeType
  path: string
  isDirectory: boolean
}

export const DEFAULT_LAYOUT_SIZES: LayoutSizes = {
  row3: {
    editorHeight: 40,
    claudeTerminalHeight: 30,
    plainTerminalHeight: 30
  },
  col3: {
    editorWidth: 40,
    claudeTerminalWidth: 30,
    plainTerminalWidth: 30
  },
  rowcol: {
    editorHeight: 40,
    claudeTerminalWidth: 50
  }
}

export const DEFAULT_CONFIG: AppConfig = {
  schemaVersion: CONFIG_SCHEMA_VERSION,
  // 빈 문자열 = 첫 실행 마법사가 채울 신호. 마법사 완료 전에는 메인 UI 안 뜸.
  rootPath: '',
  excludePatterns: ['venv', 'node_modules', '.git', '__pycache__', '.pytest_cache', '.vite', 'dist', 'out', 'build'],
  maxSessions: 5,
  startupMode: 'restore',
  ui: {
    colorScheme: 'd',
    showGitBranch: true,
    zoomFactor: 1.1,
    layoutMode: 'row3',
    panels: {
      leftWidth: 32,
      folderListWidth: 42,
      memoHeight: 30,
      layouts: DEFAULT_LAYOUT_SIZES
    }
  },
  hibernate: {
    enabled: true,
    idleMinutes: 30
  },
  notifications: {
    enabled: true,
    onComplete: true,
    onError: true
  }
}
