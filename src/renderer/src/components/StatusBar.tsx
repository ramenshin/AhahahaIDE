interface Props {
  folderCount: number
  maxSessions: number
  rootPath: string
  activeFolderName: string | null
}

export function StatusBar({ folderCount, maxSessions, rootPath, activeFolderName }: Props) {
  return (
    <div className="statusbar">
      <div className="item">📊 세션 0/{maxSessions}</div>
      <span className="sep">│</span>
      <div className="item">📁 스캔됨 {folderCount}개</div>
      <span className="sep">│</span>
      <div className="item">🏠 {rootPath}</div>
      {activeFolderName && (
        <>
          <span className="sep">│</span>
          <div className="item">▶ {activeFolderName}</div>
        </>
      )}
      <div className="spacer" />
      <div className="item">AhahahaIDE</div>
    </div>
  )
}
