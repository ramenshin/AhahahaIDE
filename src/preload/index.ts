import {
  contextBridge,
  ipcRenderer,
  webFrame,
  type IpcRendererEvent
} from 'electron'
import { IpcChannel } from '@shared/ipc-channels'
import { clampZoom } from '@shared/types'
import type {
  AppConfig,
  FolderScanResult,
  PtyCreateOptions,
  PtyDataPayload,
  PtyExitPayload
} from '@shared/types'

// 터미널 세션 최대 20개 × 채널 2개 = 40 리스너가 상한.
// 기본 10 한도는 의도적 다중 구독에도 경고를 띄우므로 여유 있게 50으로 상향.
ipcRenderer.setMaxListeners(50)

const api = {
  scanFolders: (): Promise<FolderScanResult> =>
    ipcRenderer.invoke(IpcChannel.ScanFolders),
  getConfig: (): Promise<AppConfig> =>
    ipcRenderer.invoke(IpcChannel.GetConfig),
  setConfig: (config: AppConfig): Promise<AppConfig> =>
    ipcRenderer.invoke(IpcChannel.SetConfig, config),
  setZoom: (factor: number): number => {
    const clamped = clampZoom(factor)
    webFrame.setZoomFactor(clamped)
    return clamped
  },
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
