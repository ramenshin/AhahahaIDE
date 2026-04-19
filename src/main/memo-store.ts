import { promises as fs } from 'node:fs'
import { isAbsolute, join } from 'node:path'

const MEMO_FILENAME = 'user_defined_memo.md'

function resolveMemoPath(projectPath: string): string {
  if (!isAbsolute(projectPath)) {
    throw new Error('projectPath must be absolute')
  }
  return join(projectPath, MEMO_FILENAME)
}

export async function loadMemo(projectPath: string): Promise<string | null> {
  const p = resolveMemoPath(projectPath)
  try {
    return await fs.readFile(p, 'utf8')
  } catch (err: unknown) {
    if ((err as NodeJS.ErrnoException)?.code === 'ENOENT') return null
    throw err
  }
}

export async function saveMemo(
  projectPath: string,
  content: string
): Promise<void> {
  const p = resolveMemoPath(projectPath)
  await fs.writeFile(p, content, 'utf8')
}
