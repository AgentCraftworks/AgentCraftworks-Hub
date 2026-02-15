import path from 'path'
import type { SessionStore } from '../session/SessionStore'

/**
 * CwdTracker — Tracks the current working directory for a session.
 *
 * Two detection mechanisms:
 * 1. OSC-based: Handles 'cwd' events from OscParser (OSC 7, OSC 9;9)
 * 2. Prompt parsing: Regex matching PowerShell prompt patterns from PTY output
 *
 * Simple dedup: does not update the store if CWD hasn't changed.
 */
export class CwdTracker {
  private lastCwd = ''

  /**
   * Regex for PowerShell prompt: PS C:\Users\me>
   * Matches: PS followed by a drive letter, colon, backslash, then a path,
   * ending with > (possibly with whitespace).
   */
  private static readonly PS_PROMPT_RE = /PS\s+([A-Za-z]:\\[^>]*?)>\s*$/m

  constructor(
    private sessionId: string,
    private store: SessionStore
  ) {}

  /**
   * Called when OscParser emits a 'cwd' event (OSC 7 or OSC 9;9).
   */
  handleOscCwd(cwdPath: string): void {
    this.updateIfChanged(cwdPath)
  }

  /**
   * Called with raw PTY output to scan for PowerShell prompt patterns.
   */
  handleOutput(data: string): void {
    const match = CwdTracker.PS_PROMPT_RE.exec(data)
    if (match) {
      const cwdPath = match[1].trimEnd()
      this.updateIfChanged(cwdPath)
    }
  }

  /**
   * Update the session store if the CWD has actually changed.
   */
  private updateIfChanged(newCwd: string): void {
    // Normalize path separators for comparison
    const normalized = newCwd.replace(/\//g, '\\')
    if (normalized === this.lastCwd) return

    this.lastCwd = normalized
    const folderName = path.basename(normalized)
    this.store.updateCwd(this.sessionId, normalized, folderName)
  }
}
