import { useRef, useEffect } from 'react'
import { makeStyles } from '@fluentui/react-components'

interface SessionFilterProps {
  value: string
  onChange: (value: string) => void
  onClose: () => void
}

const useStyles = makeStyles({
  root: {
    paddingLeft: '8px',
    paddingRight: '8px',
    paddingBottom: '8px',
  },
  input: {
    width: '100%',
    paddingLeft: '8px',
    paddingRight: '8px',
    paddingTop: '4px',
    paddingBottom: '4px',
    fontSize: '13px',
    borderRadius: '4px',
    outlineStyle: 'none',
    backgroundColor: 'var(--bg-tertiary)',
    color: 'var(--text-primary)',
    borderWidth: '1px',
    borderStyle: 'solid',
    borderColor: 'var(--bg-hover)',
    ':focus': {
      borderColor: 'var(--accent)',
    },
  },
})

export function SessionFilter({ value, onChange, onClose }: SessionFilterProps) {
  const styles = useStyles()
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  return (
    <div className={styles.root}>
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Escape') onClose()
        }}
        placeholder="Filter sessions..."
        className={styles.input}
      />
    </div>
  )
}
