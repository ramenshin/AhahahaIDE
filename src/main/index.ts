import { app, BrowserWindow, dialog, shell } from 'electron'
import { join } from 'node:path'
import { registerIpcHandlers } from './ipc-handlers'
import { closeAllPtys } from './pty-manager'
import { stopWatch } from './file-watcher'

const isDev = !app.isPackaged

// 최종 안전망: 처리되지 않은 예외로 메인 프로세스가 죽는 것을 막는다.
// 주요 케이스: chokidar의 'error' 이벤트가 리스너 전에 emit되거나, IPC 핸들러 내부 실수.
process.on('uncaughtException', (err) => {
  console.error('[main] uncaughtException:', err)
})
process.on('unhandledRejection', (reason) => {
  console.error('[main] unhandledRejection:', reason)
})

function createMainWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 1600,
    height: 980,
    minWidth: 1100,
    minHeight: 700,
    backgroundColor: '#1a1f24',
    show: false,
    autoHideMenuBar: true,
    title: 'AhahahaIDE',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  win.once('ready-to-show', () => {
    win.show()
  })

  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })

  const rendererUrl = process.env['ELECTRON_RENDERER_URL']
  if (isDev && rendererUrl) {
    win.loadURL(rendererUrl)
    win.webContents.openDevTools({ mode: 'detach' })
  } else {
    win.loadFile(join(__dirname, '../renderer/index.html'))
  }

  return win
}

app.whenReady().then(() => {
  // Windows-only 정책. 다른 OS에서는 명시적으로 막음 — README와 일관.
  if (process.platform !== 'win32') {
    dialog.showErrorBox(
      'Unsupported Platform',
      'AhahahaIDE currently supports Windows 10/11 only.\n' +
        'macOS and Linux support is not yet available.\n\n' +
        'Track or contribute: https://github.com/ramenshin/AhahahaIDE'
    )
    app.quit()
    return
  }

  registerIpcHandlers()
  createMainWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow()
    }
  })
})

app.on('window-all-closed', () => {
  closeAllPtys()
  stopWatch()
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('before-quit', () => {
  closeAllPtys()
  stopWatch()
})
