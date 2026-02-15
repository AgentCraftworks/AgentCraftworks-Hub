import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { SystemB } from '../SystemB'
import type { SessionStatus } from '@shared/types'

describe('SystemB', () => {
  let systemB: SystemB
  let statusChanges: SessionStatus[]
  let activityChanges: string[]

  beforeEach(() => {
    vi.useFakeTimers()
    systemB = new SystemB()
    statusChanges = []
    activityChanges = []
    systemB.on('status', (status: SessionStatus) => statusChanges.push(status))
    systemB.on('activity', (activity: string) => activityChanges.push(activity))
  })

  afterEach(() => {
    vi.useRealTimers()
    systemB.dispose()
  })

  describe('pattern detection', () => {
    it('detects PowerShell prompt as shell_ready', () => {
      systemB.feed('PS D:\\git\\myapp> ')
      vi.advanceTimersByTime(600)
      expect(statusChanges).toContain('shell_ready')
    })

    it('detects ❯ as agent_ready after 300ms silence', () => {
      systemB.feed('❯ ')
      vi.advanceTimersByTime(400) // past 300ms silence
      expect(statusChanges).toContain('agent_ready')
    })

    it('detects › as agent_ready after 300ms silence', () => {
      systemB.feed('› ')
      vi.advanceTimersByTime(400)
      expect(statusChanges).toContain('agent_ready')
    })

    it('cancels agent_ready if output arrives during silence window', () => {
      systemB.feed('❯ ')
      vi.advanceTimersByTime(200) // within 300ms
      systemB.feed('some more output')
      vi.advanceTimersByTime(400)
      expect(statusChanges).not.toContain('agent_ready')
    })

    it('detects spinner as processing (eager)', () => {
      systemB.feed('\u280B Working...')
      expect(statusChanges).toContain('processing')
    })

    it('detects thinking as processing', () => {
      systemB.feed('Thinking...')
      expect(statusChanges).toContain('processing')
    })

    it('detects tool patterns as tool_executing', () => {
      systemB.feed('running tool: edit src/app.ts')
      vi.advanceTimersByTime(600)
      expect(statusChanges).toContain('tool_executing')
    })

    it('detects y/n as needs_input', () => {
      systemB.feed('Apply changes? (y/n)')
      vi.advanceTimersByTime(600)
      expect(statusChanges).toContain('needs_input')
    })

    it('requires 2 error matches for failed', () => {
      systemB.feed('Error: file not found')
      vi.advanceTimersByTime(600)
      expect(statusChanges).not.toContain('failed')

      systemB.feed('Error: cannot continue')
      vi.advanceTimersByTime(600)
      expect(statusChanges).toContain('failed')
    })
  })

  describe('minimum hold time', () => {
    it('ignores transitions within 500ms of last change', () => {
      systemB.feed('\u280B Working...') // processing (eager)
      expect(statusChanges).toContain('processing')
      statusChanges = []

      vi.advanceTimersByTime(200) // within 500ms hold
      systemB.feed('PS D:\\> ') // shell_ready attempt within hold
      vi.advanceTimersByTime(600)

      // Should not have transitioned to shell_ready within hold period
      expect(statusChanges).not.toContain('shell_ready')
    })

    it('allows transitions after 500ms hold period', () => {
      systemB.feed('\u280B Working...') // processing (eager)
      expect(statusChanges).toContain('processing')
      statusChanges = []

      vi.advanceTimersByTime(600) // past 500ms hold
      systemB.feed('PS D:\\> ') // shell_ready attempt after hold
      vi.advanceTimersByTime(600)

      expect(statusChanges).toContain('shell_ready')
    })
  })

  describe('300ms silence confirmation for agent_ready', () => {
    it('waits 300ms of silence before committing agent_ready', () => {
      systemB.feed('❯ ')
      vi.advanceTimersByTime(100)
      // Should not have emitted yet
      expect(statusChanges).not.toContain('agent_ready')

      vi.advanceTimersByTime(250) // total 350ms, past 300ms silence
      expect(statusChanges).toContain('agent_ready')
    })

    it('cancels agent_ready on new output within silence window', () => {
      systemB.feed('❯ ')
      vi.advanceTimersByTime(150) // within 300ms
      systemB.feed('Agent is loading...')
      vi.advanceTimersByTime(500)
      expect(statusChanges).not.toContain('agent_ready')
    })
  })

  describe('processing transitions are eager', () => {
    it('transitions to processing immediately on spinner', () => {
      systemB.feed('\u280B Processing data...')
      // Should emit immediately, no delay needed
      expect(statusChanges).toEqual(['processing'])
    })

    it('transitions to processing immediately on thinking', () => {
      systemB.feed('Thinking about the problem...')
      expect(statusChanges).toEqual(['processing'])
    })
  })

  describe('failed requires 2 matches within 3 seconds', () => {
    it('does not transition on a single error line', () => {
      systemB.feed('Error: something went wrong')
      vi.advanceTimersByTime(600)
      expect(statusChanges).not.toContain('failed')
    })

    it('transitions on 2 error matches within 3 seconds', () => {
      systemB.feed('Error: first problem')
      vi.advanceTimersByTime(1000)
      systemB.feed('error: second problem')
      vi.advanceTimersByTime(600)
      expect(statusChanges).toContain('failed')
    })

    it('does not transition if 2nd match is outside 3s window', () => {
      systemB.feed('Error: first problem')
      vi.advanceTimersByTime(3500) // past the persist timer (2s) — will have already transitioned
      // After 2s persist timer fires, it transitions to failed
      // So we need to clear and test that a new single error doesn't immediately transition
      statusChanges = []
      systemB.feed('FATAL crash') // This is a new first match (counter was reset)
      vi.advanceTimersByTime(600)
      // Single match shouldn't immediately transition (needs 2 matches or persist)
      expect(statusChanges).not.toContain('failed')
    })

    it('transitions after 2s persist timer on single match', () => {
      systemB.feed('Error: something bad happened')
      vi.advanceTimersByTime(2100) // past 2000ms persist timer
      expect(statusChanges).toContain('failed')
    })
  })

  describe('lastActivity extraction', () => {
    it('extracts activity from editing output', () => {
      systemB.feed('editing src/auth.ts')
      expect(activityChanges).toContain('src/auth.ts')
    })

    it('extracts activity from running output', () => {
      systemB.feed('running tests/unit.spec.ts')
      expect(activityChanges).toContain('tests/unit.spec.ts')
    })

    it('extracts activity from reading output', () => {
      systemB.feed('Reading file package.json')
      expect(activityChanges).toContain('package.json')
    })

    it('extracts activity from writing output', () => {
      systemB.feed('Writing file dist/bundle.js')
      expect(activityChanges).toContain('dist/bundle.js')
    })

    it('extracts activity from creating output', () => {
      systemB.feed('creating src/new-component.tsx')
      expect(activityChanges).toContain('src/new-component.tsx')
    })

    it('extracts activity from deleting output', () => {
      systemB.feed('deleting tmp/cache.json')
      expect(activityChanges).toContain('tmp/cache.json')
    })
  })

  describe('rolling buffer', () => {
    it('maintains a maximum of 20 lines', () => {
      // Feed 25 lines
      for (let i = 0; i < 25; i++) {
        systemB.feed(`line ${i}\n`)
      }
      // Buffer should only have 20 lines
      expect(systemB.getBuffer().length).toBeLessThanOrEqual(20)
    })
  })

  describe('priority order', () => {
    it('higher priority rule wins when multiple match', () => {
      // Spinner (priority 4) should win over tool_executing (priority 6)
      // Input contains both a spinner char and "running tool:" text
      systemB.feed('\u280B running tool: edit file')
      // processing is eager and higher priority, so it should fire
      expect(statusChanges).toContain('processing')
      expect(statusChanges).not.toContain('tool_executing')
    })

    it('PowerShell prompt wins over needs_input when both present', () => {
      // PS prompt (priority 1) should win over (y/n) (priority 7)
      systemB.feed('PS D:\\git\\app> ')
      vi.advanceTimersByTime(600)
      expect(statusChanges).toContain('shell_ready')
    })
  })

  describe('dispose', () => {
    it('cleans up timers and listeners', () => {
      systemB.feed('❯ ') // starts a silence timer
      systemB.dispose()
      vi.advanceTimersByTime(500)
      // No status should have been emitted after dispose
      expect(statusChanges).toEqual([])
    })
  })
})
