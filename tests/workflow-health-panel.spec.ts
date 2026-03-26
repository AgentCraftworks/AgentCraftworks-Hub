import { test, expect, _electron as electron, type ElectronApplication, type Page } from '@playwright/test'
import fs from 'fs'
import path from 'path'

let app: ElectronApplication
let page: Page

const mainEntry = path.join(process.cwd(), 'out/main/index.js')

test.describe('WorkflowHealthPanel', () => {
  test.skip(!fs.existsSync(mainEntry), 'Requires Electron build output at out/main/index.js')

  test.beforeAll(async () => {
    app = await electron.launch({
      args: [mainEntry],
      env: {
        ...process.env,
        NODE_ENV: 'test',
      },
    })
    page = await app.firstWindow()
    await page.waitForTimeout(3_000)
  })

  test.afterAll(async () => {
    await app?.close().catch(() => {})
  })

  test('renders workflow health panel in Hub dashboard', async () => {
    await page.getByRole('button', { name: 'GitHub Usage' }).click()
    await expect(page.getByText('Workflow Health')).toBeVisible()
    await expect(page.getByText('Last 24h workflow outcomes')).toBeVisible()
    await expect(page.getByText('Total runs')).toBeVisible()
    await expect(page.getByText('Pending approvals')).toBeVisible()

    await page.screenshot({ path: 'tests/screenshots/workflow-health-panel.png' })
  })
})
