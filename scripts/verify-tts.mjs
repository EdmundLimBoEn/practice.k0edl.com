import { createHash } from 'node:crypto'
import {
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
  appendFileSync,
} from 'node:fs'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
process.chdir(fileURLToPath(new URL('../', import.meta.url)))
mkdirSync('.tts-cache', { recursive: true })
const scripts = JSON.parse(readFileSync('scripts/qso-scripts.json'))
const { clips } = JSON.parse(readFileSync('public/audio/manifest.json'))
const alphabet =
  'alfa bravo charlie delta echo foxtrot golf hotel india juliett kilo lima mike november oscar papa quebec romeo sierra tango uniform victor whiskey xray yankee zulu zero one two three four five six seven eight nine'.split(
    ' ',
  )
const spell = (call) =>
  [...call]
    .map((ch) => alphabet['ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'.indexOf(ch)])
    .join(' ')
const callsigns = scripts.flatMap((q) => Object.keys(q.speakers))
function normalize(s) {
  // STT sometimes inserts a space between a callsign prefix and suffix.
  // Require every letter and digit in order for this equivalence.
  for (const call of callsigns) {
    const pattern = new RegExp('\\b' + [...call].join('\\s*') + '\\b', 'gi')
    s = s.replace(pattern, call)
  }
  return s
    .toLowerCase()
    .replace(/x[ -]ray/g, 'xray')
    .replace(/alpha/g, 'alfa')
    .replace(/juliette?\b/g, 'juliett')
    .replace(/\b73\b/g, 'seventy three')
    .replace(/\b(\d)\b/g, (_, n) => alphabet[26 + Number(n)])
    .replace(/c[. ]q\b/g, 'cq')
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}
function wer(reference, actual) {
  const a = normalize(reference).split(' '),
    b = normalize(actual).split(' ')
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i)
  for (const [i, word] of a.entries()) {
    const row = [i + 1]
    for (const [j, other] of b.entries())
      row.push(
        Math.min(row[j] + 1, prev[j + 1] + 1, prev[j] + Number(word !== other)),
      )
    prev = row
  }
  return prev.at(-1) / a.length
}
async function transcribe(file, q) {
  const data = readFileSync(file)
  const path =
    '.tts-cache/' +
    createHash('sha256').update(data).digest('hex') +
    '.transcript'
  if (existsSync(path)) return readFileSync(path, 'utf8')
  if (!process.env.OPENAI_API_KEY)
    throw Error('Missing transcription credential')
  for (const model of ['gpt-4o-transcribe', 'whisper-1']) {
    const form = new FormData()
    form.append('file', new Blob([data], { type: 'audio/mp4' }), q.id + '.m4a')
    form.append('model', model)
    form.append('language', 'en')
    form.append(
      'prompt',
      'Amateur radio conversation. Transcribe verbatim. Preserve spoken phonetic alphabet words. Write compact station IDs when spoken letter by letter.',
    )
    const response = await fetch(
      'https://api.openai.com/v1/audio/transcriptions',
      {
        method: 'POST',
        redirect: 'error',
        headers: { Authorization: 'Bearer ' + process.env.OPENAI_API_KEY },
        body: form,
      },
    )
    appendFileSync(
      '.tts-cache/usage.jsonl',
      JSON.stringify({
        id: q.id,
        seconds: q.duration,
        status: response.status,
        model,
      }) + '\n',
    )
    if (response.ok) {
      const { text } = await response.json()
      writeFileSync(path, text)
      return text
    }
    if (![400, 403, 404].includes(response.status) || model === 'whisper-1')
      throw Error('Transcription HTTP ' + response.status)
  }
}
function loudness(path) {
  const result = spawnSync(
    'ffmpeg',
    [
      '-nostdin',
      '-i',
      path,
      '-af',
      'loudnorm=print_format=json',
      '-f',
      'null',
      '-',
    ],
    { encoding: 'utf8' },
  )
  if (result.status) throw Error('Loudness measurement failed')
  return Number(
    JSON.parse(result.stderr.match(/\{[^{}]*"input_i"[^{}]*\}/)[0]).input_i,
  )
}
const rows = []
let failed = false
for (const q of clips) {
  const script = scripts.find((s) => s.id === q.id)
  const path = (ext) => 'public/audio/voice/' + q.files[ext]
  const transcript = await transcribe(path('m4a'), q)
  const error = wer(script.turns.map((t) => t.text).join(' '), transcript)
  const missing = Object.keys(script.speakers).filter(
    (call) => !normalize(transcript).includes(spell(call)),
  )
  const levels = ['ogg', 'm4a'].map((ext) => loudness(path(ext)))
  failed ||=
    error > 0.1 ||
    missing.length > 0 ||
    levels.some((v) => Math.abs(v + 16) > 1.5)
  rows.push([
    q.id,
    (error * 100).toFixed(1) + '%',
    missing.join(', ') || 'OK',
    ...levels,
    q.duration.toFixed(1),
  ])
  console.log(q.id, q.duration)
}
writeFileSync(
  'docs/tts-verification.md',
  '# Speech verification\n\nThe AAC transcript is compared with the ordered script. Both encodings are measured independently. Phonetics requires each full callsign spelling in order.\n\n| Clip | WER | Missing phonetics | Opus LUFS | AAC LUFS | Seconds |\n|---|---:|---|---:|---:|---:|\n' +
    rows.map((r) => '| ' + r.join(' | ') + ' |').join('\n') +
    '\n',
)
if (failed || clips.length !== scripts.length) process.exitCode = 1
