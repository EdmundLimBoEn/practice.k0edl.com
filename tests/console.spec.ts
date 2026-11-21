import { test, expect, type Page } from '@playwright/test'
const snapshot = (p: Page) => p.evaluate(() => (window as any).__practice)
const vfo = async (p: Page, v: string) => {
  await p.locator('#frequency').fill(v)
  await p.locator('#frequency').press('Enter')
}
const target = async (p: Page) =>
  (await snapshot(p)).stations.find((s: any) => s.f === 7250000)
test.beforeEach(async ({ page }) => {
  await page.goto('/')
})
test('AT1/7 · static receive-only console, local assets and real worklet', async ({
  page,
}) => {
  const external: string[] = [],
    errors: string[] = []
  page.on('request', (r) => {
    if (!r.url().startsWith('http://127.0.0.1:4173/')) external.push(r.url())
  })
  page.on('pageerror', (e) => errors.push(e.message))
  await page.addInitScript(() => {
    ;(window as any).mic = 0
    navigator.mediaDevices.getUserMedia = async () => {
      ;(window as any).mic++
      throw Error('Unexpected microphone request')
    }
  })
  await page.reload()
  await expect(
    page.getByRole('heading', { name: '40 m LSB Phone' }),
  ).toBeVisible()
  await expect(
    page.getByRole('button', { name: /PTT|VOX|transmit|rotator|log in/i }),
  ).toHaveCount(0)
  await page.click('#audio')
  await expect(page.locator('#audio')).toHaveText('Audio on')
  expect((await snapshot(page)).audio).toBe('running')
  await page.click('#audio')
  await expect(page.locator('#audio')).toHaveText('Audio off')
  expect(await page.evaluate(() => (window as any).mic)).toBe(0)
  expect(external).toEqual([])
  expect(errors).toEqual([])
})
test('AT2/3/4 · tune carrier, invert sideband and offset pitch', async ({
  page,
}) => {
  const box = (await page.locator('canvas').boundingBox())!
  await page.mouse.click(box.x + box.width * 0.5, box.y + 60)
  expect(await target(page)).toMatchObject({
    offset: 0,
    inverted: false,
    inPassband: true,
  })
  await page.click('#mUSB')
  expect(await target(page)).toMatchObject({ inverted: true, inPassband: true })
  await page.click('#mLSB')
  await vfo(page, '7250.2')
  expect(await target(page)).toMatchObject({
    pitchShift: 200,
    inPassband: true,
  })
  await vfo(page, '7.253')
  expect((await target(page)).inPassband).toBe(false)
})
test('AT5 · QRM drill narrows reception while RF neighbours remain in view', async ({
  page,
}) => {
  await page.click('[data-drill="3"]')
  await page.click('#check')
  await expect(page.locator('#feedback')).toContainText('Try again')
  const before = await snapshot(page)
  expect(before.stations[1].energy).toBeGreaterThan(0.1)
  await page.locator('#bw').fill('2100')
  await page.locator('#shift').fill('-200')
  await page.click('#check')
  const after = await snapshot(page)
  for (const st of after.stations.slice(1)) {
    expect(st.inPassband).toBe(false)
    expect(Math.abs(st.f - after.center)).toBeLessThan(after.span / 2)
  }
  await expect(page.locator('#feedback')).toContainText('bonus')
  await expect(page.locator('#points')).toHaveText('2')
  await page.click('#check')
  await expect(page.locator('#points')).toHaveText('2')
})
test('AT6 · hard has deeper fading and higher audible floor', async ({
  page,
}) => {
  const easy = await snapshot(page)
  await page.click('#d2')
  const hard = await snapshot(page)
  expect(hard.noise).toBeLessThan(easy.noise)
  expect(hard.qsb).toBeGreaterThan(easy.qsb)
  expect((await target(page)).inPassband).toBe(true)
  await expect(page.locator('canvas')).toBeVisible()
})
test('FT8, watering hole and both sideband questions', async ({ page }) => {
  await page.click('[data-scene="1"]')
  expect(await snapshot(page)).toMatchObject({ vfo: 7074000, mode: 'FT8' })
  await page.click('[data-drill="0"]')
  await page.click('#pickUSB')
  await page.click('#answer')
  await expect(page.locator('#feedback')).toContainText('LSB')
  await page.click('#pickLSB')
  await page.click('#next')
  await page.click('#pickUSB')
  await expect(page.locator('#feedback')).toContainText('Correct')
  await page.click('[data-drill="2"]')
  await vfo(page, '7074')
  await page.click('#mUSB')
  await page.click('#check')
  await expect(page.locator('#feedback')).toContainText('Correct')
  expect(
    (await snapshot(page)).stations.some((s: any) => s.tone && s.inPassband),
  ).toBe(true)
})
test('FM squelch closes off channel and quieting improves at centre', async ({
  page,
}) => {
  await page.click('[data-scene="6"]')
  const central = (await snapshot(page)).stations[0]
  expect(central.squelched).toBe(false)
  await vfo(page, '146.525')
  await page.locator('#sql').fill('80')
  const off = (await snapshot(page)).stations[0]
  expect(off.squelched).toBe(true)
  expect(off.quieting).toBeLessThan(central.quieting)
})
test('mobile nav, pan, pointer zoom, overlay and typed MHz', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.click('#nav')
  await page.click('[data-scene="2"]')
  await vfo(page, '14.300')
  await page.selectOption('#plan', { label: 'IARU R3' })
  const box = (await page.locator('canvas').boundingBox())!,
    x = box.x + box.width * 0.3,
    y = box.y + 60
  await page.mouse.move(x, y)
  await page.mouse.wheel(0, -180)
  await expect.poll(async () => (await snapshot(page)).span).toBeLessThan(90000)
  const mid = (await snapshot(page)).center
  await page.mouse.down()
  await page.mouse.move(x + 32, y, { steps: 5 })
  await page.mouse.up()
  expect((await snapshot(page)).center).not.toBe(mid)
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(
    390,
  )
})
test('loads a same-origin voice recording from the manifest', async ({
  page,
}) => {
  const rate = 48000,
    length = rate,
    wav = Buffer.alloc(44 + length * 2)
  wav.write('RIFF')
  wav.writeUInt32LE(wav.length - 8, 4)
  wav.write('WAVEfmt ', 8)
  wav.writeUInt32LE(16, 16)
  wav.writeUInt16LE(1, 20)
  wav.writeUInt16LE(1, 22)
  wav.writeUInt32LE(rate, 24)
  wav.writeUInt32LE(rate * 2, 28)
  wav.writeUInt16LE(2, 32)
  wav.writeUInt16LE(16, 34)
  wav.write('data', 36)
  wav.writeUInt32LE(length * 2, 40)
  for (let i = 0; i < length; i++)
    wav.writeInt16LE(
      Math.round(8000 * Math.sin((2 * Math.PI * 750 * i) / rate)),
      44 + i * 2,
    )
  await page.route('**/audio/manifest.json', (r) =>
    r.fulfill({ json: { voice: ['sample.wav'] } }),
  )
  await page.route('**/audio/voice/sample.wav', (r) =>
    r.fulfill({ body: wav, contentType: 'audio/wav' }),
  )
  await page.click('#audio')
  await expect(page.locator('#audio')).toHaveText('Audio on')
  await expect(page.locator('#source')).toHaveText('Recorded audio')
})
test('touch tap and pinch update the VFO and RF viewport', async ({
  browser,
}) => {
  const ctx = await browser.newContext({
    viewport: { width: 390, height: 844 },
    hasTouch: true,
    isMobile: true,
  })
  try {
    const p = await ctx.newPage()
    await p.goto('http://127.0.0.1:4173')
    const box = (await p.locator('canvas').boundingBox())!
    const x = box.x + box.width * 0.4,
      y = box.y + 75
    await p.touchscreen.tap(x, y)
    expect((await snapshot(p)).vfo).toBeLessThan(7250000)
    const cdp = await ctx.newCDPSession(p)
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchStart',
      touchPoints: [
        { x, y },
        { x: x + 50, y },
      ],
    })
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchMove',
      touchPoints: [
        { x: x - 25, y },
        { x: x + 75, y },
      ],
    })
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchEnd',
      touchPoints: [],
    })
    expect((await snapshot(p)).span).toBeLessThan(90000)
  } finally {
    await ctx.close()
  }
})

test('tuning and fine-tuning drills grade the original target', async ({
  page,
}) => {
  await page.click('[data-drill="1"]')
  await vfo(page, '14.260')
  await page.click('#check')
  await expect(page.locator('#feedback')).toContainText('Try again')
  await vfo(page, '7.250')
  await page.click('#mLSB')
  await page.click('#check')
  await expect(page.locator('#feedback')).toContainText('Correct')
  await page.click('[data-drill="4"]')
  await page.click('#check')
  await expect(page.locator('#feedback')).toContainText('Try again')
  await vfo(page, '7250.02')
  await page.click('[data-step="-10"]')
  await page.click('#check')
  await expect(page.locator('#feedback')).toContainText('Correct')
  await page.reload()
  await page.click('[data-drill="4"]')
  await expect(page.locator('#points')).toHaveText('2')
})
