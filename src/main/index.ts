import { app, BrowserWindow, dialog, shell } from 'electron'
import { dirname, join } from 'node:path'
import { renameSync, statSync } from 'node:fs'
import { registerIpcHandlers } from './ipc-handlers'
import { closeAllPtys } from './pty-manager'
import { stopWatch } from './file-watcher'

// userData 폴더명을 'ahahahaide'(npm 소문자) → 'AhahahaIDE'(브랜드 케이스)로 통일.
// app.whenReady() **이전**에 호출해야 app.getPath('userData')가 새 이름으로 평가됨.
app.setName('AhahahaIDE')

// 1회성 마이그레이션: 옛 'ahahahaide' 폴더가 있고 새 'AhahahaIDE'가 없으면 rename.
// 9-A까지 사용한 사용자가 마법사를 다시 보지 않도록.
function migrateUserDataFolder(): void {
  const newPath = app.getPath('userData') // .../AhahahaIDE
  const parent = dirname(newPath)
  const oldPath = join(parent, 'ahahahaide')

  // 새 폴더 이미 있으면 마이그레이션 X
  try {
    statSync(newPath)
    return
  } catch {
    /* 새 폴더 없음 — 계속 */
  }

  // 옛 폴더 없으면 신규 사용자 — 마법사로 진행
  try {
    statSync(oldPath)
  } catch {
    return
  }

  // 옛 → 새 rename 시도
  try {
    renameSync(oldPath, newPath)
    console.log(`[main] migrated userData: ${oldPath} → ${newPath}`)
  } catch (err) {
    // 옛 폴더가 잠겨 있거나 권한 문제 — 새 폴더로 시작 (마법사 표시될 수 있음)
    console.warn('[main] failed to migrate userData folder:', err)
  }
}
migrateUserDataFolder()

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
    // 타이틀바 제거. TopBar의 한 줄을 드래그 영역으로 활용 + min/max/close 버튼 추가.
    frame: false,
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

  // 렌더러의 max/restore 토글 아이콘 동기화용
  const sendMaximized = () => {
    if (!win.isDestroyed()) {
      win.webContents.send('window:maximized-changed', win.isMaximized())
    }
  }
  win.on('maximize', sendMaximized)
  win.on('unmaximize', sendMaximized)

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
