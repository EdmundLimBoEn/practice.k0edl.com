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
mkdirSync('.tts-cache/v3', { recursive: true })
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
async function transcribe(file, q, model) {
  const data = readFileSync(file)
  const path =
    '.tts-cache/v3/' +
    createHash('sha256').update(data).digest('hex') +
    '-' +
    model +
    '.json'
  if (existsSync(path)) return JSON.parse(readFileSync(path))
  if (!process.env.OPENAI_API_KEY)
    throw Error('Missing transcription credential')
  const form = new FormData()
  form.append('file', new Blob([data], { type: 'audio/mp4' }), q.id + '.m4a')
  form.append('model', model)
  form.append('language', 'en')
  if (model === 'whisper-1') {
    form.append('response_format', 'verbose_json')
    form.append('timestamp_granularities[]', 'word')
  } else {
    form.append(
      'prompt',
      'Amateur radio conversation. Transcribe verbatim. Preserve spoken phonetic alphabet words.',
    )
  }
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
    '.tts-cache/v3/usage.jsonl',
    JSON.stringify({
      id: q.id,
      seconds: q.duration,
      model,
      status: response.status,
    }) + '\n',
  )
  if (!response.ok) throw Error(model + ' HTTP ' + response.status)
  const answer = await response.json()
  writeFileSync(path, JSON.stringify(answer))
  return answer
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
const ids = process.argv.slice(2)
for (const q of clips.filter((c) => !ids.length || ids.includes(c.id))) {
  const script = scripts.find((s) => s.id === q.id)
  const path = (ext) => 'public/audio/voice/' + q.files[ext]
  const [{ text: transcript }] = await Promise.all(
    ['gpt-4o-transcribe', 'whisper-1'].map((model) =>
      transcribe(path('m4a'), q, model),
    ),
  )
  const measured = spawnSync(
    process.env.VOICE_PYTHON || 'python3',
    ['scripts/measure-voices.py', q.id],
    { encoding: 'utf8' },
  )
  if (measured.status !== 0) throw Error(measured.stderr)
  const metrics = JSON.parse(measured.stdout)

  const reference = script.turns.map((t) => t.text).join(' ')
  const error = wer(reference, transcript)
  const expected = normalize(reference)
  const spoken = normalize(transcript)
  const missing = Object.keys(script.speakers).filter((call) => {
    const phonetics = spell(call)
    const count = expected.split(phonetics).length - 1
    return count < 1 || spoken.split(phonetics).length - 1 < count
  })
  const levels = ['ogg', 'm4a'].map((ext) => loudness(path(ext)))
  failed ||=
    error > 0.1 ||
    missing.length > 0 ||
    levels.some((v) => Math.abs(v + 16) > 1.5)
  rows.push([
    q.id,
    ...metrics.map((v, i) => v.toFixed([0, 0, 1, 0, 0, 2, 1, 1, 1][i])),
    (error * 100).toFixed(1) + '%',
    missing.join(', ') || 'OK',
    ...levels,
    q.duration.toFixed(1),
  ])
  console.log(q.id, q.duration)
}
const table = [
  '| Clip | WPM | Artic. WPM | Pauses/min | Median ms | f0 Hz | SD st | <300 Hz % | LF dB | Station Δ dB | WER | Phonetics | Opus LUFS | AAC LUFS | Seconds |',
  '|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---|---:|---:|---:|',
  '| Real excerpts | 152–163 | 168–180 | 19.5–26.3 | 200–290 | 128–165 | 4.93–5.38 | 4.2–4.6 | −26 to −21 | — | — | — | — | — | — |',
  ...rows.map((r) => '| ' + r.join(' | ') + ' |'),
].join('\n')
console.log(table)
if (!ids.length)
  writeFileSync(
    'docs/tts-verification.md',
    '# Speech verification\n\n' +
      table +
      '\n\nRates use Whisper word timestamps on final AAC. Articulation caps interword gaps at 0.5 s. Pitch and energy use decoded Opus at 16 kHz. Pauses use 20 ms RMS frames and the reference adaptive threshold, including handoffs. LF compares 60–150 Hz with 300–600 Hz. Station separation compares RMS across complete overs, excluding handoff gaps. The 3–8 dB station separation is a design target. Pitch summaries pool both speakers.\n\nWER uses a separate GPT-4o transcription. The phonetics check counts each ordered full spelling against the script. Loudness is measured independently after encoding.\n',
  )
if (failed || clips.length !== scripts.length) process.exitCode = 1
