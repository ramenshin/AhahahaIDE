import { promises as fs } from 'node:fs'
import { isAbsolute, join, relative } from 'node:path'
import { app, BrowserWindow, dialog, ipcMain } from 'electron'
import { IpcChannel } from '@shared/ipc-channels'
import type {
  AppConfig,
  PtyCreateOptions,
  PtyKind,
  QuikContentMode
} from '@shared/types'
import { scanProjectFolders } from './folder-scanner'
import { loadConfig, saveConfig } from './state-store'
import { listFiles as quikListFiles, searchContent as quikSearchContent } from './quik-search'
import {
  closePty,
  createPty,
  resizePty,
  writePty,
  writePtyByFolder
} from './pty-manager'
import { startWatch, stopWatch } from './file-watcher'
import { loadMemo, saveMemo } from './memo-store'
import { readTextFile, writeTextFile } from './file-store'

// Windows 금지 문자 + 제어 문자 + 경로 구분자. 이름이 이미 trim된 상태라고 가정.
const INVALID_FOLDER_NAME_RE = /[<>:"/\\|?*\x00-\x1f]/

async function createProjectFolder(name: string): Promise<string> {
  const trimmed = name.trim()
  if (!trimmed) throw new Error('폴더 이름을 입력하세요.')
  if (INVALID_FOLDER_NAME_RE.test(trimmed)) {
    throw new Error('사용할 수 없는 문자가 포함돼 있습니다: < > : " / \\ | ? *')
  }
  if (trimmed === '.' || trimmed === '..') {
    throw new Error('사용할 수 없는 이름입니다.')
  }
  const config = await loadConfig()
  const target = join(config.rootPath, trimmed)
  const rel = relative(config.rootPath, target)
  if (rel.startsWith('..') || isAbsolute(rel)) {
    throw new Error('루트 폴더 밖으로 나갈 수 없습니다.')
  }
  try {
    await fs.mkdir(target, { recursive: false })
  } catch (err) {
    const e = err as NodeJS.ErrnoException
    if (e.code === 'EEXIST') throw new Error('같은 이름의 폴더가 이미 존재합니다.')
    throw err
  }
  return target
}

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

  ipcMain.handle(
    IpcChannel.PtyWriteByFolder,
    (_event, folderPath: string, kind: PtyKind, data: string): boolean => {
      return writePtyByFolder(folderPath, kind, data)
    }
  )

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
    IpcChannel.FolderCreate,
    async (_event, name: string): Promise<string> => {
      return createProjectFolder(name)
    }
  )

  // 첫 실행 마법사 기본 제안값: 사용자 홈 + "Projects".
  ipcMain.handle(IpcChannel.AppDefaultRootSuggestion, (): string => {
    return join(app.getPath('home'), 'Projects')
  })

  // 설정 모달의 About 섹션. package.json 의 version 자동 반영.
  ipcMain.handle(IpcChannel.AppGetVersion, (): string => {
    return app.getVersion()
  })

  // frameless 윈도우 컨트롤 (TopBar의 min/max/close 버튼이 호출)
  ipcMain.on(IpcChannel.WindowMinimize, (event) => {
    BrowserWindow.fromWebContents(event.sender)?.minimize()
  })
  ipcMain.on(IpcChannel.WindowToggleMaximize, (event) => {
    const w = BrowserWindow.fromWebContents(event.sender)
    if (!w) return
    if (w.isMaximized()) w.unmaximize()
    else w.maximize()
  })
  ipcMain.on(IpcChannel.WindowClose, (event) => {
    BrowserWindow.fromWebContents(event.sender)?.close()
  })

  // 첫 실행 마법사용. 절대 경로의 디렉토리가 존재하는지 확인.
  ipcMain.handle(
    IpcChannel.FsDirExists,
    async (_event, absPath: string): Promise<boolean> => {
      if (!absPath || !isAbsolute(absPath)) return false
      try {
        const stat = await fs.stat(absPath)
        return stat.isDirectory()
      } catch {
        return false
      }
    }
  )

  // 첫 실행 마법사용. 절대 경로에 mkdir-recursive. 안전 가드 최소.
  ipcMain.handle(
    IpcChannel.FsMkdir,
    async (_event, absPath: string): Promise<void> => {
      if (!absPath || !isAbsolute(absPath)) {
        throw new Error('absolute path required')
      }
      // Windows 시스템 경로 보호 (대표적 경로만).
      const lower = absPath.toLowerCase().replace(/\\/g, '/')
      const blocked = [
        'c:/windows',
        'c:/program files',
        'c:/program files (x86)',
        'c:/programdata'
      ]
      if (blocked.some((p) => lower === p || lower.startsWith(p + '/'))) {
        throw new Error('refusing to create folder under a system path')
      }
      await fs.mkdir(absPath, { recursive: true })
    }
  )

  ipcMain.handle(IpcChannel.QuikListFiles, async () => {
    const config = await loadConfig()
    return quikListFiles(config.rootPath, config.excludePatterns)
  })

  ipcMain.handle(
    IpcChannel.QuikSearchContent,
    async (_event, query: string, mode: QuikContentMode) => {
      const config = await loadConfig()
      return quikSearchContent(config.rootPath, config.excludePatterns, query, mode)
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
