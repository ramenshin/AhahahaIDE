import { useCallback, useEffect, useMemo, useState } from 'react'
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels'
import type { AppConfig, ProjectFolder } from '@shared/types'
import { ZOOM_STEP, clampZoom } from '@shared/types'
import { TopBar } from './components/TopBar'
import { ProjectTabBar } from './components/ProjectTabBar'
import { ProjectTree } from './components/ProjectTree'
import { StatusBar } from './components/StatusBar'
import { Placeholder } from './components/Placeholder'
import { Terminal } from './components/Terminal'
import { SettingsModal } from './components/SettingsModal'
import { FileExplorer } from './components/FileExplorer'
import { MemoEditor } from './components/MemoEditor'

export function App() {
  const [config, setConfig] = useState<AppConfig | null>(null)
  const [folders, setFolders] = useState<ProjectFolder[]>([])
  const [loading, setLoading] = useState(true)
  const [scanError, setScanError] = useState<string | null>(null)
  const [openPaths, setOpenPaths] = useState<string[]>([])
  const [activePath, setActivePath] = useState<string | null>(null)
  const [sessionError, setSessionError] = useState<string | null>(null)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [memoDirty, setMemoDirty] = useState(false)

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

  return (
    <div className="app">
      <TopBar onOpenSettings={() => setSettingsOpen(true)} />
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
                      <FileExplorer rootPath={activeFolder.path} />
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
          <PanelGroup direction="vertical">
            <Panel
              defaultSize={config?.ui.panels.editorHeight ?? 40}
              minSize={15}
            >
              <div className="panel panel-black">
                <div className="panel-header">
                  <span className="title">📝 에디터</span>
                </div>
                <Placeholder
                  phase="Phase 1.5 / 차후"
                  title="Monaco 코드 에디터"
                  description="파일 클릭 시 선택 파일을 편집합니다. Ctrl+S 저장, 미저장 ● 표시."
                />
              </div>
            </Panel>
            <PanelResizeHandle className="resize-handle-h" />
            <Panel
              defaultSize={config?.ui.panels.claudeTerminalHeight ?? 30}
              minSize={10}
            >
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
            </Panel>
            <PanelResizeHandle className="resize-handle-h" />
            <Panel
              defaultSize={config?.ui.panels.plainTerminalHeight ?? 30}
              minSize={10}
            >
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
            </Panel>
          </PanelGroup>
        </Panel>
      </PanelGroup>
      {sessionError && (
        <div className="session-error" onClick={() => setSessionError(null)}>
          {sessionError} <span className="dismiss">×</span>
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
          onClose={() => setSettingsOpen(false)}
          onSave={handleSaveSettings}
        />
      )}
    </div>
  )
}
