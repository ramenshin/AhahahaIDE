interface Props {
  phase: string
  title: string
  description: string
}

export function Placeholder({ phase, title, description }: Props) {
  return (
    <div className="placeholder">
      <div>
        <div className="phase-tag">{phase}에서 구현 예정</div>
        <div style={{ marginTop: 8, color: 'var(--text-1)', fontSize: 13, fontWeight: 500 }}>
          {title}
        </div>
        <div style={{ marginTop: 4 }}>{description}</div>
      </div>
    </div>
  )
}
