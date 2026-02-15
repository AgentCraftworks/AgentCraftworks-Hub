import { EventEmitter } from 'events'

/**
 * Parses OSC escape sequences from raw PTY output.
 * Emits: 'title', 'progress', 'bell', 'shell-integration', 'cwd'
 */
export class OscParser extends EventEmitter {
  private partial = ''

  feed(data: string): void {
    const input = this.partial + data
    this.partial = ''
    let i = 0

    while (i < input.length) {
      // Check for ESC ] (OSC start)
      if (input[i] === '\x1b' && i + 1 < input.length && input[i + 1] === ']') {
        // Find terminator: BEL (\x07) or ST (\x1b\\)
        let endIdx = -1
        let terminatorLen = 0

        for (let j = i + 2; j < input.length; j++) {
          if (input[j] === '\x07') {
            endIdx = j
            terminatorLen = 1
            break
          }
          if (input[j] === '\x1b' && j + 1 < input.length && input[j + 1] === '\\') {
            endIdx = j
            terminatorLen = 2
            break
          }
        }

        if (endIdx === -1) {
          // Incomplete sequence -- buffer for next feed
          this.partial = input.slice(i)
          return
        }

        const content = input.slice(i + 2, endIdx)
        this.handleOsc(content)
        i = endIdx + terminatorLen
        continue
      }

      // Standalone BEL
      if (input[i] === '\x07') {
        this.emit('bell')
        i++
        continue
      }

      i++
    }
  }

  private handleOsc(content: string): void {
    const semiIdx = content.indexOf(';')
    if (semiIdx === -1) return

    const id = content.slice(0, semiIdx)
    const payload = content.slice(semiIdx + 1)

    switch (id) {
      case '0':  // Set icon + window title
      case '2':  // Set window title
        this.emit('title', payload)
        break

      case '9': {
        const parts = payload.split(';')
        if (parts[0] === '4' && parts.length >= 2) {
          // OSC 9;4;state;progress -- progress indicator
          const state = parseInt(parts[1], 10)
          const progress = parts.length >= 3 ? parseInt(parts[2], 10) : 0
          this.emit('progress', state, progress)
        } else if (parts[0] === '9') {
          // OSC 9;9;path -- CWD change
          const path = parts.slice(1).join(';').replace(/^"|"$/g, '')
          this.emit('cwd', path)
        }
        break
      }

      case '133': {
        // Shell integration marks: A, B, C, D;exitcode
        const parts = payload.split(';')
        const mark = parts[0]
        const exitCode = parts.length > 1 ? parseInt(parts[1], 10) : undefined
        this.emit('shell-integration', mark, exitCode)
        break
      }

      case '7': {
        // OSC 7 -- CWD as file:// URL
        if (payload.startsWith('file://')) {
          const path = decodeURIComponent(payload.replace(/^file:\/\/[^/]*/, ''))
          this.emit('cwd', path)
        }
        break
      }
    }
  }
}
