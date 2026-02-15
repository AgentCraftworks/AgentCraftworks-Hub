import { EventEmitter } from 'events'
import fs from 'fs'
import path from 'path'
import os from 'os'
import type { StatusFile, SessionStatus } from '@shared/types'
import { STATUS_FILE_MAP } from '@shared/constants'

const STATUS_DIR = path.join(os.homedir(), '.tangent', 'status')

/**
 * System A — File Watcher
 *
 * Watches `~/.tangent/status/<ptyId>.json` for status file changes.
 * When a status file is created/modified, parses it and emits the mapped status.
 * When the file is deleted, emits 'deactivate' so StatusEngine falls back to System B.
 *
 * Events:
 *   'activate'   — file first appears
 *   'status'     — mapped SessionStatus from StatusFile
 *   'activity'   — detail string from StatusFile (if present)
 *   'deactivate' — file deleted or disappeared
 */
export class SystemA extends EventEmitter {
  private watcher: fs.FSWatcher | null = null
  private filePath: string
  private active = false

  constructor(private ptyId: string) {
    super()
    this.filePath = path.join(STATUS_DIR, `${ptyId}.json`)
    this.startWatching()
  }

  private startWatching(): void {
    // Ensure the status directory exists before watching
    try {
      fs.mkdirSync(STATUS_DIR, { recursive: true })
    } catch {
      // Ignore if directory already exists or cannot be created
    }

    // Check if the file already exists
    if (fs.existsSync(this.filePath)) {
      this.handleFileChange()
    }

    // Watch the directory for changes to our specific file
    try {
      this.watcher = fs.watch(STATUS_DIR, (eventType, filename) => {
        if (filename === `${this.ptyId}.json`) {
          this.handleFileChange()
        }
      })

      this.watcher.on('error', () => {
        // Watcher errors are non-fatal; just stop watching
        this.dispose()
      })
    } catch {
      // If we can't watch, System A simply won't be active
      console.warn(`[SystemA] Unable to watch status directory: ${STATUS_DIR}`)
    }
  }

  private handleFileChange(): void {
    try {
      const content = fs.readFileSync(this.filePath, 'utf-8')
      const statusFile: StatusFile = JSON.parse(content)

      // Validate the status value
      const mappedStatus: SessionStatus | undefined = STATUS_FILE_MAP[statusFile.status]
      if (!mappedStatus) {
        console.warn(`[SystemA] Unknown status value in file: ${statusFile.status}`)
        return
      }

      // If this is the first time the file appears, emit 'activate'
      if (!this.active) {
        this.active = true
        this.emit('activate')
      }

      this.emit('status', mappedStatus)

      if (statusFile.detail) {
        this.emit('activity', statusFile.detail)
      }
    } catch (err) {
      if (this.isFileNotFoundError(err)) {
        // File was deleted
        if (this.active) {
          this.active = false
          this.emit('deactivate')
        }
      } else {
        // JSON parse failure or other read error — log and ignore
        console.warn(`[SystemA] Failed to read/parse status file: ${(err as Error).message}`)
      }
    }
  }

  private isFileNotFoundError(err: unknown): boolean {
    return (
      err instanceof Error &&
      'code' in err &&
      ((err as NodeJS.ErrnoException).code === 'ENOENT' ||
        (err as NodeJS.ErrnoException).code === 'EPERM')
    )
  }

  dispose(): void {
    if (this.watcher) {
      this.watcher.close()
      this.watcher = null
    }
    this.removeAllListeners()
  }
}
