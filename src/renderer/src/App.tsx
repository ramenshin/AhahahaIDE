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
        const [cfg, scan] = await Promise.all([
          window.api.getConfig(),
          window.api.scanFolders()
        ])
        if (cancelled) return
        setConfig(cfg)
        setInitialLayoutMode(cfg.ui.layoutMode)
        document.body.className = `scheme-${cfg.ui.colorScheme}`
        window.api.setZoom(cfg.ui.zoomFactor)
        setFolders(scan.folders)
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
        const msg = CLAUDE_SAVE_STATE_PROMPT + '\r'
        let sent = 0
        for (const path of targets) {
          const delivered = await window.api.pty.writeByFolder(
            path,
            'claude',
            msg
          )
          if (delivered) sent++
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
    setOpenedFile(null)
    setEditorDirty(false)
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
          onDirtyChange={setEditorDirty}
        />
      ) : (
        <Placeholder
          phase="Phase 7"
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
          phase="Phase 2"
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
          phase="Phase 2"
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

  return (
    <div className="app">
      <TopBar
        onOpenSettings={() => setSettingsOpen(true)}
        onSaveState={handleSaveState}
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
                        phase="Phase 3"
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
                    phase="Phase 4-B"
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
