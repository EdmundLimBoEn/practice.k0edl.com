import worklet from '../dsp/ssb-worklet?worker&url'
import { analytic, synthetic, clipRate, type Clip } from '../dsp/analytic'
import type { Settings } from './model'
import type { Station } from '../band/scenes'

async function recordingNames(): Promise<string[]> {
  try {
    const response = await fetch('/audio/manifest.json', { redirect: 'error' })
    const { voice } = await response.json()
    return Array.isArray(voice)
      ? voice
          .filter(
            (name): name is string =>
              typeof name === 'string' &&
              !name.includes('/') &&
              !name.includes('\\'),
          )
          .slice(0, 8)
      : []
  } catch {
    return []
  }
}
async function recording(name: string) {
  const response = await fetch('/audio/voice/' + encodeURIComponent(name), {
    redirect: 'error',
  })
  if (!response.ok) throw Error('Clip unavailable')
  // Decode at the DSP rate so the browser resampler anti-aliases the recording.
  const decoder = new OfflineAudioContext(1, 1, clipRate)
  const buffer = await decoder.decodeAudioData(await response.arrayBuffer())
  const length = Math.min(buffer.length, 2 ** 19)
  const samples = new Float32Array(2 ** Math.ceil(Math.log2(length)))
  samples.set(buffer.getChannelData(0).subarray(0, length))
  return analytic(samples, length)
}
export class Audio {
  ctx?: AudioContext
  node?: AudioWorkletNode
  recorded = false
  generated = false
  async toggle() {
    if (this.node && this.ctx) {
      if (this.ctx.state === 'running') await this.ctx.suspend()
      else await this.ctx.resume()
      return
    }
    this.ctx ??= new AudioContext()
    await this.ctx.resume()
    await this.ctx.audioWorklet.addModule(worklet)
    const clips: Clip[] = []
    for (const file of await recordingNames()) {
      try {
        clips.push(await recording(file))
        this.recorded = true
        this.generated ||= file.startsWith('tts-')
      } catch {
        /* A missing or unsupported recording leaves other sources available. */
      }
    }
    if (!clips.length) for (let i = 1; i <= 5; i++) clips.push(synthetic(i))
    this.node = new AudioWorkletNode(this.ctx, 'practice-receiver', {
      numberOfInputs: 0,
      numberOfOutputs: 1,
      outputChannelCount: [1],
    })
    this.node.port.postMessage({ clips })
    this.node.connect(this.ctx.destination)
  }
  update(state: Settings, stations: Station[]) {
    this.node?.port.postMessage({ state, stations, time: Date.now() / 1000 })
  }
}
