import chokidar, { type FSWatcher } from 'chokidar'
import { basename } from 'node:path'
import type {
  FileNode,
  FileTreeSnapshot,
  FsChangeEvent,
  FsChangeType
} from '@shared/types'

let currentWatcher: FSWatcher | null = null
let currentRoot: string | null = null

function buildIgnoreFn(excludePatterns: string[]): (p: string) => boolean {
  const set = new Set(excludePatterns.map((p) => p.toLowerCase()))
  return (p: string) => set.has(basename(p).toLowerCase())
}

export async function startWatch(
  rootPath: string,
  excludePatterns: string[],
  onChange: (ev: FsChangeEvent) => void,
  onRootRemoved: () => void
): Promise<FileTreeSnapshot> {
  await stopWatch()

  const ignored = buildIgnoreFn(excludePatterns)
  const collected: FileNode[] = []

  const watcher = chokidar.watch(rootPath, {
    ignored,
    persistent: true,
    ignoreInitial: false,
    awaitWriteFinish: false,
    alwaysStat: false,
    followSymlinks: false
  })

  currentWatcher = watcher
  currentRoot = rootPath

  return new Promise<FileTreeSnapshot>((resolve, reject) => {
    let ready = false

    const pushNode = (p: string, isDir: boolean) => {
      if (p === rootPath) return
      collected.push({
        name: basename(p),
        path: p,
        isDirectory: isDir
      })
    }

    const emitChange = (type: FsChangeType, p: string, isDir: boolean) => {
      if (p === rootPath) return
      try {
        onChange({ rootPath, type, path: p, isDirectory: isDir })
      } catch (err) {
        console.warn('[file-watcher] onChange threw', err)
      }
    }

    watcher.on('add', (p) => {
      if (!ready) pushNode(p, false)
      else emitChange('add', p, false)
    })
    watcher.on('addDir', (p) => {
      if (!ready) pushNode(p, true)
      else emitChange('addDir', p, true)
    })
    watcher.on('unlink', (p) => emitChange('unlink', p, false))
    watcher.on('unlinkDir', (p) => {
      if (p === rootPath) {
        // 감시 중인 루트 폴더가 사라짐: 조용히 정리 + 렌더러에 통지
        console.warn('[file-watcher] root removed:', rootPath)
        stopWatch().catch(() => {})
        try {
          onRootRemoved()
        } catch (err) {
          console.warn('[file-watcher] onRootRemoved threw', err)
        }
        return
      }
      emitChange('unlinkDir', p, true)
    })
    watcher.on('change', (p) => emitChange('change', p, false))

    watcher.once('ready', () => {
      ready = true
      resolve({ rootPath, nodes: collected })
    })

    // 'error'는 persistent하게 처리: 리스너 없이 'error'가 emit되면 프로세스 crash.
    watcher.on('error', (err) => {
      console.error('[file-watcher] error', err)
      if (!ready) {
        reject(err)
        return
      }
      // ready 이후 에러(대표 사례: 감시 루트 handle 무효화)는 watcher 정리 + 루트 제거 통지.
      stopWatch().catch(() => {})
      try {
        onRootRemoved()
      } catch (e) {
        console.warn('[file-watcher] onRootRemoved threw', e)
      }
    })
  })
}

export async function stopWatch(): Promise<void> {
  const w = currentWatcher
  if (!w) return
  // 즉시 참조를 비워 race 방지: 뒤늦게 들어오는 stopWatch는 이미 시작된
  // 새 watcher를 건드리지 않는다.
  currentWatcher = null
  currentRoot = null
  try {
    await w.close()
  } catch (err) {
    console.warn('[file-watcher] close failed', err)
  }
}

export function getCurrentRoot(): string | null {
  return currentRoot
}
