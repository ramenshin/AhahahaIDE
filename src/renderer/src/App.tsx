import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels'
import type { AppConfig, LayoutMode, ProjectFolder } from '@shared/types'
import { CLAUDE_SAVE_STATE_PROMPT, ZOOM_STEP, clampZoom } from '@shared/types'
import { TopBar, type SaveStateScope } from './components/TopBar'
import { ProjectTabBar } from './components/ProjectTabBar'
import { ProjectTree } from './components/ProjectTree'
import { StatusBar } from './components/StatusBar'
import { Placeholder } from './components/Placeholder'
import { Terminal } from './components/Terminal'
import { SettingsModal } from './components/SettingsModal'
import { FileExplorer } from './components/FileExplorer'
import { MemoEditor } from './components/MemoEditor'
import { CodeEditor, type EditorFlushHandle } from './components/CodeEditor'
import { NewProjectModal } from './components/NewProjectModal'
import { FirstLaunchModal } from './components/FirstLaunchModal'
import {
  QuikSearchModal,
  type QuikSearchMode,
  type QuikSelection
} from './components/QuikSearchModal'

function fileNameOf(p: string): string {
  return p.split(/[\\/]/).pop() ?? p
}

interface WorkspaceRenderOpts {
  mode: LayoutMode
  layouts: AppConfig['ui']['panels']['layouts'] | undefined
  editorPane: ReactNode
  claudePane: ReactNode
  plainPane: ReactNode
}

function renderWorkspace({
  mode,
  layouts,
  editorPane,
  claudePane,
  plainPane
}: WorkspaceRenderOpts): ReactNode {
  if (mode === 'col3') {
    const s = layouts?.col3
    return (
      <PanelGroup direction="horizontal">
        <Panel defaultSize={s?.editorWidth ?? 40} minSize={15}>
          {editorPane}
        </Panel>
        <PanelResizeHandle className="resize-handle-v" />
        <Panel defaultSize={s?.claudeTerminalWidth ?? 30} minSize={15}>
          {claudePane}
        </Panel>
        <PanelResizeHandle className="resize-handle-v" />
        <Panel defaultSize={s?.plainTerminalWidth ?? 30} minSize={15}>
          {plainPane}
        </Panel>
      </PanelGroup>
    )
  }
  if (mode === 'rowcol') {
    const s = layouts?.rowcol
    return (
      <PanelGroup direction="vertical">
        <Panel defaultSize={s?.editorHeight ?? 40} minSize={15}>
          {editorPane}
        </Panel>
        <PanelResizeHandle className="resize-handle-h" />
        <Panel minSize={15}>
          <PanelGroup direction="horizontal">
            <Panel defaultSize={s?.claudeTerminalWidth ?? 50} minSize={20}>
              {claudePane}
            </Panel>
            <PanelResizeHandle className="resize-handle-v" />
            <Panel minSize={20}>{plainPane}</Panel>
          </PanelGroup>
        </Panel>
      </PanelGroup>
    )
  }
  // row3 (default)
  const s = layouts?.row3
  return (
    <PanelGroup direction="vertical">
      <Panel defaultSize={s?.editorHeight ?? 40} minSize={15}>
        {editorPane}
      </Panel>
      <PanelResizeHandle className="resize-handle-h" />
      <Panel defaultSize={s?.claudeTerminalHeight ?? 30} minSize={10}>
        {claudePane}
      </Panel>
      <PanelResizeHandle className="resize-handle-h" />
      <Panel defaultSize={s?.plainTerminalHeight ?? 30} minSize={10}>
        {plainPane}
      </Panel>
    </PanelGroup>
  )
}

export function App() {
  const [config, setConfig] = useState<AppConfig | null>(null)
  // 부팅 시 한 번만 결정하는 렌더 레이아웃. 런타임에 변하지 않음 — 설정에서 변경하면
  // config.ui.layoutMode만 바뀌고 다음 재시작부터 반영됨.
  const [initialLayoutMode, setInitialLayoutMode] = useState<LayoutMode | null>(null)
  const [folders, setFolders] = useState<ProjectFolder[]>([])
  const [loading, setLoading] = useState(true)
  const [scanError, setScanError] = useState<string | null>(null)
  const [openPaths, setOpenPaths] = useState<string[]>([])
  const [activePath, setActivePath] = useState<string | null>(null)
  const [sessionError, setSessionError] = useState<string | null>(null)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [newProjectOpen, setNewProjectOpen] = useState(false)
  const [quikSearchMode, setQuikSearchMode] = useState<QuikSearchMode | null>(null)
  const [pendingRevealLine, setPendingRevealLine] = useState<number | undefined>(undefined)
  const [memoDirty, setMemoDirty] = useState(false)
  const [openedFile, setOpenedFile] = useState<string | null>(null)
  const [editorDirty, setEditorDirty] = useState(false)
  const [toast, setToast] = useState<{ text: string; kind: 'ok' | 'error' } | null>(null)
  const codeEditorRef = useRef<EditorFlushHandle | null>(null)
  const memoEditorRef = useRef<EditorFlushHandle | null>(null)

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      try {
        const cfg = await window.api.getConfig()
        if (cancelled) return
        setConfig(cfg)
        setInitialLayoutMode(cfg.ui.layoutMode)
        document.body.className = `scheme-${cfg.ui.colorScheme}`
        window.api.setZoom(cfg.ui.zoomFactor)
        // 첫 실행(rootPath 빈 문자열)이면 scanFolders 보류 — 마법사 완료 후 실행
        if (cfg.rootPath) {
          const scan = await window.api.scanFolders()
          if (cancelled) return
          setFolders(scan.folders)
        }
      } catch (err) {
        if (!cancelled) setScanError(String(err))
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [])

  // 첫 실행 마법사 완료 핸들러 — config 저장 + 폴더 스캔 + 정상 진입
  const handleFirstLaunchComplete = useCallback(
    async (chosenRootPath: string) => {
      if (!config) return
      const next: AppConfig = { ...config, rootPath: chosenRootPath }
      try {
        const saved = await window.api.setConfig(next)
        setConfig(saved)
        const scan = await window.api.scanFolders()
        setFolders(scan.folders)
      } catch (err) {
        setScanError(String(err))
      }
    },
    [config]
  )

  const applyZoom = useCallback(
    async (nextFactor: number) => {
      if (!config) return
      const clamped = clampZoom(nextFactor)
      window.api.setZoom(clamped)
      const nextConfig: AppConfig = {
        ...config,
        ui: { ...config.ui, zoomFactor: clamped }
      }
      setConfig(nextConfig)
      await window.api.setConfig(nextConfig)
    },
    [config]
  )

  useEffect(() => {
    if (!config || settingsOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (!e.ctrlKey || e.altKey || e.shiftKey || e.metaKey) return
      if (e.key === '=' || e.key === '+') {
        e.preventDefault()
        applyZoom(config.ui.zoomFactor + ZOOM_STEP)
      } else if (e.key === '-' || e.key === '_') {
        e.preventDefault()
        applyZoom(config.ui.zoomFactor - ZOOM_STEP)
      } else if (e.key === '0') {
        e.preventDefault()
        applyZoom(1.0)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [config, applyZoom, settingsOpen])

  // 토스트 자동 소멸
  useEffect(() => {
    if (!toast) return
    const t = window.setTimeout(
      () => setToast(null),
      toast.kind === 'error' ? 5000 : 2500
    )
    return () => window.clearTimeout(t)
  }, [toast])

  const handleSaveSettings = useCallback(
    async (next: AppConfig) => {
      const prevRootPath = config?.rootPath
      const prevExcludes = config?.excludePatterns
      const saved = await window.api.setConfig(next)
      setConfig(saved)
      document.body.className = `scheme-${saved.ui.colorScheme}`
      window.api.setZoom(saved.ui.zoomFactor)
      const rootChanged = prevRootPath !== saved.rootPath
      const excludesChanged =
        !!prevExcludes &&
        JSON.stringify(prevExcludes) !== JSON.stringify(saved.excludePatterns)
      if (rootChanged || excludesChanged) {
        try {
          const scan = await window.api.scanFolders()
          setFolders(scan.folders)
        } catch (err) {
          setScanError(String(err))
        }
      }
    },
    [config]
  )

  const handleSaveState = useCallback(
    async (scope: SaveStateScope) => {
      const targets =
        scope === 'all' ? openPaths : activePath ? [activePath] : []
      const scopeDesc =
        scope === 'all'
          ? `열린 모든 프로젝트(${openPaths.length}개)`
          : '현재 활성 프로젝트'
      const claudeDesc =
        scope === 'all' ? '열린 모든' : '활성'
      const ok = window.confirm(
        `${scopeDesc}의 상태를 저장합니다:\n\n` +
          '1) 활성 프로젝트의 미저장 파일(에디터·메모) 즉시 저장\n' +
          `2) ${claudeDesc} Claude 터미널에 상태 정리 지시 전송\n\n` +
          '계속하시겠습니까?'
      )
      if (!ok) return
      try {
        await codeEditorRef.current?.flush()
        await memoEditorRef.current?.flush()
        // Claude Code의 Ink TUI는 텍스트와 Enter를 같은 write에 묶어 보내면
        // Enter가 submit으로 처리되지 않는다. 텍스트 먼저 쓰고 짧은 지연 후
        // \r 단독 전송으로 키 입력 이벤트를 분리.
        const delay = (ms: number) => new Promise<void>((r) => setTimeout(r, ms))
        let sent = 0
        for (const path of targets) {
          const delivered = await window.api.pty.writeByFolder(
            path,
            'claude',
            CLAUDE_SAVE_STATE_PROMPT
          )
          if (delivered) {
            await delay(120)
            await window.api.pty.writeByFolder(path, 'claude', '\r')
            sent++
          }
        }
        setToast({
          text:
            targets.length === 0
              ? '파일 저장 완료 (Claude 터미널 없음)'
              : `저장 완료 · Claude ${sent}/${targets.length}개 전송`,
          kind: 'ok'
        })
      } catch (err) {
        setToast({ text: `저장 실패: ${String(err)}`, kind: 'error' })
      }
    },
    [openPaths, activePath]
  )

  const refreshFolders = useCallback(async () => {
    setLoading(true)
    setScanError(null)
    try {
      const scan = await window.api.scanFolders()
      setFolders(scan.folders)
    } catch (err) {
      setScanError(String(err))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    const dispose = window.api.fs.onRootRemoved((removed: string) => {
      setSessionError(`폴더가 삭제되어 세션을 닫습니다: ${removed}`)
      setOpenPaths((prev) => prev.filter((p) => p !== removed))
      setActivePath((curr) => (curr === removed ? null : curr))
      refreshFolders()
    })
    return () => dispose()
  }, [refreshFolders])

  const maxSessions = config?.maxSessions ?? 20

  const openSession = useCallback(
    (path: string) => {
      setSessionError(null)
      setOpenPaths((prev) => {
        if (prev.includes(path)) return prev
        if (prev.length >= maxSessions) {
          setSessionError(
            `최대 세션 ${maxSessions}개에 도달했습니다. 탭을 닫고 다시 시도하세요.`
          )
          return prev
        }
        return [...prev, path]
      })
      setActivePath(path)
    },
    [maxSessions]
  )

  const handleQuikSelect = useCallback(
    (sel: QuikSelection) => {
      setQuikSearchMode(null)
      const target = folders.find((f) => {
        const fp = f.path
        return (
          sel.absPath === fp ||
          sel.absPath.startsWith(fp + '\\') ||
          sel.absPath.startsWith(fp + '/')
        )
      })
      if (!target) {
        setToast({
          text: '선택한 파일이 어떤 프로젝트에도 속하지 않습니다.',
          kind: 'error'
        })
        return
      }
      // 세션 오픈 + 활성 전환 + 파일/라인 설정 (배치)
      setOpenPaths((prev) => {
        if (prev.includes(target.path)) return prev
        if (prev.length >= maxSessions) {
          setSessionError(
            `최대 세션 ${maxSessions}개에 도달했습니다. 탭을 닫고 다시 시도하세요.`
          )
          return prev
        }
        return [...prev, target.path]
      })
      setActivePath(target.path)
      setOpenedFile(sel.absPath)
      setEditorDirty(false)
      setPendingRevealLine(sel.kind === 'content' ? sel.line : undefined)
    },
    [folders, maxSessions]
  )

  // Ctrl+P / Ctrl+Shift+F 글로벌 단축키 (모달 열려 있을 땐 비활성)
  useEffect(() => {
    if (settingsOpen || newProjectOpen || quikSearchMode !== null) return
    const onKey = (e: KeyboardEvent) => {
      if (e.altKey || e.metaKey) return
      const lower = e.key.toLowerCase()
      if (e.ctrlKey && !e.shiftKey && lower === 'p') {
        e.preventDefault()
        setQuikSearchMode('filename')
      } else if (e.ctrlKey && e.shiftKey && lower === 'f') {
        e.preventDefault()
        setQuikSearchMode('doc')
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [settingsOpen, newProjectOpen, quikSearchMode])

  const closeSession = useCallback(
    (path: string) => {
      setOpenPaths((prev) => {
        const next = prev.filter((p) => p !== path)
        setActivePath((curr) => {
          if (curr !== path) return curr
          return next.length > 0 ? next[next.length - 1] : null
        })
        return next
      })
    },
    []
  )

  const activeFolder = folders.find((f) => f.path === activePath) ?? null

  // openedFile이 현재 activeFolder 내부일 때만 유효. 탭 전환 직후 stale 렌더 방지
  // (projectRoot만 먼저 바뀌고 openedFile은 useEffect로 뒤늦게 리셋되는 사이에
  //  CodeEditor가 mismatched props로 file:read/save 를 쏴 "outside project root" 에러를 내던 문제).
  const effectiveOpenedFile = useMemo(() => {
    if (!activeFolder || !openedFile) return null
    return openedFile.startsWith(activeFolder.path) ? openedFile : null
  }, [activeFolder, openedFile])

  useEffect(() => {
    // 프로젝트 전환 시 기본은 openedFile 해제. 단, QuikSearch가 새 프로젝트로
    // 점프하면서 같이 setOpenedFile을 미리 설정한 경우 그 파일이 새 활성 프로젝트
    // 내부면 유지(아니면 cross-project stale로 간주해 정리).
    setOpenedFile((prev) => {
      if (!prev) return prev
      if (!activeFolder) return null
      return prev.startsWith(activeFolder.path) ? prev : null
    })
    setEditorDirty(false)
    setPendingRevealLine(undefined)
  }, [activeFolder?.path])

  const openProjects = useMemo(
    () =>
      openPaths.map((path) => {
        const folder = folders.find((f) => f.path === path)
        return {
          path,
          name: folder?.name ?? path.split(/[\\/]/).pop() ?? path,
          status: 'running' as const
        }
      }),
    [openPaths, folders]
  )

  const editorPane: ReactNode = (
    <div className="panel panel-black">
      <div className="panel-header">
        <span className="title">
          📝 에디터
          {effectiveOpenedFile
            ? ` · ${fileNameOf(effectiveOpenedFile)}${editorDirty ? ' ●' : ''}`
            : ''}
        </span>
      </div>
      {activeFolder && effectiveOpenedFile ? (
        <CodeEditor
          key={effectiveOpenedFile}
          ref={codeEditorRef}
          projectRoot={activeFolder.path}
          filePath={effectiveOpenedFile}
          initialLine={pendingRevealLine}
          onDirtyChange={setEditorDirty}
        />
      ) : (
        <Placeholder
          title="Monaco 코드 에디터"
          description={
            activeFolder
              ? '좌측 파일 탐색기에서 파일을 클릭하세요. Ctrl+S 저장, 미저장 ● 표시.'
              : '프로젝트를 선택하면 파일을 열 수 있습니다.'
          }
        />
      )}
    </div>
  )

  const claudePane: ReactNode = (
    <div className="panel panel-black">
      <div className="panel-header">
        <span className="title">▲ PowerShell + Claude</span>
      </div>
      {openPaths.length === 0 ? (
        <Placeholder
          title="Claude 터미널"
          description="좌측에서 프로젝트 폴더를 클릭하면 PowerShell + Claude가 실행됩니다."
        />
      ) : (
        <div className="terminal-stack">
          {openPaths.map((p) => (
            <div
              key={p}
              className={`terminal-slot${p === activePath ? ' active' : ''}`}
            >
              <Terminal folderPath={p} kind="claude" />
            </div>
          ))}
        </div>
      )}
    </div>
  )

  const plainPane: ReactNode = (
    <div className="panel panel-black">
      <div className="panel-header">
        <span className="title">▼ PowerShell</span>
      </div>
      {openPaths.length === 0 ? (
        <Placeholder
          title="일반 터미널"
          description="프로젝트를 열면 venv 활성화된 PowerShell이 실행됩니다."
        />
      ) : (
        <div className="terminal-stack">
          {openPaths.map((p) => (
            <div
              key={p}
              className={`terminal-slot${p === activePath ? ' active' : ''}`}
            >
              <Terminal folderPath={p} kind="plain" />
            </div>
          ))}
        </div>
      )}
    </div>
  )

  // 첫 실행: 마법사가 끝날 때까지 메인 UI 진입 차단
  if (!loading && config && !config.rootPath) {
    return (
      <div className="app">
        <FirstLaunchModal
          onComplete={handleFirstLaunchComplete}
          onCancel={() => window.close()}
        />
      </div>
    )
  }

  return (
    <div className="app">
      <TopBar
        onOpenSettings={() => setSettingsOpen(true)}
        onSaveState={handleSaveState}
        onCreateProject={() => setNewProjectOpen(true)}
        onOpenQuikSearch={() => setQuikSearchMode('filename')}
        hasOpenProjects={openPaths.length > 0}
        hasActiveProject={activePath !== null}
      />
      <ProjectTabBar
        openProjects={openProjects}
        activePath={activePath}
        onActivate={setActivePath}
        onClose={closeSession}
      />
      <PanelGroup direction="horizontal">
        <Panel
          defaultSize={config?.ui.panels.leftWidth ?? 32}
          minSize={20}
          maxSize={55}
        >
          <PanelGroup direction="vertical">
            <Panel defaultSize={70} minSize={30}>
              <PanelGroup direction="horizontal">
                <Panel
                  defaultSize={config?.ui.panels.folderListWidth ?? 42}
                  minSize={25}
                >
                  <ProjectTree
                    folders={folders}
                    loading={loading}
                    error={scanError}
                    rootPath={config?.rootPath ?? null}
                    selectedPath={activePath}
                    openedPaths={openPaths}
                    onSelect={openSession}
                    onRefresh={refreshFolders}
                  />
                </Panel>
                <PanelResizeHandle className="resize-handle-v" />
                <Panel minSize={25}>
                  <div className="panel">
                    <div className="panel-header">
                      <span className="title">
                        {activeFolder ? `${activeFolder.name} · 파일` : '파일 탐색기'}
                      </span>
                    </div>
                    {activeFolder ? (
                      <FileExplorer
                        rootPath={activeFolder.path}
                        onFileOpen={setOpenedFile}
                        selectedFilePath={effectiveOpenedFile}
                      />
                    ) : (
                      <Placeholder
                        title="파일 탐색기"
                        description="프로젝트를 선택하면 파일 트리가 표시됩니다."
                      />
                    )}
                  </div>
                </Panel>
              </PanelGroup>
            </Panel>
            <PanelResizeHandle className="resize-handle-h" />
            <Panel
              defaultSize={config?.ui.panels.memoHeight ?? 30}
              minSize={15}
            >
              <div className="panel panel-black">
                <div className="panel-header">
                  <span className="title">
                    📝 메모 · user_defined_memo.md{memoDirty ? ' ●' : ''}
                  </span>
                </div>
                {activeFolder ? (
                  <MemoEditor
                    key={activeFolder.path}
                    ref={memoEditorRef}
                    projectPath={activeFolder.path}
                    onDirtyChange={setMemoDirty}
                  />
                ) : (
                  <Placeholder
                    title="프로젝트 메모"
                    description="프로젝트를 선택하면 user_defined_memo.md 파일이 열립니다."
                  />
                )}
              </div>
            </Panel>
          </PanelGroup>
        </Panel>

        <PanelResizeHandle className="resize-handle-v" />

        <Panel minSize={35}>
          {renderWorkspace({
            mode: initialLayoutMode ?? 'row3',
            layouts: config?.ui.panels.layouts,
            editorPane,
            claudePane,
            plainPane
          })}
        </Panel>
      </PanelGroup>
      {sessionError && (
        <div className="session-error" onClick={() => setSessionError(null)}>
          {sessionError} <span className="dismiss">×</span>
        </div>
      )}
      {toast && (
        <div className={`toast${toast.kind === 'error' ? ' error' : ''}`}>
          {toast.text}
        </div>
      )}
      <StatusBar
        folderCount={folders.length}
        maxSessions={maxSessions}
        rootPath={config?.rootPath ?? ''}
        activeFolderName={activeFolder?.name ?? null}
      />
      {quikSearchMode !== null && (
        <QuikSearchModal
          initialMode={quikSearchMode}
          onClose={() => setQuikSearchMode(null)}
          onSelect={handleQuikSelect}
        />
      )}
      {newProjectOpen && config && (
        <NewProjectModal
          rootPath={config.rootPath}
          onClose={() => setNewProjectOpen(false)}
          onCreated={async (createdPath) => {
            setNewProjectOpen(false)
            await refreshFolders()
            setToast({
              text: `새 프로젝트 생성: ${createdPath.split(/[\\/]/).pop()}`,
              kind: 'ok'
            })
          }}
        />
      )}
      {settingsOpen && config && (
        <SettingsModal
          config={config}
          initialLayoutMode={initialLayoutMode}
          onClose={() => setSettingsOpen(false)}
          onSave={handleSaveSettings}
        />
      )}
    </div>
  )
}
