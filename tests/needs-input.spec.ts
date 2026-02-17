import { test, expect, _electron as electron, type ElectronApplication, type Page } from '@playwright/test'

/**
 * E2E test: needs_input status turns orange when Copilot asks a question.
 *
 * Flow:
 *   1. Launch Tangent
 *   2. Ctrl+3 to open the Demos project folder
 *   3. Press 3 to launch "photo uploader" agent
 *   4. Wait for Copilot to boot (❯ prompt visible)
 *   5. Type "ask me to choose from 4 different colors" + Enter
 *   6. Wait for the ask_user prompt to appear
 *   7. Verify session status is 'attention' (orange pulsing dot)
 */

let app: ElectronApplication
let page: Page

test.beforeAll(async () => {
  app = await electron.launch({
    args: ['out/main/index.js'],
    env: {
      ...process.env,
      NODE_ENV: 'test'
    }
  })
  page = await app.firstWindow()
  await page.waitForTimeout(3000)
})

test.afterAll(async () => {
  await app.close().catch(() => {})
})

test.describe('needs_input status detection', () => {
  test('ask_user prompt turns session status orange', async () => {
    // Step 1: Open Demos project folder (Ctrl+3)
    await page.keyboard.press('Control+3')
    await page.waitForTimeout(500)
    await page.screenshot({ path: 'tests/screenshots/needs-input-01-group-open.png' })

    // Step 2: Launch photo uploader agent (press 3 for 3rd agent in group)
    await page.keyboard.press('3')
    await page.waitForTimeout(2000)
    await page.screenshot({ path: 'tests/screenshots/needs-input-02-agent-launched.png' })

    // Step 3: Wait for Copilot to boot — look for the TUI prompt or banner
    // Give it up to 60 seconds to boot
    let copilotReady = false
    for (let i = 0; i < 30; i++) {
      await page.waitForTimeout(2000)
      // Use innerText for readable text from xterm (textContent gives raw spans)
      const termText = await page.locator('.xterm:visible .xterm-screen').first().innerText().catch(() => '')
      if (termText && (termText.includes('Describe a task') || termText.includes('to mention') || termText.includes('GitHub Copilot'))) {
        copilotReady = true
        break
      }
    }

    await page.screenshot({ path: 'tests/screenshots/needs-input-03-copilot-ready.png' })
    expect(copilotReady).toBe(true)

    // Step 4: Focus terminal and type the prompt
    const xtermEl = page.locator('.xterm:visible').first()
    await xtermEl.click()
    await page.waitForTimeout(500)

    // Type the message
    await page.keyboard.type('ask me to choose from 4 different colors', { delay: 30 })
    await page.waitForTimeout(1000)
    await page.screenshot({ path: 'tests/screenshots/needs-input-04-typed.png' })

    // Press Enter to submit
    await page.keyboard.press('Enter')

    // Step 5: Wait for the ask_user prompt to appear (up to 60 seconds for LLM response)
    let askUserVisible = false
    for (let i = 0; i < 30; i++) {
      await page.waitForTimeout(2000)
      const termText = await page.locator('.xterm:visible .xterm-screen').first().innerText().catch(() => '')
      if (termText && (termText.includes('type your answer') || termText.includes('to select') || termText.includes('Asking user'))) {
        askUserVisible = true
        break
      }
    }

    await page.screenshot({ path: 'tests/screenshots/needs-input-05-ask-user.png' })
    expect(askUserVisible).toBe(true)

    // Step 6: Verify the session has 'attention' status (orange pulsing dot)
    // The session item should have the attention styling — check for the orange bar/dot
    // The status bar should reflect the active session's status
    await page.waitForTimeout(1000)
    await page.screenshot({ path: 'tests/screenshots/needs-input-06-status.png' })

    // Check for the pulse-fast animation class on a dot in the sessions panel
    // The session should have a pulsing dot with the attention color
    const pulsingDot = page.locator('.animate-pulse-fast')
    const dotCount = await pulsingDot.count()
    expect(dotCount).toBeGreaterThan(0)

    // Verify the dot color is the attention color (orange)
    const dotStyle = await pulsingDot.first().getAttribute('style')
    expect(dotStyle).toContain('--attention')

    // Step 7: Answer the question — press 1 to select first color
    await page.keyboard.press('1')
    await page.waitForTimeout(500)
    await page.keyboard.press('Enter')

    // Step 8: Wait for Copilot to resume processing — attention dot should disappear
    // Give it up to 20 seconds for the status to change
    let cleared = false
    for (let i = 0; i < 10; i++) {
      await page.waitForTimeout(2000)
      const stillPulsing = await page.locator('.animate-pulse-fast').count()
      if (stillPulsing === 0) {
        cleared = true
        break
      }
    }

    await page.screenshot({ path: 'tests/screenshots/needs-input-07-cleared.png' })
    expect(cleared).toBe(true)
  })
})
