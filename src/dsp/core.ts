import { clipRate, type Clip } from './analytic'
import { symbolAt, symbols } from './ft8'
import type { Station } from '../band/scenes'
import { edges, fade, observe, type Settings } from '../radio/model'
// Fourth-order Butterworth low pass, two independent lanes for complex I/Q.
class Section {
  x = 0
  y = 0
  constructor(
    public b: number,
    public a1: number,
    public a2: number,
  ) {}
  run(v: number) {
    const out = this.b * v + this.x
    this.x = 2 * this.b * v - this.a1 * out + this.y
    this.y = this.b * v - this.a2 * out
    return out
  }
}
function stages(cut: number, rate: number) {
  return [0.541196, 1.306563].map((q) => {
    const k = Math.tan((Math.PI * cut) / rate),
      norm = 1 / (1 + k / q + k * k)
    return new Section(
      k * k * norm,
      2 * (k * k - 1) * norm,
      (1 - k / q + k * k) * norm,
    )
  })
}
const tau = 2 * Math.PI
export class Receiver {
  private filters: Section[][] = []
  private signature = ''
  private phase = 0
  private phases = new Map<number, number>()
  private tick = 0
  private codes = Array.from({ length: 8 }, (_, i) => symbols(i + 1))
  private prevI = 0
  private prevQ = 0
  private fmI = 0
  private fmQ = 0
  constructor(
    public rate: number,
    public clips: Clip[],
  ) {}
  render(out: Float32Array, s: Settings, stations: Station[], time: number) {
    const [lo, hi] = edges(s),
      center = (lo + hi) / 2,
      cut = (hi - lo) / 2,
      key = String(cut)
    if (key !== this.signature) {
      this.filters = [stages(cut, this.rate), stages(cut, this.rate)]
      this.signature = key
    }
    const fm = s.mode === 'FM',
      active = stations
        .filter(
          (st) =>
            (st.mode === 'FM') === fm &&
            Math.abs(st.f - s.vfo) < (fm ? 13000 : 8000),
        )
        .sort((a, b) => Math.abs(a.f - s.vfo) - Math.abs(b.f - s.vfo))
        .slice(0, 8)
    const sources = active.map((st) => {
      const obs = observe(st, s, time),
        sign = st.mode === 'LSB' ? -1 : 1
      return {
        st,
        clip: this.clips[(st.seed - 1) % this.clips.length],
        gain: st.gain * fade(st.seed, time, s.qsb),
        sign,
        phase: this.phases.get(st.seed) ?? 0,
        delta:
          (tau *
            (obs.offset +
              (obs.inverted && st.mode !== 'FT8' ? -sign * 3000 : 0))) /
          this.rate,
        obs,
      }
    })
    const noise = 0.2 * 10 ** (-s.noise / 20) * Math.sqrt(this.rate / 4800),
      strong = sources
        .filter((v) => v.st.mode === 'FM')
        .sort((a, b) => b.obs.energy - a.obs.energy)[0]
    for (let n = 0; n < out.length; n++, this.tick++) {
      let i = (Math.random() * 2 - 1) * noise,
        q = (Math.random() * 2 - 1) * noise
      if (fm) {
        const source = strong,
          qual = source?.obs.quieting ?? 0
        if (!source || qual === 0 || source.obs.squelched) {
          out[n] =
            s.sql === 0
              ? (Math.tanh((Math.random() - 0.5) * 1.5) * s.volume) / 100
              : 0
          continue
        }
        const clip = source.clip,
          idx = Math.floor((this.tick * clipRate) / this.rate) % clip.length
        source.phase += source.delta + (tau * 2500 * clip.re[idx]) / this.rate
        const fuzz =
          (1 - qual) ** 2 * 0.9 +
          (0.006 + 0.08 * noise) / Math.max(0.08, source.gain)
        this.fmI +=
          0.42 *
          (Math.cos(source.phase) + (Math.random() - 0.5) * fuzz - this.fmI)
        this.fmQ +=
          0.42 *
          (Math.sin(source.phase) + (Math.random() - 0.5) * fuzz - this.fmQ)
        const angle = Math.atan2(
          this.prevI * this.fmQ - this.prevQ * this.fmI,
          this.prevI * this.fmI + this.prevQ * this.fmQ,
        )
        this.prevI = this.fmI
        this.prevQ = this.fmQ
        out[n] =
          (Math.tanh(((angle - source.delta) * this.rate) / (tau * 2500)) *
            s.volume) /
          100
        continue
      }
      for (const source of sources) {
        const { st, clip, sign, gain } = source
        let re = 0,
          im = 0
        if (st.tone) {
          const sym = symbolAt(time + n / this.rate)
          if (sym < 0) continue
          source.phase +=
            source.delta +
            (tau * (st.tone + this.codes[(st.seed - 1) % 8][sym] * 6.25)) /
              this.rate
          re = 0.3
        } else {
          source.phase += source.delta
          const pos = (this.tick * clipRate) / this.rate + st.seed * 2317,
            idx = Math.floor(pos) % clip.length,
            next = (idx + 1) % clip.length,
            frac = pos % 1
          re = clip.re[idx] + frac * (clip.re[next] - clip.re[idx])
          im = sign * (clip.im[idx] + frac * (clip.im[next] - clip.im[idx]))
        }
        const c = Math.cos(source.phase),
          a = Math.sin(source.phase)
        i += gain * (re * c - im * a)
        q += gain * (re * a + im * c)
      }
      this.phase = (this.phase + (tau * center) / this.rate) % tau
      const c = Math.cos(this.phase),
        a = Math.sin(this.phase),
        [fi, fq] = this.filters
      const x = fi[1].run(fi[0].run(i * c + q * a)),
        y = fq[1].run(fq[0].run(q * c - i * a))
      out[n] = (Math.tanh((x * c - y * a) * 1.7) * s.volume) / 100
    }
    for (const v of sources) this.phases.set(v.st.seed, v.phase % tau)
  }
}
