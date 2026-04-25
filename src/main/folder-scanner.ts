import { promises as fs } from 'node:fs'
import { join } from 'node:path'
import type { FolderScanResult, ProjectFolder } from '@shared/types'

export async function scanProjectFolders(
  rootPath: string,
  excludePatterns: string[]
): Promise<FolderScanResult> {
  const excludeSet = new Set(excludePatterns.map((p) => p.toLowerCase()))
  const folders: ProjectFolder[] = []

  let entries: import('node:fs').Dirent[]
  try {
    entries = await fs.readdir(rootPath, { withFileTypes: true })
  } catch (err) {
    console.error('[folder-scanner] failed to read root', rootPath, err)
    return { rootPath, folders: [], scannedAt: Date.now() }
  }

  for (const entry of entries) {
    if (!entry.isDirectory()) continue
    if (entry.name.startsWith('.')) continue
    if (excludeSet.has(entry.name.toLowerCase())) continue

    const folderPath = join(rootPath, entry.name)
    try {
      const [stat, children] = await Promise.all([
        fs.stat(folderPath),
        fs.readdir(folderPath).catch(() => [] as string[])
      ])
      const childSet = new Set(children)
      folders.push({
        name: entry.name,
        path: folderPath,
        hasVenv: childSet.has('venv') || childSet.has('.venv'),
        hasGit: childSet.has('.git'),
        hasAhahahaConfig: childSet.has('.ahahaha.json'),
        modifiedAt: stat.mtimeMs
      })
    } catch (err) {
      console.warn('[folder-scanner] skipped', folderPath, err)
    }
  }

  folders.sort((a, b) => a.name.localeCompare(b.name, 'ko'))
  return { rootPath, folders, scannedAt: Date.now() }
}
