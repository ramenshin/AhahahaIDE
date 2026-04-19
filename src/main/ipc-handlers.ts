import { BrowserWindow, ipcMain } from 'electron'
import { IpcChannel } from '@shared/ipc-channels'
import type { AppConfig, PtyCreateOptions } from '@shared/types'
import { scanProjectFolders } from './folder-scanner'
import { loadConfig, saveConfig } from './state-store'
import { closePty, createPty, resizePty, writePty } from './pty-manager'
import { startWatch, stopWatch } from './file-watcher'

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

  ipcMain.handle(IpcChannel.PtyCreate, (event, opts: PtyCreateOptions) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    if (!win) throw new Error('No window for pty:create')
    const id = createPty(
      opts,
      (ptyId, data) => {
        if (!win.isDestroyed()) {
          win.webContents.send(IpcChannel.PtyData, { ptyId, data })
        }
      },
      (payload) => {
        if (!win.isDestroyed()) {
          win.webContents.send(IpcChannel.PtyExit, payload)
        }
      }
    )
    return id
  })

  ipcMain.on(IpcChannel.PtyWrite, (_event, ptyId: string, data: string) => {
    writePty(ptyId, data)
  })

  ipcMain.on(
    IpcChannel.PtyResize,
    (_event, ptyId: string, cols: number, rows: number) => {
      resizePty(ptyId, cols, rows)
    }
  )

  ipcMain.on(IpcChannel.PtyClose, (_event, ptyId: string) => {
    closePty(ptyId)
  })

  ipcMain.handle(IpcChannel.FsWatch, async (event, rootPath: string) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    const config = await loadConfig()
    return startWatch(
      rootPath,
      config.excludePatterns,
      (ev) => {
        if (win && !win.isDestroyed()) {
          win.webContents.send(IpcChannel.FsChange, ev)
        }
      },
      () => {
        if (win && !win.isDestroyed()) {
          win.webContents.send(IpcChannel.FsRootRemoved, rootPath)
        }
      }
    )
  })

  ipcMain.handle(IpcChannel.FsUnwatch, async () => {
    await stopWatch()
  })
}
