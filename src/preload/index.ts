import { contextBridge, ipcRenderer } from 'electron'
import { IpcChannel } from '@shared/ipc-channels'
import type { AppConfig, FolderScanResult } from '@shared/types'

const api = {
  scanFolders: (): Promise<FolderScanResult> =>
    ipcRenderer.invoke(IpcChannel.ScanFolders),
  getConfig: (): Promise<AppConfig> =>
    ipcRenderer.invoke(IpcChannel.GetConfig),
  setConfig: (config: AppConfig): Promise<AppConfig> =>
    ipcRenderer.invoke(IpcChannel.SetConfig, config)
}

export type DevIdeToolApi = typeof api

contextBridge.exposeInMainWorld('api', api)
