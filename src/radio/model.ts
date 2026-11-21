import { symbolAt } from '../dsp/ft8'
import type { Mode, Station } from '../band/scenes'
export const clamp = (v: number, l: number, h: number) =>
  Math.min(h, Math.max(l, v))
export const freq = (f: number) =>
  Math.round(f).toLocaleString('en-US').replaceAll(',', '.')
export function parseFrequency(v: string) {
  const n = Number(v.trim())
  return n > 0 && Number.isFinite(n)
    ? Math.round(n * (n > 1000 ? 1000 : 1e6))
    : NaN
}
export type Settings = {
  vfo: number
  mode: Mode
  bw: number
  shift: number
  noise: number
  qsb: number
  volume: number
  sql: number
}
export const presets = [
  [20, 6],
  [10, 28],
  [0, 65],
  [-6, 90],
]
export const defaults: Settings = {
  vfo: 7250000,
  mode: 'LSB',
  bw: 2400,
  shift: 0,
  noise: 20,
  qsb: 6,
  volume: 55,
  sql: 25,
}
export function edges(s: Settings) {
  if (s.mode === 'FM') return [-6000, 6000]
  const lo = 150 + s.shift,
    hi = lo + s.bw
  return s.mode === 'LSB' ? [-hi, -lo] : [lo, hi]
}
export function fade(seed: number, t: number, qsb: number) {
  const a =
    Math.sin(0.53 * t + seed * 3.7) +
    Math.sin(0.29 * t + seed * 1.71) +
    Math.cos(0.17 * t + seed * 0.73)
  return 10 ** ((-qsb / 100) * (1 + a / 3))
}
export function observe(st: Station, s: Settings, t: number) {
  const offset = st.f - s.vfo,
    inverted = st.mode !== 'FM' && (st.mode === 'LSB') !== (s.mode === 'LSB')
  const sign = st.mode === 'LSB' ? -1 : 1
  const [lo, hi] = edges(s)
  const mirrored = inverted && st.mode !== 'FT8'
  const center = offset + (mirrored ? -sign * 3000 : 0)
  const a = center + sign * (st.tone ?? 300),
    b = center + sign * (st.tone ? st.tone + 50 : 2700)
  const overlap = Math.max(
    0,
    Math.min(hi, Math.max(a, b)) - Math.max(lo, Math.min(a, b)),
  )
  const energy =
    (st.mode === 'FM') !== (s.mode === 'FM')
      ? 0
      : st.mode === 'FM'
        ? Math.max(0, 1 - Math.abs(offset) / 7000)
        : overlap / Math.abs(b - a)
  const level =
    st.tone && symbolAt(t) < 0 ? 0 : fade(st.seed, t, s.qsb) * st.gain
  return {
    offset,
    inverted,
    inPassband: energy > 0.01,
    energy: energy * level ** 2,
    pitchShift: offset * (s.mode === 'LSB' ? -1 : 1),
    snr:
      s.noise +
      10 *
        Math.log10(
          (Math.max(0.0001, level ** 2 * energy) * 2400) /
            (s.mode === 'FM' ? 12000 : s.bw),
        ),
    quieting: energy,
    squelched: energy * level < s.sql / 100,
  }
}
