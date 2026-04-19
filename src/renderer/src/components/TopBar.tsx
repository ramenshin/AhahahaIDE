interface Props {
  onOpenSettings: () => void
}

export function TopBar({ onOpenSettings }: Props) {
  return (
    <div className="top-bar">
      <div className="app-title">⚡ AhahahaIDE</div>
      <button className="btn" type="button">+ 새 폴더</button>
      <button className="btn" type="button" onClick={onOpenSettings}>⚙ 설정</button>
      <div className="spacer" />
      <button className="btn" type="button">
        Quick Switch <span className="kbd">Ctrl+P</span>
      </button>
      <button className="btn" type="button">
        명령 팔레트 <span className="kbd">Ctrl+Shift+P</span>
      </button>
    </div>
  )
}
