export interface ProjectFolder {
  name: string
  path: string
  hasVenv: boolean
  hasGit: boolean
  hasDevIdeToolConfig: boolean
  modifiedAt: number
}

export interface FolderScanResult {
  rootPath: string
  folders: ProjectFolder[]
  scannedAt: number
}

export interface AppConfig {
  rootPath: string
  excludePatterns: string[]
  maxSessions: number
  startupMode: 'empty' | 'restore'
  ui: {
    colorScheme: ColorScheme
    showGitBranch: boolean
    panels: {
      leftWidth: number
      folderListWidth: number
      memoHeight: number
      editorHeight: number
      claudeTerminalHeight: number
      plainTerminalHeight: number
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

export type PtyKind = 'claude' | 'plain'

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

export const DEFAULT_CONFIG: AppConfig = {
  rootPath: 'D:\\Projects',
  excludePatterns: ['venv', 'node_modules', '.git', '__pycache__', '.pytest_cache', '.vite', 'dist', 'out', 'build'],
  maxSessions: 20,
  startupMode: 'restore',
  ui: {
    colorScheme: 'd',
    showGitBranch: true,
    panels: {
      leftWidth: 32,
      folderListWidth: 42,
      memoHeight: 30,
      editorHeight: 40,
      claudeTerminalHeight: 30,
      plainTerminalHeight: 30
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
