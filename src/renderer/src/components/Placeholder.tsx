interface Props {
  title: string
  description: string
}

export function Placeholder({ title, description }: Props) {
  return (
    <div className="placeholder">
      <div>
        <div style={{ color: 'var(--text-1)', fontSize: 13, fontWeight: 500 }}>
          {title}
        </div>
        <div style={{ marginTop: 4 }}>{description}</div>
      </div>
    </div>
  )
}
