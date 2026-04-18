export function TopBar() {
  return (
    <div className="top-bar">
      <div className="app-title">⚡ devIdeTool</div>
      <button className="btn" type="button">+ 새 폴더</button>
      <button className="btn" type="button">⚙ 설정</button>
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
