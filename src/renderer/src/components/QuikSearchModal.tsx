import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type {
  QuikContentMatch,
  QuikContentMode,
  QuikFileEntry
} from '@shared/types'
import { QUIK_MAX_RESULTS } from '@shared/types'
import { fuzzyMatch } from '../lib/fuzzy'

export type QuikSearchMode = 'filename' | QuikContentMode

export interface QuikFileSelection {
  kind: 'filename'
  absPath: string
}

export interface QuikContentSelection {
  kind: 'content'
  absPath: string
  line: number
}

export type QuikSelection = QuikFileSelection | QuikContentSelection

interface Props {
  initialMode?: QuikSearchMode
  onClose: () => void
  onSelect: (sel: QuikSelection) => void
}

interface FileNameRow {
  entry: QuikFileEntry
  basename: string
  score: number
  matches: number[] // 인덱스는 basename 기준
}

const MODE_META: { id: QuikSearchMode; label: string; hint: string }[] = [
  { id: 'filename', label: '📁 파일명', hint: '퍼지 매칭 · usl → UserStateLoader.tsx' },
  { id: 'doc', label: '📄 문서 내용', hint: '.txt .md .markdown .pdf · 대소문자 무시' },
  { id: 'code', label: '💻 코드 내용', hint: 'ts/tsx/js/py/go/rs/... · 대소문자 무시' }
]

function basenameOf(p: string): string {
  const slash = p.lastIndexOf('/')
  return slash === -1 ? p : p.slice(slash + 1)
}

function dirnameOf(p: string): string {
  const slash = p.lastIndexOf('/')
  return slash === -1 ? '' : p.slice(0, slash)
}

function HighlightedText({
  text,
  matches,
  className
}: {
  text: string
  matches: number[]
  className?: string
}) {
  if (matches.length === 0) return <span className={className}>{text}</span>
  const parts: React.ReactNode[] = []
  let cursor = 0
  const m = new Set(matches)
  for (let i = 0; i < text.length; i++) {
    if (m.has(i)) {
      parts.push(<span key={i} className="quik-hl">{text[i]}</span>)
    } else {
      parts.push(text[i])
    }
  }
  void cursor
  return <span className={className}>{parts}</span>
}

export function QuikSearchModal({
  initialMode = 'filename',
  onClose,
  onSelect
}: Props) {
  const [mode, setMode] = useState<QuikSearchMode>(initialMode)
  const [query, setQuery] = useState('')
  const [allFiles, setAllFiles] = useState<QuikFileEntry[] | null>(null)
  const [contentResults, setContentResults] = useState<QuikContentMatch[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selectedIdx, setSelectedIdx] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const searchTokenRef = useRef(0)

  // 모달 열릴 때 파일 리스트 가져오기 (모드 1 전용, 모드 2/3은 필요 없음)
  useEffect(() => {
    inputRef.current?.focus()
    let cancelled = false
    setLoading(true)
    setError(null)
    window.api.quik
      .listFiles()
      .then((entries) => {
        if (cancelled) return
        setAllFiles(entries)
      })
      .catch((err) => {
        if (!cancelled) setError(String(err))
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  // 모드 2/3: 쿼리 변경 시 debounce 후 내용 검색
  useEffect(() => {
    if (mode === 'filename') return
    if (!query.trim()) {
      setContentResults([])
      setLoading(false)
      return
    }
    const token = ++searchTokenRef.current
    setLoading(true)
    setError(null)
    const timer = window.setTimeout(() => {
      window.api.quik
        .searchContent(query, mode)
        .then((results) => {
          if (searchTokenRef.current === token) {
            setContentResults(results)
            setSelectedIdx(0)
          }
        })
        .catch((err) => {
          if (searchTokenRef.current === token) setError(String(err))
        })
        .finally(() => {
          if (searchTokenRef.current === token) setLoading(false)
        })
    }, 400)
    return () => {
      window.clearTimeout(timer)
    }
  }, [query, mode])

  // 모드 1: 파일명 퍼지 매칭 (클라이언트 사이드, 매 입력마다 즉시)
  const fileNameRows: FileNameRow[] = useMemo(() => {
    if (mode !== 'filename' || !allFiles) return []
    if (!query.trim()) {
      // 쿼리 비었을 때 처음 100개만 표시 (너무 긴 리스트 방지)
      return allFiles.slice(0, QUIK_MAX_RESULTS).map((entry) => ({
        entry,
        basename: basenameOf(entry.relPath),
        score: 0,
        matches: []
      }))
    }
    const rows: FileNameRow[] = []
    for (const entry of allFiles) {
      const basename = basenameOf(entry.relPath)
      const result = fuzzyMatch(query, basename)
      if (!result) continue
      rows.push({ entry, basename, score: result.score, matches: result.matches })
    }
    rows.sort((a, b) => b.score - a.score)
    return rows.slice(0, QUIK_MAX_RESULTS)
  }, [mode, allFiles, query])

  // 쿼리/모드 바뀌면 선택 초기화
  useEffect(() => {
    setSelectedIdx(0)
  }, [query, mode])

  const resultCount =
    mode === 'filename' ? fileNameRows.length : contentResults.length

  const handleConfirm = useCallback(() => {
    if (mode === 'filename') {
      const row = fileNameRows[selectedIdx]
      if (!row) return
      onSelect({ kind: 'filename', absPath: row.entry.absPath })
    } else {
      const m = contentResults[selectedIdx]
      if (!m) return
      onSelect({ kind: 'content', absPath: m.absPath, line: m.line })
    }
  }, [mode, fileNameRows, contentResults, selectedIdx, onSelect])

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault()
      onClose()
    } else if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSelectedIdx((i) => Math.min(resultCount - 1, i + 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSelectedIdx((i) => Math.max(0, i - 1))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      handleConfirm()
    } else if (e.key === 'Tab') {
      e.preventDefault()
      const idx = MODE_META.findIndex((m) => m.id === mode)
      const next = MODE_META[(idx + (e.shiftKey ? -1 : 1) + MODE_META.length) % MODE_META.length]
      setMode(next.id)
    }
  }

  // 선택된 행 자동 스크롤
  useEffect(() => {
    const el = listRef.current?.querySelector<HTMLElement>(
      `.quik-row[data-idx="${selectedIdx}"]`
    )
    el?.scrollIntoView({ block: 'nearest' })
  }, [selectedIdx, resultCount])

  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <div
        className="modal quik-modal"
        onMouseDown={(e) => e.stopPropagation()}
        onKeyDown={handleKey}
      >
        <div className="quik-tabs">
          {MODE_META.map((m) => (
            <button
              key={m.id}
              type="button"
              className={`quik-tab${mode === m.id ? ' selected' : ''}`}
              onClick={() => setMode(m.id)}
              title={m.hint}
            >
              {m.label}
            </button>
          ))}
          <span className="spacer" />
          <button
            className="icon-btn"
            type="button"
            onClick={onClose}
            title="닫기 (Esc)"
          >
            ×
          </button>
        </div>
        <div className="quik-input-wrap">
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={
              mode === 'filename'
                ? '파일명 퍼지 검색 (usl, handle.ts ...)'
                : mode === 'doc'
                  ? '문서(txt/md/pdf)에서 검색할 문구'
                  : '코드 파일에서 검색할 문구'
            }
            className="quik-input"
            spellCheck={false}
            autoComplete="off"
          />
          <div className="quik-input-meta">
            {loading && <span>검색 중…</span>}
            {!loading && <span>{resultCount}건 · ↑↓ 이동 · Enter 선택 · Tab 모드</span>}
          </div>
        </div>
        {error && <div className="quik-error">⚠ {error}</div>}
        <div className="quik-results" ref={listRef}>
          {mode === 'filename'
            ? fileNameRows.map((row, i) => (
                <div
                  key={row.entry.absPath}
                  data-idx={i}
                  className={`quik-row${i === selectedIdx ? ' selected' : ''}`}
                  onMouseDown={(e) => {
                    e.preventDefault()
                    setSelectedIdx(i)
                    onSelect({ kind: 'filename', absPath: row.entry.absPath })
                  }}
                >
                  <div className="quik-row-main">
                    <HighlightedText
                      text={row.basename}
                      matches={row.matches}
                      className="quik-row-name"
                    />
                  </div>
                  <div className="quik-row-sub">{dirnameOf(row.entry.relPath)}</div>
                </div>
              ))
            : contentResults.map((m, i) => (
                <div
                  key={`${m.absPath}:${m.line}`}
                  data-idx={i}
                  className={`quik-row${i === selectedIdx ? ' selected' : ''}`}
                  onMouseDown={(e) => {
                    e.preventDefault()
                    setSelectedIdx(i)
                    onSelect({ kind: 'content', absPath: m.absPath, line: m.line })
                  }}
                >
                  <div className="quik-row-main">
                    <span className="quik-row-name">{basenameOf(m.relPath)}</span>
                    <span className="quik-row-line">:{m.line}</span>
                  </div>
                  <div className="quik-row-snippet">{m.snippet}</div>
                  <div className="quik-row-sub">{dirnameOf(m.relPath)}</div>
                </div>
              ))}
          {!loading && resultCount === 0 && query.trim() && (
            <div className="quik-empty">결과 없음</div>
          )}
        </div>
      </div>
    </div>
  )
}
