import { promises as fs } from 'node:fs'
import { isAbsolute, normalize, relative } from 'node:path'

const MAX_TEXT_FILE_BYTES = 5 * 1024 * 1024 // 5MB — 그 이상은 Monaco에서 느려짐
const BINARY_PROBE_BYTES = 8192

function assertInsideRoot(projectRoot: string, filePath: string): void {
  if (!isAbsolute(projectRoot) || !isAbsolute(filePath)) {
    throw new Error('absolute paths required')
  }
  const rel = relative(normalize(projectRoot), normalize(filePath))
  if (rel.startsWith('..') || isAbsolute(rel)) {
    throw new Error('file is outside project root')
  }
}

// NUL 바이트가 있으면 바이너리로 간주. UTF-8 BOM, 한글 등은 NUL 없음.
function looksBinary(buf: Buffer): boolean {
  const len = Math.min(buf.length, BINARY_PROBE_BYTES)
  for (let i = 0; i < len; i++) {
    if (buf[i] === 0) return true
  }
  return false
}

export interface ReadTextFileResult {
  content: string
  sizeBytes: number
}

export async function readTextFile(
  projectRoot: string,
  filePath: string
): Promise<ReadTextFileResult> {
  assertInsideRoot(projectRoot, filePath)
  const stat = await fs.stat(filePath)
  if (!stat.isFile()) throw new Error('not a regular file')
  if (stat.size > MAX_TEXT_FILE_BYTES) {
    throw new Error(
      `file too large (${stat.size} bytes, limit ${MAX_TEXT_FILE_BYTES})`
    )
  }
  const buf = await fs.readFile(filePath)
  if (looksBinary(buf)) throw new Error('binary file not supported')
  return { content: buf.toString('utf8'), sizeBytes: stat.size }
}

export async function writeTextFile(
  projectRoot: string,
  filePath: string,
  content: string
): Promise<void> {
  assertInsideRoot(projectRoot, filePath)
  await fs.writeFile(filePath, content, 'utf8')
}
