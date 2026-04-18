import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron'
import { IpcChannel } from '@shared/ipc-channels'
import type {
  AppConfig,
  FolderScanResult,
  PtyCreateOptions,
  PtyDataPayload,
  PtyExitPayload
} from '@shared/types'

const api = {
  scanFolders: (): Promise<FolderScanResult> =>
    ipcRenderer.invoke(IpcChannel.ScanFolders),
  getConfig: (): Promise<AppConfig> =>
    ipcRenderer.invoke(IpcChannel.GetConfig),
  setConfig: (config: AppConfig): Promise<AppConfig> =>
    ipcRenderer.invoke(IpcChannel.SetConfig, config),
  pty: {
    create: (opts: PtyCreateOptions): Promise<string> =>
      ipcRenderer.invoke(IpcChannel.PtyCreate, opts),
    write: (ptyId: string, data: string): void => {
      ipcRenderer.send(IpcChannel.PtyWrite, ptyId, data)
    },
    resize: (ptyId: string, cols: number, rows: number): void => {
      ipcRenderer.send(IpcChannel.PtyResize, ptyId, cols, rows)
    },
    close: (ptyId: string): void => {
      ipcRenderer.send(IpcChannel.PtyClose, ptyId)
    },
    onData: (cb: (payload: PtyDataPayload) => void): (() => void) => {
      const listener = (_ev: IpcRendererEvent, payload: PtyDataPayload) =>
        cb(payload)
      ipcRenderer.on(IpcChannel.PtyData, listener)
      return () => ipcRenderer.off(IpcChannel.PtyData, listener)
    },
    onExit: (cb: (payload: PtyExitPayload) => void): (() => void) => {
      const listener = (_ev: IpcRendererEvent, payload: PtyExitPayload) =>
        cb(payload)
      ipcRenderer.on(IpcChannel.PtyExit, listener)
      return () => ipcRenderer.off(IpcChannel.PtyExit, listener)
    }
  }
}

export type DevIdeToolApi = typeof api

contextBridge.exposeInMainWorld('api', api)
