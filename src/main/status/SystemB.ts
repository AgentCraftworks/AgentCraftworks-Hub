import { EventEmitter } from 'events'
import type { SessionStatus } from '@shared/types'
import { STATUS_TIMING } from '@shared/constants'

interface DetectionRule {
  pattern: RegExp
  status: SessionStatus
  priority: number
}

const RULES: DetectionRule[] = [
  { priority: 1, pattern: /PS\s+[A-Za-z]:\\[^>]*>\s*$/, status: 'shell_ready' },
  { priority: 2, pattern: /^❯\s*/m, status: 'agent_ready' },
  { priority: 3, pattern: /^›\s*/m, status: 'agent_ready' },
  { priority: 4, pattern: /[⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏]/, status: 'processing' },
  { priority: 5, pattern: /[Tt]hinking/, status: 'processing' },
  { priority: 6, pattern: /running tool:|executing command:|Reading file|Writing file/i, status: 'tool_executing' },
  { priority: 7, pattern: /(y\/n)|continue\?|allow\?|permit\?|approve\?/i, status: 'needs_input' },
  { priority: 8, pattern: /Error:|error:|FATAL|command not found|ENOENT/, status: 'failed' },
]

const ACTIVITY_PATTERN = /(?:editing|reading|writing|creating|deleting|running)\s+(?:file\s+)?(.+)/i

export class SystemB extends EventEmitter {
  private buffer: string[] = []
  private currentStatus: SessionStatus | null = null
  private lastTransitionTime = 0
  private silenceTimer: ReturnType<typeof setTimeout> | null = null
  private pendingReady = false
  private failedMatchCount = 0
  private failedFirstMatchTime = 0
  private failedPersistTimer: ReturnType<typeof setTimeout> | null = null

  feed(data: string): void {
    // Update rolling buffer
    const lines = data.split('\n')
    this.buffer.push(...lines)
    while (this.buffer.length > STATUS_TIMING.OUTPUT_BUFFER_LINES) {
      this.buffer.shift()
    }

    // Cancel pending agent_ready if new output arrives
    if (this.pendingReady && this.silenceTimer) {
      clearTimeout(this.silenceTimer)
      this.silenceTimer = null
      this.pendingReady = false
    }

    // Extract lastActivity
    const activityMatch = data.match(ACTIVITY_PATTERN)
    if (activityMatch) {
      this.emit('activity', activityMatch[1].trim())
    }

    // Run detection rules in priority order
    for (const rule of RULES) {
      if (!rule.pattern.test(data)) continue

      // agent_ready needs 300ms silence confirmation
      if (rule.status === 'agent_ready') {
        this.pendingReady = true
        this.silenceTimer = setTimeout(() => {
          this.pendingReady = false
          this.silenceTimer = null
          this.tryTransition('agent_ready')
        }, STATUS_TIMING.PROMPT_SILENCE_MS)
        return
      }

      // failed requires 2 matches
      if (rule.status === 'failed') {
        const now = Date.now()
        if (this.failedMatchCount === 0) {
          this.failedMatchCount = 1
          this.failedFirstMatchTime = now
          // Start a persist timer -- if no override in 2s, transition
          this.failedPersistTimer = setTimeout(() => {
            this.failedPersistTimer = null
            this.tryTransition('failed')
            this.failedMatchCount = 0
          }, STATUS_TIMING.FAILED_PERSIST_MS)
        } else if (now - this.failedFirstMatchTime <= STATUS_TIMING.FAILED_WINDOW_MS) {
          // 2nd match within 3s window
          if (this.failedPersistTimer) {
            clearTimeout(this.failedPersistTimer)
            this.failedPersistTimer = null
          }
          this.failedMatchCount = 0
          this.tryTransition('failed')
        } else {
          // Outside window, restart
          this.failedMatchCount = 1
          this.failedFirstMatchTime = now
          if (this.failedPersistTimer) {
            clearTimeout(this.failedPersistTimer)
          }
          this.failedPersistTimer = setTimeout(() => {
            this.failedPersistTimer = null
            this.tryTransition('failed')
            this.failedMatchCount = 0
          }, STATUS_TIMING.FAILED_PERSIST_MS)
        }
        return
      }

      // processing is eager (no extra delay beyond 500ms hold)
      if (rule.status === 'processing') {
        // Clear any pending failed
        if (this.failedPersistTimer) {
          clearTimeout(this.failedPersistTimer)
          this.failedPersistTimer = null
          this.failedMatchCount = 0
        }
        this.tryTransition('processing')
        return
      }

      // All other statuses: apply with hold check
      this.tryTransition(rule.status)
      return // First matching rule wins
    }
  }

  private tryTransition(newStatus: SessionStatus): void {
    const now = Date.now()
    if (now - this.lastTransitionTime < STATUS_TIMING.MIN_HOLD_MS && this.currentStatus !== null) {
      return // Within hold period
    }

    if (newStatus !== this.currentStatus) {
      this.currentStatus = newStatus
      this.lastTransitionTime = now
      this.emit('status', newStatus)
    }
  }

  /** Returns the current rolling buffer contents. */
  getBuffer(): string[] {
    return [...this.buffer]
  }

  dispose(): void {
    if (this.silenceTimer) {
      clearTimeout(this.silenceTimer)
      this.silenceTimer = null
    }
    if (this.failedPersistTimer) {
      clearTimeout(this.failedPersistTimer)
      this.failedPersistTimer = null
    }
    this.removeAllListeners()
  }
}
