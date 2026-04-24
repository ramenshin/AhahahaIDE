import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react'
import Editor, { type OnMount } from '@monaco-editor/react'
import '../monaco-setup'
import type { EditorFlushHandle } from './CodeEditor'

interface Props {
  projectPath: string
  onDirtyChange: (dirty: boolean) => void
}

const AUTOSAVE_MS = 1500

export const MemoEditor = forwardRef<EditorFlushHandle, Props>(function MemoEditor(
  { projectPath, onDirtyChange },
  ref
) {
  const [content, setContent] = useState<string>('')
  const [loaded, setLoaded] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const savedContentRef = useRef<string>('')
  const saveTimerRef = useRef<number | null>(null)
  const inflightSaveRef = useRef<Promise<void> | null>(null)

  const markSaved = useCallback(
    (value: string) => {
      savedContentRef.current = value
      onDirtyChange(false)
    },
    [onDirtyChange]
  )

  // 프로젝트 전환 시 로드
  useEffect(() => {
    let cancelled = false
    setLoaded(false)
    setError(null)
    window.api.memo
      .load(projectPath)
      .then((text) => {
        if (cancelled) return
        const initial = text ?? ''
        setContent(initial)
        markSaved(initial)
        setLoaded(true)
      })
      .catch((err) => {
        if (!cancelled) {
          setError(String(err))
          setLoaded(true)
        }
      })
    return () => {
      cancelled = true
    }
  }, [projectPath, markSaved])

  const flushSave = useCallback(async () => {
    if (saveTimerRef.current !== null) {
      window.clearTimeout(saveTimerRef.current)
      saveTimerRef.current = null
    }
    const snapshot = content
    if (snapshot === savedContentRef.current) return
    const prev = inflightSaveRef.current
    if (prev) await prev
    const p = window.api.memo.save(projectPath, snapshot).then(() => {
      markSaved(snapshot)
    })
    inflightSaveRef.current = p
    try {
      await p
    } finally {
      if (inflightSaveRef.current === p) inflightSaveRef.current = null
    }
  }, [content, projectPath, markSaved])

  // 컨텐츠 변경 시 debounce 자동 저장 예약
  useEffect(() => {
    if (!loaded) return
    if (content === savedContentRef.current) return
    onDirtyChange(true)
    if (saveTimerRef.current !== null) {
      window.clearTimeout(saveTimerRef.current)
    }
    saveTimerRef.current = window.setTimeout(() => {
      saveTimerRef.current = null
      flushSave().catch((err) => setError(String(err)))
    }, AUTOSAVE_MS)
    return () => {
      if (saveTimerRef.current !== null) {
        window.clearTimeout(saveTimerRef.current)
        saveTimerRef.current = null
      }
    }
  }, [content, loaded, flushSave, onDirtyChange])

  // 언마운트 시에만 대기중인 내용을 즉시 저장. (flushSave를 deps에 넣으면
  // content 변경마다 cleanup이 재실행돼 debounce가 무력화되므로 ref 사용.)
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

  const handleMount: OnMount = (editor, monaco) => {
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => {
      flushSave().catch((err) => setError(String(err)))
    })
  }

  if (error) {
    return <div className="memo-error">메모 오류: {error}</div>
  }

  return (
    <div className="memo-editor-host">
      <Editor
        height="100%"
        defaultLanguage="markdown"
        language="markdown"
        theme="vs-dark"
        value={content}
        onChange={(v) => setContent(v ?? '')}
        onMount={handleMount}
        options={{
          fontSize: 13,
          wordWrap: 'on',
          minimap: { enabled: false },
          lineNumbers: 'off',
          folding: false,
          renderLineHighlight: 'none',
          scrollBeyondLastLine: false,
          automaticLayout: true,
          padding: { top: 6, bottom: 6 },
          tabSize: 2
        }}
      />
    </div>
  )
})
