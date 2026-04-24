import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react'
import Editor, { type OnMount } from '@monaco-editor/react'
import '../monaco-setup'

export interface EditorFlushHandle {
  flush: () => Promise<void>
}

interface Props {
  projectRoot: string
  filePath: string
  onDirtyChange: (dirty: boolean) => void
}

const EXT_TO_LANG: Record<string, string> = {
  ts: 'typescript',
  tsx: 'typescript',
  js: 'javascript',
  jsx: 'javascript',
  mjs: 'javascript',
  cjs: 'javascript',
  json: 'json',
  md: 'markdown',
  markdown: 'markdown',
  py: 'python',
  yml: 'yaml',
  yaml: 'yaml',
  css: 'css',
  scss: 'scss',
  less: 'less',
  html: 'html',
  htm: 'html',
  xml: 'xml',
  sh: 'shell',
  bash: 'shell',
  ps1: 'powershell',
  toml: 'ini',
  ini: 'ini',
  sql: 'sql',
  go: 'go',
  rs: 'rust',
  java: 'java',
  c: 'c',
  h: 'c',
  cpp: 'cpp',
  hpp: 'cpp'
}

function detectLanguage(filePath: string): string {
  const m = filePath.toLowerCase().match(/\.([a-z0-9]+)$/)
  if (!m) return 'plaintext'
  return EXT_TO_LANG[m[1]] ?? 'plaintext'
}

function fileNameOf(p: string): string {
  return p.split(/[\\/]/).pop() ?? p
}

export const CodeEditor = forwardRef<EditorFlushHandle, Props>(function CodeEditor(
  { projectRoot, filePath, onDirtyChange },
  ref
) {
  const [content, setContent] = useState<string>('')
  const [loaded, setLoaded] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const savedContentRef = useRef<string>('')
  const inflightSaveRef = useRef<Promise<void> | null>(null)

  const markSaved = useCallback(
    (value: string) => {
      savedContentRef.current = value
      onDirtyChange(false)
    },
    [onDirtyChange]
  )

  useEffect(() => {
    let cancelled = false
    setLoaded(false)
    setError(null)
    window.api.file
      .read(projectRoot, filePath)
      .then(({ content: text }) => {
        if (cancelled) return
        setContent(text)
        markSaved(text)
        setLoaded(true)
      })
      .catch((err) => {
        if (!cancelled) {
          setError(String(err?.message ?? err))
          setLoaded(true)
        }
      })
    return () => {
      cancelled = true
    }
  }, [projectRoot, filePath, markSaved])

  const flushSave = useCallback(async () => {
    const snapshot = content
    if (snapshot === savedContentRef.current) return
    const prev = inflightSaveRef.current
    if (prev) await prev
    const p = window.api.file
      .save(projectRoot, filePath, snapshot)
      .then(() => markSaved(snapshot))
    inflightSaveRef.current = p
    try {
      await p
    } finally {
      if (inflightSaveRef.current === p) inflightSaveRef.current = null
    }
  }, [content, projectRoot, filePath, markSaved])

  // 파일 변경 시 또는 언마운트 시 미저장 내용을 flush.
  // ref 패턴은 MemoEditor와 동일 이유(deps에 flushSave 넣으면 content 변경마다 cleanup).
  const flushSaveRef = useRef(flushSave)
  flushSaveRef.current = flushSave
  useEffect(() => {
    return () => {
      flushSaveRef.current().catch(() => {})
    }
  }, [])

  // 외부에서 호출 가능한 flush. App의 "상태저장" 버튼이 사용.
  useImperativeHandle(
    ref,
    () => ({
      flush: () => flushSaveRef.current()
    }),
    []
  )

  useEffect(() => {
    if (!loaded) return
    const dirty = content !== savedContentRef.current
    onDirtyChange(dirty)
  }, [content, loaded, onDirtyChange])

  const handleMount: OnMount = (editor, monaco) => {
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => {
      flushSave().catch((err) => setError(String(err?.message ?? err)))
    })
  }

  if (error) {
    return (
      <div className="code-editor-error">
        파일 열기 오류: {error}
        <div className="code-editor-error-path">{filePath}</div>
      </div>
    )
  }
  if (!loaded) {
    return <div className="code-editor-loading">불러오는 중… {fileNameOf(filePath)}</div>
  }

  return (
    <div className="code-editor-host">
      <Editor
        height="100%"
        language={detectLanguage(filePath)}
        theme="vs-dark"
        value={content}
        onChange={(v) => setContent(v ?? '')}
        onMount={handleMount}
        options={{
          fontSize: 13,
          wordWrap: 'on',
          minimap: { enabled: false },
          scrollBeyondLastLine: false,
          automaticLayout: true,
          tabSize: 2,
          padding: { top: 6, bottom: 6 }
        }}
      />
    </div>
  )
})
