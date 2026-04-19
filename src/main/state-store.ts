import { promises as fs } from 'node:fs'
import { dirname, join } from 'node:path'
import { app } from 'electron'
import { clampZoom, DEFAULT_CONFIG, type AppConfig } from '@shared/types'

const CONFIG_FILENAME = 'config.json'

function getConfigPath(): string {
  return join(app.getPath('userData'), CONFIG_FILENAME)
}

function mergeConfig(partial: Partial<AppConfig>): AppConfig {
  const merged: AppConfig = {
    ...DEFAULT_CONFIG,
    ...partial,
    ui: { ...DEFAULT_CONFIG.ui, ...(partial.ui ?? {}),
      panels: { ...DEFAULT_CONFIG.ui.panels, ...(partial.ui?.panels ?? {}) } },
    hibernate: { ...DEFAULT_CONFIG.hibernate, ...(partial.hibernate ?? {}) },
    notifications: { ...DEFAULT_CONFIG.notifications, ...(partial.notifications ?? {}) }
  }
  merged.ui.zoomFactor = clampZoom(merged.ui.zoomFactor)
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
