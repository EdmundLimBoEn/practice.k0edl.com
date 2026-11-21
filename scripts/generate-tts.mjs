import { createHash } from 'node:crypto'
import {
  appendFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  writeFileSync,
} from 'node:fs'
import { execFileSync, spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

process.chdir(fileURLToPath(new URL('../', import.meta.url)))
const cache = '.tts-cache/v3'
mkdirSync(cache, { recursive: true })
const json = (path) => JSON.parse(readFileSync(path))
const hash = (data) => createHash('sha256').update(data).digest('hex')
const save = (path, data) => {
  writeFileSync(path + '.tmp', data)
  renameSync(path + '.tmp', path)
}
const manifestPath = 'public/audio/manifest.json'
const manifest = json(manifestPath)
const scripts = json('scripts/qso-scripts.json')
const pipeline = hash(readFileSync(fileURLToPath(import.meta.url)))
const sourceHash = (q) => hash(pipeline + JSON.stringify(q))
const args = process.argv.slice(2)
const flags = args.filter((a) => a.startsWith('--'))
if (flags.some((a) => !/^--retake=[1-9]\d*$/.test(a)) || flags.length > 1)
  throw Error('Use clip IDs and optionally --retake=N')
const retake = flags[0]?.split('=')[1]
const ids = args.filter((a) => !a.startsWith('--'))
if (retake && (ids.length !== 1 || !/^[1-9]\d*$/.test(retake)))
  throw Error('Specify one clip and --retake=N (one-based over)')
const selected = scripts.filter((q) => !ids.length || ids.includes(q.id))
if (
  ids.some((id) => !selected.some((q) => q.id === id)) ||
  (retake && +retake > selected[0].turns.length)
)
  throw Error('Unknown clip or over')
const duration = (file) =>
  Number(
    execFileSync('ffprobe', [
      '-v',
      'error',
      '-show_entries',
      'format=duration',
      '-of',
      'csv=p=0',
      file,
    ]),
  )
const ff = (...args) =>
  execFileSync('ffmpeg', ['-nostdin', '-loglevel', 'error', '-y', ...args], {
    maxBuffer: 16 * 1024 * 1024,
  })
const meter = (file, filter) => {
  const r = spawnSync(
    'ffmpeg',
    ['-nostdin', '-nostats', '-i', file, '-af', filter, '-f', 'null', '-'],
    { encoding: 'utf8' },
  )
  if (r.status) throw Error('FFmpeg measurement failed')
  return r.stderr
}
async function take(q, turn, i) {
  const { voice, instructions } = q.speakers[turn.callsign]
  const system =
    'You are a voice actor playing an experienced ham aged 55 to 75. ' +
    instructions +
    ' Talk straight to a friend at the other end. Brisk and upbeat, about 165 words a minute. Link words into long breath groups, toss off phonetics quickly, let your pitch move with the story. No announcer cadence. Clean close mic. Read the line exactly word for word, nothing added.'
  const user = 'Say this: ' + turn.text
  const request = {
    model: 'gpt-audio-1.5',
    modalities: ['text', 'audio'],
    audio: { voice, format: 'wav' },
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: user },
    ],
  }
  const file = cache + '/' + hash(JSON.stringify(request)) + '.wav'
  if (existsSync(file) && +retake !== i + 1) return file
  if (!process.env.OPENAI_API_KEY) throw Error('Missing synthesis credential')
  const r = await fetch('https://api.openai.com/v1/chat/completions', {
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
      over: i + 1,
      model: request.model,
      characters: system.length + user.length,
      spoken: turn.text.length,
      status: r.status,
    }) + '\n',
  )
  if (!r.ok)
    throw Error('Speech HTTP ' + r.status + ' for ' + q.id + ' over ' + (i + 1))
  const data = Buffer.from(
    (await r.json()).choices[0].message.audio.data,
    'base64',
  )
  if (data.toString('ascii', 0, 4) !== 'RIFF') throw Error('Invalid WAV')
  save(file, data)
  return file
}
// Give short, existing breath breaks time to register after tempo adjustment.
// Pad only quiet runs. A minimum separation keeps syllables in one breath group.
function spaceBreaths(file) {
  const pcm = ff(
    '-i',
    file,
    '-f',
    's16le',
    '-ac',
    '1',
    '-ar',
    '24000',
    'pipe:1',
  )
  const frame = 240
  const levels = []
  for (let offset = 0; offset + 2 * frame <= pcm.length; offset += 2 * frame) {
    let power = 0
    for (let n = 0; n < frame; n++)
      power += (pcm.readInt16LE(offset + 2 * n) / 32768) ** 2
    levels.push(10 * Math.log10(power / frame + 1e-12))
  }
  const sorted = [...levels].sort((a, b) => a - b)
  const threshold = sorted[Math.floor(sorted.length * 0.95)] - 31
  const chunks = []
  let from = 0,
    previous = -200
  for (let i = 0; i < levels.length;) {
    if (levels[i] >= threshold) {
      i++
      continue
    }
    const start = i
    while (i < levels.length && levels[i] < threshold) i++
    const length = i - start
    if (
      length < 8 ||
      start < 10 ||
      i + 10 >= levels.length ||
      start - previous < 170
    )
      continue
    previous = i
    if (length >= 25) continue
    let quietest = start
    for (let j = start + 1; j < i; j++)
      if (levels[j] < levels[quietest]) quietest = j
    let cut = quietest * frame * 2
    // Cut at the smallest sample in the quiet frame to avoid a click.
    for (let j = cut; j < (quietest + 1) * frame * 2; j += 2)
      if (Math.abs(pcm.readInt16LE(j)) < Math.abs(pcm.readInt16LE(cut))) cut = j
    chunks.push(
      pcm.subarray(from, cut),
      Buffer.alloc((25 - length) * frame * 2),
    )
    from = cut
  }
  return Buffer.concat([...chunks, pcm.subarray(from)])
}
function render(q, raws) {
  let seed = parseInt(hash(q.id).slice(0, 8), 16)
  const random = () =>
    (seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 2 ** 32
  const stations = Object.keys(q.speakers)
  const delta = 4 + random() * 2
  const turns = []
  let end = 0
  const parts = raws.map((raw, i) => {
    const t = q.turns[i],
      second = t.callsign === stations[1]
    const trim =
      'silenceremove=start_periods=1:start_threshold=-50dB:start_silence=0.025'
    const dry = cache + '/' + q.id + '-dry.wav'
    ff(
      '-i',
      raw,
      '-af',
      trim + ',areverse,' + trim + ',areverse',
      '-ar',
      '24000',
      '-ac',
      '1',
      dry,
    )
    const wpm = (t.text.split(/\s+/).length * 60) / duration(dry)
    const target = q.turns[i].text.split(/\s+/).length < 42 ? 185 : 175
    const tempo = Math.max(
      0.74,
      Math.min(1.25, wpm < 145 ? Math.max(1.1, 165 / wpm) : target / wpm),
    )
    const hp = second ? 250 : 235,
      lp = second ? 2800 : 2980
    const chain = [
      'atempo=' + tempo,
      'highpass=f=' + hp,
      'highpass=f=' + hp,
      'lowpass=f=' + lp,
      'lowpass=f=' + lp,
      'equalizer=f=235:t=o:w=1.5:g=' +
        ([
          '20v-dx',
          '40v-portable',
          '15v-dx',
          '2v-repeater',
          '20v-domestic',
        ].includes(q.id)
          ? -14
          : -11),
      'bass=f=145:g=' + (['20v-dx', '40v-portable'].includes(q.id) ? -5 : 0),
      'equalizer=f=1800:t=q:w=1:g=4',
      'acompressor=threshold=-24dB:ratio=6:attack=5:release=80',
    ].join(',')
    const shaped = cache + '/' + q.id + '-shaped.wav'
    ff('-i', dry, '-af', chain, shaped)
    const rms = Number(
      meter(shaped, 'volumedetect').match(/mean_volume: ([-.\d]+)/)[1],
    )
    const spaced = spaceBreaths(shaped)
    const pcmFile = cache + '/' + q.id + '-spaced.pcm'
    writeFileSync(pcmFile, spaced)
    const length = spaced.length / 48000
    const gap = /\bCQ\b/i.test(t.text) ? 2 + 2 * random() : 1 + random()
    const limited = cache + '/' + q.id + '-limited.wav'
    ff(
      '-f',
      's16le',
      '-ar',
      '24000',
      '-ac',
      '1',
      '-i',
      pcmFile,
      '-af',
      'agate=threshold=0.009:ratio=3:attack=2:release=30,volume=' +
        (-18 - rms) +
        'dB,alimiter=limit=0.28:release=20:level=false:latency=true',
      limited,
    )
    const limitedRms = Number(
      meter(limited, 'volumedetect').match(/mean_volume: ([-.\d]+)/)[1],
    )
    const name = q.id + '-' + i + '.wav'
    ff(
      '-i',
      limited,
      '-af',
      'volume=' +
        (-22 - (second ? delta : 0) - limitedRms) +
        'dB,apad=pad_dur=' +
        gap,
      cache + '/' + name,
    )
    turns.push({
      callsign: t.callsign,
      start: end,
      end: end + length,
      rawWpm: wpm,
      tempo,
    })
    end += duration(cache + '/' + name)
    return "file '" + name + "'"
  })
  const playlist = cache + '/' + q.id + '.txt',
    mix = cache + '/' + q.id + '-mix.wav'
  save(playlist, parts.join('\n'))
  ff('-f', 'concat', '-safe', '1', '-i', playlist, '-c', 'copy', mix)
  const norm = 'loudnorm=I=-16:LRA=15:TP=-1'
  const stats = JSON.parse(
    meter(mix, norm + ':print_format=json').match(
      /\{[^{}]*"input_i"[^{}]*\}/,
    )[0],
  )
  const normalized = cache + '/' + q.id + '-master.wav'
  ff(
    '-i',
    mix,
    '-af',
    norm +
      ':linear=true:measured_I=' +
      stats.input_i +
      ':measured_LRA=' +
      stats.input_lra +
      ':measured_TP=' +
      stats.input_tp +
      ':measured_thresh=' +
      stats.input_thresh +
      ':offset=' +
      stats.target_offset,
    '-ar',
    '24000',
    normalized,
  )
  const entry = manifest.clips.find((c) => c.id === q.id)
  for (const [ext, codec, rate] of [
    ['ogg', 'libopus', '26k'],
    ['m4a', 'aac', '36k'],
  ])
    ff(
      '-i',
      normalized,
      '-fflags',
      '+bitexact',
      '-c:a',
      codec,
      '-b:a',
      rate,
      'public/audio/voice/' + entry.files[ext],
    )
  entry.source = sourceHash(q)
  entry.overs = turns.map(({ callsign, start, end }) => ({
    callsign,
    start,
    end,
  }))
  entry.duration = duration('public/audio/voice/' + entry.files.ogg)
  entry.fingerprint = hash(JSON.stringify(q) + hash(readFileSync(normalized)))
  save(cache + '/' + q.id + '-turns.json', JSON.stringify(turns))
  save(manifestPath, JSON.stringify(manifest, null, 2) + '\n')
  console.log(q.id, entry.duration)
}
for (const q of selected) {
  const published = manifest.clips.find((c) => c.id === q.id)
  if (
    !retake &&
    published?.source === sourceHash(q) &&
    Object.values(published.files).every((file) =>
      existsSync('public/audio/voice/' + file),
    )
  )
    continue
  const raws = []
  for (let i = 0; i < q.turns.length; i += 2)
    raws.push(
      ...(await Promise.all(
        q.turns.slice(i, i + 2).map((turn, j) => take(q, turn, i + j)),
      )),
    )
  render(q, raws)
}
