import { neighbours } from '../dsp/background'
import worklet from '../dsp/ssb-worklet?worker&url'
import { analytic, synthetic, clipRate, type Clip } from '../dsp/analytic'
import type { Settings } from './model'
import type { Station } from '../band/scenes'

export async function recording(name: string) {
  const response = await fetch('/audio/voice/' + encodeURIComponent(name), {
    redirect: 'error',
  })
  if (!response.ok) throw Error('Clip unavailable')
  // Decode at the DSP rate so the browser resampler anti-aliases the recording.
  const decoder = new OfflineAudioContext(1, 1, clipRate)
  const buffer = await decoder.decodeAudioData(await response.arrayBuffer())
  const length = buffer.length
  const samples = new Float32Array(2 ** Math.ceil(Math.log2(length)))
  samples.set(buffer.getChannelData(0).subarray(0, length))
  return analytic(samples, length)
}
export class Audio {
  ctx?: AudioContext
  node?: AudioWorkletNode
  private manifest: { id: string; files: { ogg: string; m4a: string } }[] = []
  private requested = new Set<string>()
  private loaded = new Set<string>()
  constructor(private changed: () => void) {}
  hasRecording(station?: Station) {
    return this.loaded.has(station?.clipId ?? '')
  }
  private async load(id: string) {
    if (this.requested.has(id)) return
    this.requested.add(id)
    const entry = this.manifest.find((e) => e.id === id)
    if (!entry) return
    const formats = document
      .createElement('audio')
      .canPlayType('audio/ogg; codecs="opus"')
      ? [entry.files.ogg, entry.files.m4a]
      : [entry.files.m4a]
    for (const file of formats) {
      if (!/^[a-z0-9-]+\.(ogg|m4a)$/.test(file)) continue
      try {
        const clip = await recording(file)
        this.node!.port.postMessage({ id, recording: clip }, [
          clip.re.buffer,
          clip.im.buffer,
        ])
        this.loaded.add(id)
        this.changed()
        return
      } catch {
        /* Try the fallback encoding, then keep the formant voice. */
      }
    }
  }
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
    try {
      const response = await fetch('/audio/manifest.json', {
        redirect: 'error',
      })
      const manifest = await response.json()
      if (Array.isArray(manifest.clips)) this.manifest = manifest.clips
    } catch {
      /* The receiver can start with synthetic voices. */
    }
    for (let i = 1; i <= 5; i++) clips.push(synthetic(i))
    this.node = new AudioWorkletNode(this.ctx, 'practice-receiver', {
      numberOfInputs: 0,
      numberOfOutputs: 1,
      outputChannelCount: [1],
    })
    this.node.port.postMessage({ clips })
    this.node.connect(this.ctx.destination)
  }
  update(state: Settings, stations: Station[]) {
    if (!this.node) return
    for (const st of state.backgroundQrm
      ? [...stations, ...neighbours(stations)]
      : stations) {
      if (st.clipId && Math.abs(st.f - state.vfo) < 13000)
        void this.load(st.clipId)
    }
    this.node.port.postMessage({ state, stations, time: Date.now() / 1000 })
  }
}
