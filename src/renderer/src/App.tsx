import { useEffect, useState } from 'react'
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels'
import type { AppConfig, ProjectFolder } from '@shared/types'
import { TopBar } from './components/TopBar'
import { ProjectTabBar } from './components/ProjectTabBar'
import { ProjectTree } from './components/ProjectTree'
import { StatusBar } from './components/StatusBar'
import { Placeholder } from './components/Placeholder'

export function App() {
  const [config, setConfig] = useState<AppConfig | null>(null)
  const [folders, setFolders] = useState<ProjectFolder[]>([])
  const [loading, setLoading] = useState(true)
  const [scanError, setScanError] = useState<string | null>(null)
  const [selectedPath, setSelectedPath] = useState<string | null>(null)

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

  const activeFolder = folders.find((f) => f.path === selectedPath) ?? null

  return (
    <div className="app">
      <TopBar />
      <ProjectTabBar openProjects={[]} activePath={null} />
      <PanelGroup direction="horizontal">
        {/* LEFT AREA */}
        <Panel
          defaultSize={config?.ui.panels.leftWidth ?? 32}
          minSize={20}
          maxSize={55}
        >
          <PanelGroup direction="vertical">
            {/* LEFT TOP: folders + files */}
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
                    selectedPath={selectedPath}
                    onSelect={setSelectedPath}
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
                    <Placeholder
                      phase="Phase 3"
                      title="파일 탐색기"
                      description="chokidar 실시간 감시로 선택 프로젝트의 파일 트리를 표시합니다."
                    />
                  </div>
                </Panel>
              </PanelGroup>
            </Panel>
            <PanelResizeHandle className="resize-handle-h" />
            {/* LEFT BOTTOM: memo */}
            <Panel
              defaultSize={config?.ui.panels.memoHeight ?? 30}
              minSize={15}
            >
              <div className="panel">
                <div className="panel-header">
                  <span className="title">📝 메모 · user_defined_memo.md</span>
                </div>
                <Placeholder
                  phase="Phase 7"
                  title="프로젝트 메모"
                  description="각 프로젝트의 user_defined_memo.md 파일을 편집/저장합니다. Monaco 기반."
                />
              </div>
            </Panel>
          </PanelGroup>
        </Panel>

        <PanelResizeHandle className="resize-handle-v" />

        {/* RIGHT AREA */}
        <Panel minSize={35}>
          <PanelGroup direction="vertical">
            <Panel
              defaultSize={config?.ui.panels.editorHeight ?? 40}
              minSize={15}
            >
              <div className="panel">
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
              <div className="panel">
                <div className="panel-header">
                  <span className="title">▲ PowerShell + Claude</span>
                </div>
                <Placeholder
                  phase="Phase 2"
                  title="Claude 터미널"
                  description="node-pty + xterm.js로 PowerShell 스폰, venv 활성화, claude 자동 실행."
                />
              </div>
            </Panel>
            <PanelResizeHandle className="resize-handle-h" />
            <Panel
              defaultSize={config?.ui.panels.plainTerminalHeight ?? 30}
              minSize={10}
            >
              <div className="panel">
                <div className="panel-header">
                  <span className="title">▼ PowerShell</span>
                </div>
                <Placeholder
                  phase="Phase 2"
                  title="일반 터미널"
                  description="venv 활성화된 PowerShell. 테스트 실행, Git 명령 등에 사용."
                />
              </div>
            </Panel>
          </PanelGroup>
        </Panel>
      </PanelGroup>
      <StatusBar
        folderCount={folders.length}
        maxSessions={config?.maxSessions ?? 20}
        rootPath={config?.rootPath ?? ''}
        activeFolderName={activeFolder?.name ?? null}
      />
    </div>
  )
}
