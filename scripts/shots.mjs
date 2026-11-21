import { chromium } from '@playwright/test'
import { preview } from 'vite'
import { mkdir } from 'node:fs/promises'
const server = await preview({ preview: { host: '127.0.0.1', port: 0 } })
let browser
try {
  browser = await chromium.launch()
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
  await page.goto(server.resolvedUrls.local[0])
  await page.evaluate(() => document.fonts.ready)
  await mkdir('shots', { recursive: true })
  async function shot(name) {
    await page.evaluate(() => window.scrollTo(0, 0))
    await page.mouse.move(0, 0)
    await page.waitForTimeout(350)
    await page.screenshot({ path: 'shots/' + name + '.png' })
  }
  await shot('01-console')
  await page.click('#plus')
  await page.click('#plus')
  await shot('02-voice-tuned')
  await page.click('[data-scene="1"]')
  await page.waitForFunction(() => {
    const second = (Date.now() / 1000) % 15
    return second > 5 && second < 12
  })
  await shot('03-ft8')
  await page.click('[data-drill="0"]')
  await shot('04-sideband-exercise')
  await page.click('[data-scene="6"]')
  await shot('05-fm')
  await page.click('[data-drill="3"]')
  for (const [id, v] of [
    ['bw', 2100],
    ['shift', -200],
  ])
    await page.locator('#' + id).fill(String(v))
  await shot('06-qrm-filter-drill')
  await page.click('[data-scene="0"]')
  await page.setViewportSize({ width: 390, height: 844 })
  await shot('07-mobile')
} finally {
  await browser?.close()
  await server.close()
}
