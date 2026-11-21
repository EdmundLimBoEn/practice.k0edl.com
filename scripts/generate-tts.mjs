import { readFile, writeFile, rename, mkdir } from 'node:fs/promises'
const key = process.env.OPENAI_API_KEY
if (!key) {
  console.log('No OPENAI_API_KEY set. Keeping the existing audio manifest.')
  process.exit(0)
}
const root = new URL('../public/audio/', import.meta.url),
  manifestPath = new URL('manifest.json', root)
const manifest = JSON.parse(await readFile(manifestPath, 'utf8'))
await mkdir(new URL('voice/', root), { recursive: true })
for (const line of JSON.parse(
  await readFile(new URL('qso-scripts.json', import.meta.url), 'utf8'),
)) {
  if (!/^[a-z0-9-]+$/.test(line.id)) throw Error('Invalid clip ID')
  const filename = 'tts-' + line.id + '.opus',
    path = new URL('voice/' + filename, root)
  const r = await fetch('https://api.openai.com/v1/audio/speech', {
    method: 'POST',
    headers: {
      Authorization: 'Bearer ' + key,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini-tts',
      voice: line.voice,
      input: line.text,
      response_format: 'opus',
    }),
  })
  if (!r.ok) throw Error('Speech generation failed with HTTP ' + r.status)
  const temp = new URL(path + '.tmp')
  await writeFile(temp, new Uint8Array(await r.arrayBuffer()))
  await rename(temp, path)
  if (!manifest.voice.includes(filename)) manifest.voice.push(filename)
  const tmp = new URL(manifestPath + '.tmp')
  await writeFile(tmp, JSON.stringify(manifest, null, 2) + '\n')
  await rename(tmp, manifestPath)
}
