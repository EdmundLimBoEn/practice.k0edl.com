import { createHash } from 'node:crypto'
import {
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
  renameSync,
  appendFileSync,
} from 'node:fs'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

process.chdir(fileURLToPath(new URL('../', import.meta.url)))
const cache = '.tts-cache',
  output = 'public/audio/voice'
for (const dir of [cache, output]) mkdirSync(dir, { recursive: true })
const scripts = JSON.parse(readFileSync('scripts/qso-scripts.json'))
const manifestPath = 'public/audio/manifest.json'
const manifest = JSON.parse(readFileSync(manifestPath))
const entries = manifest.clips ?? []
const selected = process.argv.slice(2).filter((arg) => arg !== '--force')
const ffmpeg = (...args) =>
  execFileSync('ffmpeg', ['-nostdin', '-loglevel', 'error', '-y', ...args])
if (selected.some((id) => !scripts.some((q) => q.id === id)))
  throw Error('Unknown clip ID')
for (const q of scripts.filter(
  (q) => !selected.length || selected.includes(q.id),
)) {
  // Include processing settings when revising the shipped audio format.
  const fingerprint = createHash('sha256')
    .update('gpt-4o-mini-tts/pipeline-1/' + JSON.stringify(q))
    .digest('hex')
  const published = entries.find((entry) => entry.id === q.id)
  if (
    !process.argv.includes('--force') &&
    published?.fingerprint === fingerprint &&
    ['ogg', 'm4a'].every((ext) =>
      existsSync(output + '/' + published.files[ext]),
    )
  ) {
    console.log(q.id, published.duration)
    continue
  }
  const list = []
  for (const [i, turn] of q.turns.entries()) {
    const request = {
      model: 'gpt-4o-mini-tts',
      response_format: 'wav',
      input: turn.text,
      ...q.speakers[turn.callsign],
    }
    const hash = createHash('sha256')
      .update(JSON.stringify(request))
      .digest('hex')
    const raw = cache + '/' + hash + '.wav'
    if (!existsSync(raw) || process.argv.includes('--force')) {
      if (!process.env.OPENAI_API_KEY) throw Error('Missing speech credential')
      const response = await fetch('https://api.openai.com/v1/audio/speech', {
        method: 'POST',
        redirect: 'error',
        headers: {
          Authorization: 'Bearer ' + process.env.OPENAI_API_KEY,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(request),
      })
      appendFileSync(
        cache + '/usage.jsonl',
        JSON.stringify({
          id: q.id,
          characters: turn.text.length,
          status: response.status,
        }) + '\n',
      )
      if (!response.ok) throw Error('Speech HTTP ' + response.status)
      writeFileSync(raw + '.tmp', Buffer.from(await response.arrayBuffer()))
      renameSync(raw + '.tmp', raw)
    }
    const file = hash + '-' + i + '.wav'
    ffmpeg(
      '-i',
      raw,
      '-af',
      'loudnorm=I=-16:TP=-1.5:LRA=7,apad=pad_dur=' +
        [0.8, 0.65, 1, 0.85, 1.1][i % 5],
      '-ar',
      '24000',
      '-ac',
      '1',
      cache + '/' + file,
    )
    list.push("file '" + file + "'")
  }
  const playlist = cache + '/' + q.id + '.txt'
  writeFileSync(playlist, list.join('\n'))
  const files = {}
  for (const [ext, codec] of [
    ['ogg', 'libopus'],
    ['m4a', 'aac'],
  ]) {
    files[ext] = q.id + '.' + ext
    ffmpeg(
      '-f',
      'concat',
      '-safe',
      '1',
      '-i',
      playlist,
      '-af',
      'loudnorm=I=-16:TP=-1.5:LRA=7',
      '-ar',
      '24000',
      '-ac',
      '1',
      '-c:a',
      codec,
      '-b:a',
      ext === 'ogg' ? '28k' : '48k',
      output + '/' + files[ext],
    )
  }
  const duration = Number(
    execFileSync('ffprobe', [
      '-v',
      'error',
      '-show_entries',
      'format=duration',
      '-of',
      'csv=p=0',
      output + '/' + files.ogg,
    ]),
  )
  const entry = {
    id: q.id,
    scene: q.scene,
    role: q.role,
    files,
    duration,
    fingerprint,
    script: 'scripts/qso-scripts.json#' + q.id,
  }
  const index = entries.findIndex((e) => e.id === q.id)
  if (index === -1) entries.push(entry)
  else entries[index] = entry
  writeFileSync(
    manifestPath + '.tmp',
    JSON.stringify({ clips: entries }, null, 2) + '\n',
  )
  renameSync(manifestPath + '.tmp', manifestPath)
  console.log(q.id, duration)
}
