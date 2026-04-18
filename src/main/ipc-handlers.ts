import { ipcMain } from 'electron'
import { IpcChannel } from '@shared/ipc-channels'
import type { AppConfig } from '@shared/types'
import { scanProjectFolders } from './folder-scanner'
import { loadConfig, saveConfig } from './state-store'

export function registerIpcHandlers(): void {
  ipcMain.handle(IpcChannel.ScanFolders, async () => {
    const config = await loadConfig()
    return scanProjectFolders(config.rootPath, config.excludePatterns)
  })

  ipcMain.handle(IpcChannel.GetConfig, async () => {
    return loadConfig()
  })

  ipcMain.handle(IpcChannel.SetConfig, async (_event, config: AppConfig) => {
    await saveConfig(config)
    return config
  })
}
