import { useEffect, useState, useCallback, useRef } from 'react'
import { makeStyles } from '@fluentui/react-components'

interface UserInputRequest {
  question: string
  choices?: string[]
  allowFreeform: boolean
}

interface UserInputDialogProps {
  sessionId: string | null
}

const useStyles = makeStyles({
  overlay: {
    position: 'fixed',
    inset: '0',
    zIndex: 50,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  dialog: {
    borderRadius: '8px',
    padding: '20px',
    boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
    maxWidth: '448px',
    width: '100%',
    marginLeft: '16px',
    marginRight: '16px',
    backgroundColor: 'var(--bg-secondary)',
    borderWidth: '1px',
    borderStyle: 'solid',
    borderColor: 'var(--bg-hover)',
  },
  title: {
    fontSize: '13px',
    fontWeight: 600,
    marginBottom: '12px',
    color: 'var(--text-primary)',
  },
  question: {
    fontSize: '12px',
    marginBottom: '16px',
    color: 'var(--text-secondary)',
  },
  choices: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
    marginBottom: '12px',
  },
  choiceBtn: {
    paddingLeft: '12px',
    paddingRight: '12px',
    paddingTop: '6px',
    paddingBottom: '6px',
    fontSize: '12px',
    borderRadius: '4px',
    textAlign: 'left' as const,
    cursor: 'pointer',
    backgroundColor: 'var(--bg-hover)',
    color: 'var(--text-primary)',
    borderWidth: '1px',
    borderStyle: 'solid',
    borderColor: 'var(--bg-hover)',
  },
  freeformRow: {
    display: 'flex',
    gap: '8px',
  },
  freeformInput: {
    flex: 1,
    paddingLeft: '8px',
    paddingRight: '8px',
    paddingTop: '6px',
    paddingBottom: '6px',
    fontSize: '12px',
    borderRadius: '4px',
    outlineStyle: 'none',
    backgroundColor: 'var(--bg-primary)',
    color: 'var(--text-primary)',
    borderWidth: '1px',
    borderStyle: 'solid',
    borderColor: 'var(--bg-hover)',
  },
  sendBtn: {
    paddingLeft: '12px',
    paddingRight: '12px',
    paddingTop: '6px',
    paddingBottom: '6px',
    fontSize: '12px',
    borderRadius: '4px',
    fontWeight: 500,
    cursor: 'pointer',
    backgroundColor: 'var(--running)',
    color: '#fff',
    borderWidth: 0,
  },
})

export function UserInputDialog({ sessionId }: UserInputDialogProps) {
  const s = useStyles()
  const [request, setRequest] = useState<UserInputRequest | null>(null)
  const [freeformText, setFreeformText] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!sessionId) return
    const unsub = window.tangentAPI.sdk.onUserInput(sessionId, (req: UserInputRequest) => {
      setRequest(req)
      setFreeformText('')
    })
    return () => unsub()
  }, [sessionId])

  useEffect(() => {
    if (request && request.allowFreeform && inputRef.current) inputRef.current.focus()
  }, [request])

  const handleSubmit = useCallback((answer: string, wasFreeform: boolean) => {
    if (sessionId) window.tangentAPI.sdk.answerInput(sessionId, answer, wasFreeform)
    setRequest(null)
  }, [sessionId])

  const handleFreeformSubmit = useCallback(() => {
    if (freeformText.trim()) handleSubmit(freeformText.trim(), true)
  }, [freeformText, handleSubmit])

  if (!request) return null

  return (
    <div className={s.overlay}>
      <div className={s.dialog}>
        <h3 className={s.title}>Agent Question</h3>
        <p className={s.question}>{request.question}</p>
        {request.choices && request.choices.length > 0 && (
          <div className={s.choices}>
            {request.choices.map((choice, i) => (
              <button type="button" key={i} onClick={() => handleSubmit(choice, false)} className={s.choiceBtn}>
                {choice}
              </button>
            ))}
          </div>
        )}
        {request.allowFreeform && (
          <div className={s.freeformRow}>
            <input
              ref={inputRef}
              value={freeformText}
              onChange={e => setFreeformText(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleFreeformSubmit() }}
              placeholder="Type your answer..."
              className={s.freeformInput}
            />
            <button type="button" onClick={handleFreeformSubmit} className={s.sendBtn}>Send</button>
          </div>
        )}
      </div>
    </div>
  )
}
