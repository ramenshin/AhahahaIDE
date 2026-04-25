import { promises as fs } from 'node:fs'
import { dirname, join } from 'node:path'
import { app } from 'electron'
import {
  CONFIG_SCHEMA_VERSION,
  DEFAULT_CONFIG,
  DEFAULT_LAYOUT_SIZES,
  MAX_SESSIONS_LIMIT,
  clampZoom,
  type AppConfig,
  type LayoutMode,
  type LayoutSizes
} from '@shared/types'

const CONFIG_FILENAME = 'config.json'

// 공개 배포 대비 3-tier 분기 (Option C 강화판).
// 1) PORTABLE_EXECUTABLE_DIR — electron-builder portable 빌드 시 자동 주입.
//    portable.exe 가 있는 폴더에 config.json 저장 → 폴더째 USB로 옮기면 같이 따라감.
// 2) AHAHAHAIDE_CONFIG_DIR — 명시적 환경변수 오버라이드. CI·테스트·고급 사용자용.
// 3) userData — OS 표준 (Windows %APPDATA%, macOS ~/Library/Application Support,
//    Linux ~/.config). 일반 사용자 기본 위치 — 멀티 OS 사용자·프라이버시 안전.
let cachedConfigDir: string | null = null
function getConfigDir(): string {
  if (cachedConfigDir) return cachedConfigDir
  const portable = process.env.PORTABLE_EXECUTABLE_DIR
  const override = process.env.AHAHAHAIDE_CONFIG_DIR
  const dir = portable || override || app.getPath('userData')
  const tier = portable ? 'portable' : override ? 'override' : 'userData'
  console.log(`[state-store] config dir = ${dir} (${tier})`)
  cachedConfigDir = dir
  return dir
}

function getConfigPath(): string {
  return join(getConfigDir(), CONFIG_FILENAME)
}

// 스키마 v1(flat panels) → v2(layouts 중첩 + layoutMode) 호환용 shape
interface LegacyPanels {
  leftWidth?: number
  folderListWidth?: number
  memoHeight?: number
  editorHeight?: number
  claudeTerminalHeight?: number
  plainTerminalHeight?: number
  layouts?: Partial<LayoutSizes>
}

function mergeLayouts(partial: Partial<LayoutSizes> | undefined, legacyRow3Fallback?: {
  editorHeight?: number
  claudeTerminalHeight?: number
  plainTerminalHeight?: number
}): LayoutSizes {
  const row3Base = { ...DEFAULT_LAYOUT_SIZES.row3, ...(partial?.row3 ?? {}) }
  // v1 flat 필드가 있으면 row3에 흡수 (partial.row3가 우선)
  if (legacyRow3Fallback && !partial?.row3) {
    if (typeof legacyRow3Fallback.editorHeight === 'number')
      row3Base.editorHeight = legacyRow3Fallback.editorHeight
    if (typeof legacyRow3Fallback.claudeTerminalHeight === 'number')
      row3Base.claudeTerminalHeight = legacyRow3Fallback.claudeTerminalHeight
    if (typeof legacyRow3Fallback.plainTerminalHeight === 'number')
      row3Base.plainTerminalHeight = legacyRow3Fallback.plainTerminalHeight
  }
  return {
    row3: row3Base,
    col3: { ...DEFAULT_LAYOUT_SIZES.col3, ...(partial?.col3 ?? {}) },
    rowcol: { ...DEFAULT_LAYOUT_SIZES.rowcol, ...(partial?.rowcol ?? {}) }
  }
}

function clampSessions(n: unknown): number {
  if (typeof n !== 'number' || !Number.isFinite(n)) return DEFAULT_CONFIG.maxSessions
  return Math.min(MAX_SESSIONS_LIMIT, Math.max(1, Math.round(n)))
}

function isLayoutMode(v: unknown): v is LayoutMode {
  return v === 'row3' || v === 'col3' || v === 'rowcol'
}

function mergeConfig(partial: Partial<AppConfig>): AppConfig {
  const legacyPanels: LegacyPanels = (partial.ui?.panels as LegacyPanels | undefined) ?? {}
  const priorVersion = typeof partial.schemaVersion === 'number' ? partial.schemaVersion : 1

  const merged: AppConfig = {
    ...DEFAULT_CONFIG,
    ...partial,
    schemaVersion: CONFIG_SCHEMA_VERSION,
    ui: {
      ...DEFAULT_CONFIG.ui,
      ...(partial.ui ?? {}),
      layoutMode: isLayoutMode(partial.ui?.layoutMode)
        ? partial.ui!.layoutMode
        : DEFAULT_CONFIG.ui.layoutMode,
      panels: {
        leftWidth: legacyPanels.leftWidth ?? DEFAULT_CONFIG.ui.panels.leftWidth,
        folderListWidth: legacyPanels.folderListWidth ?? DEFAULT_CONFIG.ui.panels.folderListWidth,
        memoHeight: legacyPanels.memoHeight ?? DEFAULT_CONFIG.ui.panels.memoHeight,
        layouts: mergeLayouts(legacyPanels.layouts, {
          editorHeight: legacyPanels.editorHeight,
          claudeTerminalHeight: legacyPanels.claudeTerminalHeight,
          plainTerminalHeight: legacyPanels.plainTerminalHeight
        })
      }
    },
    hibernate: { ...DEFAULT_CONFIG.hibernate, ...(partial.hibernate ?? {}) },
    notifications: { ...DEFAULT_CONFIG.notifications, ...(partial.notifications ?? {}) }
  }

  merged.ui.zoomFactor = clampZoom(merged.ui.zoomFactor)
  merged.maxSessions = clampSessions(merged.maxSessions)

  // v1 → v2 일회성 마이그레이션: 기본값을 신규 디폴트로 밀어올림.
  // 사용자가 이미 v2 이상에서 customize한 값은 보존.
  if (priorVersion < CONFIG_SCHEMA_VERSION) {
    merged.maxSessions = DEFAULT_CONFIG.maxSessions
    merged.ui.zoomFactor = DEFAULT_CONFIG.ui.zoomFactor
  }

  return merged
}

export async function loadConfig(): Promise<AppConfig> {
  const configPath = getConfigPath()
  try {
    const raw = await fs.readFile(configPath, 'utf8')
    const parsed = JSON.parse(raw) as Partial<AppConfig>
    return mergeConfig(parsed)
  } catch (err: unknown) {
    if ((err as NodeJS.ErrnoException)?.code !== 'ENOENT') {
      console.warn('[state-store] failed to load config, falling back to default', err)
    }
    return { ...DEFAULT_CONFIG }
  }
}

export async function saveConfig(config: AppConfig): Promise<void> {
  const configPath = getConfigPath()
  await fs.mkdir(dirname(configPath), { recursive: true })
  await fs.writeFile(configPath, JSON.stringify(config, null, 2), 'utf8')
}
