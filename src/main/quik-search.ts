import { promises as fs } from 'node:fs'
import { extname, join, relative } from 'node:path'
import {
  QUIK_MAX_FILE_BYTES,
  QUIK_MAX_RESULTS,
  type QuikContentMatch,
  type QuikContentMode,
  type QuikFileEntry
} from '@shared/types'

const BINARY_PROBE_BYTES = 8192

const DOC_EXTENSIONS = new Set(['.txt', '.md', '.markdown', '.pdf'])

const CODE_EXTENSIONS = new Set([
  '.ts',
  '.tsx',
  '.js',
  '.jsx',
  '.mjs',
  '.cjs',
  '.py',
  '.go',
  '.rs',
  '.java',
  '.c',
  '.h',
  '.cpp',
  '.hpp',
  '.cs',
  '.rb',
  '.php',
  '.sh',
  '.ps1',
  '.bat',
  '.cmd',
  '.html',
  '.htm',
  '.css',
  '.scss',
  '.less',
  '.sql',
  '.xml',
  '.vue',
  '.svelte',
  '.json',
  '.yaml',
  '.yml',
  '.toml',
  '.ini'
])

function matchesExcluded(name: string, excludePatterns: string[]): boolean {
  const lower = name.toLowerCase()
  return excludePatterns.some((p) => p.toLowerCase() === lower)
}

// 루트 하위 모든 파일을 재귀 순회. 디렉토리명이 excludePatterns에 걸리면 통째로 건너뜀.
async function* walkFiles(
  rootPath: string,
  excludePatterns: string[]
): AsyncGenerator<QuikFileEntry> {
  const stack: string[] = [rootPath]
  while (stack.length > 0) {
    const dir = stack.pop() as string
    let entries
    try {
      entries = await fs.readdir(dir, { withFileTypes: true })
    } catch {
      continue
    }
    for (const e of entries) {
      const full = join(dir, e.name)
      if (e.isDirectory()) {
        if (matchesExcluded(e.name, excludePatterns)) continue
        stack.push(full)
      } else if (e.isFile()) {
        yield {
          absPath: full,
          relPath: relative(rootPath, full).replace(/\\/g, '/')
        }
      }
    }
  }
}

export async function listFiles(
  rootPath: string,
  excludePatterns: string[]
): Promise<QuikFileEntry[]> {
  const out: QuikFileEntry[] = []
  for await (const f of walkFiles(rootPath, excludePatterns)) {
    out.push(f)
  }
  return out
}

function looksBinary(buf: Buffer): boolean {
  const n = Math.min(buf.length, BINARY_PROBE_BYTES)
  for (let i = 0; i < n; i++) if (buf[i] === 0) return true
  return false
}

// 한 파일에서 query 최초 매칭 줄 1개만 반환 (각 파일 1줄 정책).
function findFirstLine(
  text: string,
  query: string,
  relPath: string,
  absPath: string
): QuikContentMatch | null {
  const queryLower = query.toLowerCase()
  const lines = text.split(/\r?\n/)
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const idx = line.toLowerCase().indexOf(queryLower)
    if (idx !== -1) {
      let snippet = line
      if (snippet.length > 200) {
        const start = Math.max(0, idx - 40)
        const end = Math.min(line.length, start + 200)
        snippet =
          (start > 0 ? '…' : '') +
          line.slice(start, end) +
          (end < line.length ? '…' : '')
      }
      return { relPath, absPath, line: i + 1, snippet }
    }
  }
  return null
}

async function extractPdfText(absPath: string): Promise<string> {
  try {
    // pdf-parse는 CJS. require를 쓰지 않도록 동적 import.
    const mod = (await import('pdf-parse')) as unknown as {
      default: (data: Buffer) => Promise<{ text: string }>
    }
    const buf = await fs.readFile(absPath)
    const result = await mod.default(buf)
    return result.text ?? ''
  } catch {
    return ''
  }
}

export async function searchContent(
  rootPath: string,
  excludePatterns: string[],
  query: string,
  mode: QuikContentMode
): Promise<QuikContentMatch[]> {
  if (!query.trim()) return []
  const extSet = mode === 'doc' ? DOC_EXTENSIONS : CODE_EXTENSIONS
  const out: QuikContentMatch[] = []

  for await (const f of walkFiles(rootPath, excludePatterns)) {
    if (out.length >= QUIK_MAX_RESULTS) break
    const ext = extname(f.absPath).toLowerCase()
    if (!extSet.has(ext)) continue

    try {
      const stat = await fs.stat(f.absPath)
      if (stat.size > QUIK_MAX_FILE_BYTES) continue

      if (ext === '.pdf') {
        const text = await extractPdfText(f.absPath)
        if (!text) continue
        const match = findFirstLine(text, query, f.relPath, f.absPath)
        if (match) out.push(match)
      } else {
        const buf = await fs.readFile(f.absPath)
        if (looksBinary(buf)) continue
        const text = buf.toString('utf8')
        const match = findFirstLine(text, query, f.relPath, f.absPath)
        if (match) out.push(match)
      }
    } catch {
      // 권한 오류 등은 조용히 스킵
    }
  }
  return out
}
