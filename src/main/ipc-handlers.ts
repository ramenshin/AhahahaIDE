import { BrowserWindow, dialog, ipcMain } from 'electron'
import { IpcChannel } from '@shared/ipc-channels'
import type { AppConfig, PtyCreateOptions } from '@shared/types'
import { scanProjectFolders } from './folder-scanner'
import { loadConfig, saveConfig } from './state-store'
import { closePty, createPty, resizePty, writePty } from './pty-manager'
import { startWatch, stopWatch } from './file-watcher'
import { loadMemo, saveMemo } from './memo-store'
import { readTextFile, writeTextFile } from './file-store'

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

  ipcMain.handle(
    IpcChannel.MemoLoad,
    async (_event, projectPath: string): Promise<string | null> => {
      return loadMemo(projectPath)
    }
  )

  ipcMain.handle(
    IpcChannel.MemoSave,
    async (_event, projectPath: string, content: string): Promise<void> => {
      await saveMemo(projectPath, content)
    }
  )

  ipcMain.handle(
    IpcChannel.FileRead,
    async (_event, projectRoot: string, filePath: string) => {
      return readTextFile(projectRoot, filePath)
    }
  )

  ipcMain.handle(
    IpcChannel.FileSave,
    async (_event, projectRoot: string, filePath: string, content: string) => {
      await writeTextFile(projectRoot, filePath, content)
    }
  )

  ipcMain.handle(
    IpcChannel.DialogPickFolder,
    async (event, defaultPath?: string): Promise<string | null> => {
      const win = BrowserWindow.fromWebContents(event.sender)
      const opts: Electron.OpenDialogOptions = {
        properties: ['openDirectory'],
        title: '폴더 선택'
      }
      if (defaultPath) opts.defaultPath = defaultPath
      const result = win
        ? await dialog.showOpenDialog(win, opts)
        : await dialog.showOpenDialog(opts)
      if (result.canceled || result.filePaths.length === 0) return null
      return result.filePaths[0]
    }
  )
}
