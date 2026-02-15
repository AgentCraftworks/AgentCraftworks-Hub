import { describe, it, expect, beforeEach } from 'vitest'
import { OscParser } from '../OscParser'

describe('OscParser', () => {
  let parser: OscParser
  let events: { type: string; data?: any }[]

  beforeEach(() => {
    parser = new OscParser()
    events = []
    parser.on('title', (title: string) => events.push({ type: 'title', data: title }))
    parser.on('progress', (state: number, progress: number) => events.push({ type: 'progress', data: { state, progress } }))
    parser.on('bell', () => events.push({ type: 'bell' }))
    parser.on('shell-integration', (mark: string, exitCode?: number) => events.push({ type: 'shell-integration', data: { mark, exitCode } }))
    parser.on('cwd', (path: string) => events.push({ type: 'cwd', data: path }))
  })

  it('detects OSC 2 title changes', () => {
    parser.feed('\x1b]2;Build App From Spec\x07')
    expect(events).toEqual([{ type: 'title', data: 'Build App From Spec' }])
  })

  it('detects OSC 0 title changes', () => {
    parser.feed('\x1b]0;My Title\x07')
    expect(events).toEqual([{ type: 'title', data: 'My Title' }])
  })

  it('detects OSC 9;4 progress state changes', () => {
    parser.feed('\x1b]9;4;3;0\x07')  // indeterminate (spinner)
    parser.feed('\x1b]9;4;0;0\x07')  // hidden (done)
    expect(events).toEqual([
      { type: 'progress', data: { state: 3, progress: 0 } },
      { type: 'progress', data: { state: 0, progress: 0 } }
    ])
  })

  it('detects OSC 9;9 CWD changes', () => {
    parser.feed('\x1b]9;9;"D:\\git\\myapp"\x07')
    expect(events).toEqual([{ type: 'cwd', data: 'D:\\git\\myapp' }])
  })

  it('detects OSC 133 shell integration marks', () => {
    parser.feed('\x1b]133;C\x07')
    parser.feed('\x1b]133;D;0\x07')
    expect(events).toEqual([
      { type: 'shell-integration', data: { mark: 'C', exitCode: undefined } },
      { type: 'shell-integration', data: { mark: 'D', exitCode: 0 } }
    ])
  })

  it('detects standalone BEL', () => {
    parser.feed('\x07')
    expect(events).toEqual([{ type: 'bell' }])
  })

  it('does not emit BEL for BEL inside OSC sequences', () => {
    parser.feed('\x1b]2;Hello\x07')
    const bellEvents = events.filter(e => e.type === 'bell')
    expect(bellEvents).toHaveLength(0)
  })

  it('handles ST terminator', () => {
    parser.feed('\x1b]2;With ST\x1b\\')
    expect(events).toEqual([{ type: 'title', data: 'With ST' }])
  })

  it('handles mixed data with OSC sequences', () => {
    parser.feed('normal text\x1b]2;title\x07more text\x07')
    const titleEvents = events.filter(e => e.type === 'title')
    const bellEvents = events.filter(e => e.type === 'bell')
    expect(titleEvents).toHaveLength(1)
    expect(bellEvents).toHaveLength(1)  // standalone BEL after "more text"
  })

  it('handles partial sequences across feeds', () => {
    parser.feed('\x1b]2;Part')
    expect(events).toHaveLength(0)
    parser.feed('ial Title\x07')
    expect(events).toEqual([{ type: 'title', data: 'Partial Title' }])
  })

  it('handles OSC 7 CWD as file URL', () => {
    parser.feed('\x1b]7;file://hostname/D:/git/myapp\x07')
    expect(events).toEqual([{ type: 'cwd', data: '/D:/git/myapp' }])
  })

  it('handles multiple OSC sequences in one feed', () => {
    parser.feed('\x1b]2;Title1\x07\x1b]2;Title2\x07')
    expect(events).toEqual([
      { type: 'title', data: 'Title1' },
      { type: 'title', data: 'Title2' }
    ])
  })

  it('ignores unknown OSC codes', () => {
    parser.feed('\x1b]999;unknown\x07')
    expect(events).toHaveLength(0)
  })
})
