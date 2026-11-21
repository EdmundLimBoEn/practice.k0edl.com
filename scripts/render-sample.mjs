// Run from the repository root. Requires local Playwright Chromium and ffmpeg.
import { chromium } from '@playwright/test'
import { createServer } from 'vite'
import { execFileSync, spawnSync } from 'node:child_process'
import { mkdirSync } from 'node:fs'
import { dirname } from 'node:path'

const output = process.argv[2] ?? '/workspace/qso-real/in-app-v4.mp3'
const server = await createServer({
  server: { host: '127.0.0.1', port: 0, hmr: false },
})
let browser
try {
  await server.listen()
  browser = await chromium.launch()
  const page = await browser.newPage()
  await page.goto(server.resolvedUrls.local[0])
  const chunks = []
  await page.exposeFunction('savePCM', (data) =>
    chunks.push(Buffer.from(data, 'base64')),
  )
  await page.evaluate(async () => {
    const { recording } = await import('/src/radio/audio.ts')
    const { scenes } = await import('/src/band/scenes.ts')
    const { defaults } = await import('/src/radio/model.ts')
    const { Receiver } = await import('/src/dsp/core.ts')
    for (const [id, seconds] of [
      ['20v-domestic', 30],
      ['40v-dx', 20],
    ]) {
      const scene = scenes.find((s) => s.id === id.split('-')[0])
      const target =
        scene.stations.find((s) => s.clipId === id && s.f === scene.home) ??
        scene.stations.find((s) => s.clipId === id)
      const context = new OfflineAudioContext(1, seconds * 48000, 48000)
      const receiver = new Receiver(context.sampleRate, [])
      for (const clipId of new Set(
        scene.stations
          .filter((s) => Math.abs(s.f - target.f) < 13000)
          .map((s) => s.clipId),
      )) {
        const clip = await recording(clipId + '.ogg')
        receiver.recordings.set(clipId, clip)
      }
      const state = { ...defaults, vfo: target.f, mode: target.mode }
      const stations = scenes
        .filter((s) => s.band === scene.band)
        .flatMap((s) => s.stations)
      const buffer = context.createBuffer(1, context.length, context.sampleRate)
      const channel = buffer.getChannelData(0)
      for (let i = 0; i < channel.length; i += 128)
        receiver.render(
          channel.subarray(i, i + 128),
          state,
          stations,
          i / context.sampleRate,
        )
      const source = context.createBufferSource()
      source.buffer = buffer
      source.connect(context.destination)
      source.start()
      const audio = (await context.startRendering()).getChannelData(0)
      if (!audio.some((x) => Math.abs(x) > 0.05))
        throw Error('Missing receiver audio: ' + id)
      const pcm = new Uint8Array(audio.buffer)
      for (let i = 0; i < pcm.length; i += 49152)
        await window.savePCM(
          btoa(String.fromCharCode(...pcm.subarray(i, i + 49152))),
        )
    }
  })
  mkdirSync(dirname(output), { recursive: true })
  const input = Buffer.concat(chunks)
  const args = [
    '-hide_banner',
    '-f',
    'f32le',
    '-ar',
    '48000',
    '-ac',
    '1',
    '-i',
    'pipe:0',
  ]
  const filter = 'loudnorm=I=-16:TP=-1:LRA=11'
  const measure = spawnSync(
    'ffmpeg',
    [...args, '-af', filter + ':print_format=json', '-f', 'null', '-'],
    { input, encoding: 'utf8' },
  )
  if (measure.status !== 0) throw Error(measure.stderr)
  const stats = JSON.parse(
    measure.stderr.slice(
      measure.stderr.lastIndexOf('{'),
      measure.stderr.lastIndexOf('}') + 1,
    ),
  )
  const normalize =
    filter +
    ':linear=true' +
    ':measured_I=' +
    stats.input_i +
    ':measured_TP=' +
    stats.input_tp +
    ':measured_LRA=' +
    stats.input_lra +
    ':measured_thresh=' +
    stats.input_thresh +
    ':offset=' +
    stats.target_offset
  execFileSync(
    'ffmpeg',
    [
      ...args,
      '-loglevel',
      'error',
      '-af',
      normalize,
      '-ar',
      '48000',
      '-ac',
      '1',
      '-b:a',
      '128k',
      '-y',
      output,
    ],
    { input },
  )
  console.log(output)
} finally {
  await browser?.close()
  await server.close()
}
