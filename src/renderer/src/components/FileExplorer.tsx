import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { FileNode, FsChangeEvent } from '@shared/types'

interface Props {
  rootPath: string
  onFileOpen: (filePath: string) => void
  selectedFilePath: string | null
}

function dirname(p: string): string {
  const idx = Math.max(p.lastIndexOf('\\'), p.lastIndexOf('/'))
  return idx >= 0 ? p.slice(0, idx) : p
}

function compareNodes(a: FileNode, b: FileNode): number {
  if (a.isDirectory !== b.isDirectory) return a.isDirectory ? -1 : 1
  return a.name.localeCompare(b.name, 'ko')
}

function insertSorted(arr: FileNode[], node: FileNode): FileNode[] {
  const without = arr.filter((n) => n.path !== node.path)
  const next = [...without, node]
  next.sort(compareNodes)
  return next
}

export function FileExplorer({ rootPath, onFileOpen, selectedFilePath }: Props) {
  const [childrenByParent, setChildrenByParent] = useState<Map<string, FileNode[]>>(new Map())
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const childrenRef = useRef(childrenByParent)
  childrenRef.current = childrenByParent

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    setChildrenByParent(new Map())
    setExpanded(new Set([rootPath]))

    const dispose = window.api.fs.onChange((ev: FsChangeEvent) => {
      if (ev.rootPath !== rootPath) return
      setChildrenByParent((prev) => {
        const next = new Map(prev)
        const parent = dirname(ev.path)
        const bucket = next.get(parent) ?? []

        if (ev.type === 'add' || ev.type === 'addDir') {
          const node: FileNode = {
            name: ev.path.split(/[\\/]/).pop() ?? ev.path,
            path: ev.path,
            isDirectory: ev.isDirectory
          }
          next.set(parent, insertSorted(bucket, node))
        } else if (ev.type === 'unlink' || ev.type === 'unlinkDir') {
          next.set(parent, bucket.filter((n) => n.path !== ev.path))
          if (ev.type === 'unlinkDir') {
            for (const key of [...next.keys()]) {
              if (key === ev.path || key.startsWith(ev.path + '\\') || key.startsWith(ev.path + '/')) {
                next.delete(key)
              }
            }
          }
        }
        return next
      })
    })

    const disposeRoot = window.api.fs.onRootRemoved((removed: string) => {
      if (removed !== rootPath) return
      setError('감시 중인 폴더가 삭제되었습니다.')
      setLoading(false)
    })

    window.api.fs
      .watch(rootPath)
      .then((snapshot) => {
        if (cancelled) return
        const map = new Map<string, FileNode[]>()
        for (const node of snapshot.nodes) {
          const parent = dirname(node.path)
          const bucket = map.get(parent) ?? []
          bucket.push(node)
          map.set(parent, bucket)
        }
        for (const [k, v] of map) {
          v.sort(compareNodes)
          map.set(k, v)
        }
        setChildrenByParent(map)
        setLoading(false)
      })
      .catch((err) => {
        if (cancelled) return
        setError(String(err))
        setLoading(false)
      })

    return () => {
      cancelled = true
      dispose()
      disposeRoot()
      window.api.fs.unwatch().catch(() => {})
    }
  }, [rootPath])

  const toggleExpand = useCallback((path: string) => {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(path)) next.delete(path)
      else next.add(path)
      return next
    })
  }, [])

  const handleFileClick = useCallback(
    (path: string) => {
      onFileOpen(path)
    },
    [onFileOpen]
  )

  const rootChildren = useMemo(
    () => childrenByParent.get(rootPath) ?? [],
    [childrenByParent, rootPath]
  )

  if (loading) {
    return <div className="file-explorer-empty">스캔 중…</div>
  }
  if (error) {
    return <div className="file-explorer-empty error">오류: {error}</div>
  }
  if (rootChildren.length === 0) {
    return <div className="file-explorer-empty">비어있는 폴더</div>
  }

  return (
    <div className="file-explorer">
      <TreeList
        nodes={rootChildren}
        depth={0}
        childrenByParent={childrenByParent}
        expanded={expanded}
        onToggle={toggleExpand}
        onFileClick={handleFileClick}
        selectedFilePath={selectedFilePath}
      />
    </div>
  )
}

interface TreeListProps {
  nodes: FileNode[]
  depth: number
  childrenByParent: Map<string, FileNode[]>
  expanded: Set<string>
  onToggle: (path: string) => void
  onFileClick: (path: string) => void
  selectedFilePath: string | null
}

function TreeList({
  nodes,
  depth,
  childrenByParent,
  expanded,
  onToggle,
  onFileClick,
  selectedFilePath
}: TreeListProps) {
  return (
    <>
      {nodes.map((node) => {
        const isOpen = node.isDirectory && expanded.has(node.path)
        const children = isOpen ? childrenByParent.get(node.path) ?? [] : []
        const isSelected = !node.isDirectory && node.path === selectedFilePath
        return (
          <div key={node.path}>
            <div
              className={`tree-row${node.isDirectory ? ' dir' : ' file'}${isSelected ? ' selected' : ''}`}
              style={{ paddingLeft: 8 + depth * 12 }}
              onClick={() =>
                node.isDirectory ? onToggle(node.path) : onFileClick(node.path)
              }
            >
              <span className="tree-caret">
                {node.isDirectory ? (isOpen ? '▾' : '▸') : ''}
              </span>
              <span className="tree-icon">
                {node.isDirectory ? (isOpen ? '📂' : '📁') : '📄'}
              </span>
              <span className="tree-name">{node.name}</span>
            </div>
            {isOpen && children.length > 0 && (
              <TreeList
                nodes={children}
                depth={depth + 1}
                childrenByParent={childrenByParent}
                expanded={expanded}
                onToggle={onToggle}
                onFileClick={onFileClick}
                selectedFilePath={selectedFilePath}
              />
            )}
          </div>
        )
      })}
    </>
  )
}
