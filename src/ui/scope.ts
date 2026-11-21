import { C } from './copy'
import type { Scene } from '../band/scenes'
import { clamp, edges, stationFade, freq, type Settings } from '../radio/model'
import { segment } from '../band/plans'
import { symbolAt, symbols } from '../dsp/ft8'
const stops = [
  [3, 15, 49],
  [9, 37, 100],
  [17, 66, 146],
  [11, 129, 180],
  [51, 214, 204],
  [222, 240, 103],
  [251, 253, 218],
]
export class Scope {
  center = 7250000
  span = 90000
  r3 = false
  step = 100
  ghost: number | null = null
  private history = document.createElement('canvas')
  private key = ''
  private last = 0
  private touches = new Map<number, number>()
  private start = 0
  private initial = 0
  private moved = false
  private marker = false
  private codes = Array.from({ length: 9 }, (_, i) => symbols(i))
  constructor(
    public el: HTMLCanvasElement,
    public scene: () => Scene,
    public settings: () => Settings,
    public tune: (f: number) => void,
    public info: () => void,
    public showTarget: () => boolean,
  ) {
    const pos = (e: PointerEvent | WheelEvent) =>
      (e.clientX - el.getBoundingClientRect().left) / el.clientWidth
    el.onwheel = (e) => {
      e.preventDefault()
      this.zoom(e.deltaY > 0 ? 1.25 : 0.8, pos(e))
    }
    el.addEventListener('wheel', (e) => e.preventDefault(), { passive: false })
    el.onpointerdown = (e) => {
      el.setPointerCapture(e.pointerId)
      const x = pos(e)
      this.touches.set(e.pointerId, x)
      this.start = x
      this.initial = this.center
      this.moved = this.touches.size > 1
      this.marker =
        Math.abs(this.at(x) - this.settings().vfo) <
        (this.span * 10) / el.clientWidth
    }
    el.onpointermove = (e) => {
      const x = pos(e)
      this.ghost = this.at(x)
      if (!this.touches.has(e.pointerId)) return
      const old = this.touches.get(e.pointerId)!
      this.touches.set(e.pointerId, x)
      if (this.touches.size === 2) {
        const other = [...this.touches].find(([id]) => id !== e.pointerId)![1]
        if (Math.abs(x - other) > 0.01)
          this.zoom(
            Math.abs(old - other) / Math.abs(x - other),
            (x + other) / 2,
          )
        this.moved = true
        return
      }
      if (Math.abs(x - this.start) * el.clientWidth > 3) this.moved = true
      if (this.moved) {
        if (this.marker) this.tune(this.snap(this.at(x)))
        else this.pan(this.initial - (x - this.start) * this.span)
      }
    }
    el.onpointerup = (e) => {
      if (!this.moved) this.tune(this.snap(this.at(pos(e))))
      this.touches.delete(e.pointerId)
      if (this.touches.size) {
        this.start = [...this.touches.values()][0]
        this.initial = this.center
        this.marker = false
      }
    }
    el.onpointercancel = (e) => {
      this.touches.delete(e.pointerId)
      this.moved = true
    }
    el.onpointerleave = () => {
      this.ghost = null
    }
    requestAnimationFrame(this.frame)
  }
  at(x: number) {
    return this.center + (x - 0.5) * this.span
  }
  snap(f: number) {
    return Math.round(f / this.step) * this.step
  }
  pan(f: number) {
    const b = this.scene().band
    this.center = clamp(f, b.low + this.span / 2, b.high - this.span / 2)
    this.info()
  }
  zoom(factor: number, x = 0.5) {
    const anchor = this.at(x),
      b = this.scene().band
    this.span = clamp(this.span * factor, 4000, b.high - b.low)
    this.step = this.span < 25000 ? 10 : this.span > 150000 ? 1000 : 100
    this.pan(anchor - (x - 0.5) * this.span)
  }
  reset() {
    this.span = this.scene().span
    this.center = this.scene().home
    this.step = this.span < 25000 ? 10 : 100
    this.key = ''
  }
  private profile(w: number, t: number) {
    const row = new Float32Array(w),
      s = this.settings()
    for (const st of this.scene().stations) {
      const fm = st.mode === 'FM',
        side = st.mode === 'LSB' ? -1 : 1
      const sym = symbolAt(t)
      if (st.tone && sym < 0) continue
      const origin =
        st.f + (st.tone ? st.tone + 6.25 * this.codes[st.seed][sym] : 0)
      const width = st.tone ? Math.max(42, this.span / w) : fm ? 5500 : 2800
      const left = Math.max(
        0,
        Math.floor(
          ((origin - (fm || side < 0 ? width : 0) - this.at(0)) / this.span) *
            w,
        ) - 2,
      )
      const right = Math.min(
        w,
        Math.ceil(
          ((origin + (fm || side > 0 ? width : 0) - this.at(0)) / this.span) *
            w,
        ) + 2,
      )
      const amp =
        (0.82 + 0.18 * Math.sin(t * 2.8 + st.seed)) *
        (0.6 + 0.4 * stationFade(st, t, s.qsb))
      for (let x = left; x < right; x++) {
        const d = ((this.at(x / w) - origin) * side) / width
        if (fm) {
          row[x] += amp * Math.exp(-d * d * 5)
          continue
        }
        if (d < 0 || d > 1) continue
        const peak = st.tone
          ? 1
          : (0.44 +
              0.45 * Math.exp(-((d - 0.22) ** 2) / 0.023) +
              0.23 * Math.exp(-((d - 0.64) ** 2) / 0.018)) *
            (0.57 + 0.43 * Math.abs(Math.sin(d * 42 + st.seed + t * 0.35))) *
            (1 - d ** 3)
        row[x] += amp * peak
      }
    }
    return row
  }
  private frame = (ms: number) => {
    requestAnimationFrame(this.frame)
    if (ms - this.last < 75) return
    this.last = ms
    const el = this.el,
      w = Math.round(el.clientWidth),
      h = Math.round(el.clientHeight)
    if (w < 1 || h < 1) return
    const dpr = Math.min(devicePixelRatio, 2)
    if (el.width !== Math.round(w * dpr) || el.height !== Math.round(h * dpr)) {
      el.width = Math.round(w * dpr)
      el.height = Math.round(h * dpr)
    }
    const ctx = el.getContext('2d')!
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    const axis = 25,
      scope = Math.round(h * 0.47),
      wf = h - axis - scope,
      t = Date.now() / 1000,
      s = this.settings()
    const key = [this.center, this.span, w, wf, this.scene().id].join('/'),
      fresh = key !== this.key
    this.key = key
    if (fresh) {
      this.history.width = w
      this.history.height = wf
    }
    const hist = this.history.getContext('2d')!,
      lines = fresh ? wf : 2
    if (!fresh) hist.drawImage(this.history, 0, 0, w, wf - 2, 0, 2, w, wf - 2)
    const img = hist.createImageData(w, lines)
    for (let y = 0; y < lines; y++) {
      const profile = this.profile(w, t - y * 0.04)
      let prev = 0
      for (let x = 0; x < w; x++) {
        const k = (y * w + x) * 4
        prev = prev * 0.38 + Math.random() * 0.62
        const n = clamp(
          prev * 0.36 +
            Math.random() * 0.08 +
            profile[x] * (0.7 + Math.random() * 0.55) +
            (20 - s.noise) * 0.001,
          0,
          1.12,
        )

        const v = Math.min(n * 5.5, 5.99),
          j = Math.floor(v),
          p = v - j
        for (let c = 0; c < 3; c++)
          img.data[k + c] = stops[j][c] * (1 - p) + stops[j + 1][c] * p
        img.data[k + 3] = 255
      }
    }
    hist.putImageData(img, 0, 0)
    ctx.drawImage(this.history, 0, scope)
    ctx.fillStyle = '#101f30'
    ctx.fillRect(0, 0, w, scope)
    ctx.fillStyle = '#102035'
    ctx.fillRect(0, h - axis, w, axis)
    const divisions = w < 550 ? 4 : 8
    ctx.font = '10px "IBM Plex Mono", monospace'
    for (let k = 0; k <= divisions; k++) {
      const x = (k * w) / divisions
      ctx.strokeStyle = '#849bb524'
      ctx.beginPath()
      ctx.moveTo(x, 0)
      ctx.lineTo(x, h - axis)
      ctx.stroke()
      const f = this.at(k / divisions)
      ctx.fillStyle = '#b0c3d3'
      ctx.textAlign = k === 0 ? 'left' : k === divisions ? 'right' : 'center'
      ctx.fillText((f / 1e6).toFixed(3), clamp(x, 7, w - 7), h - 8)
    }
    for (let k = 1; k <= 4; k++) {
      const y = (scope * k) / 5
      ctx.strokeStyle = '#7990a32e'
      ctx.beginPath()
      ctx.setLineDash([3, 5])
      ctx.moveTo(0, y)
      ctx.lineTo(w, y)
      ctx.stroke()
      ctx.setLineDash([])
      ctx.fillStyle = '#8298ab'
      ctx.textAlign = 'right'
      ctx.fillText(String(-40 - k * 10), w - 5, y - 3)
    }
    const profile = this.profile(w, t)
    ctx.beginPath()
    for (let x = 0; x < w; x++) {
      const y =
        scope *
        clamp(
          0.86 -
            profile[x] * 0.68 -
            (Math.random() * 0.085 + 0.025 * Math.sin(x * 0.31)),
          0.045,
          0.97,
        )
      if (x === 0) ctx.moveTo(x, y)
      else ctx.lineTo(x, y)
    }
    ctx.strokeStyle = '#61dfbd'
    ctx.lineWidth = 1.35
    ctx.stroke()
    ctx.lineTo(w, scope)
    ctx.lineTo(0, scope)
    ctx.closePath()
    const gradient = ctx.createLinearGradient(0, 0, 0, scope)
    gradient.addColorStop(0, '#5ddcaa85')
    gradient.addColorStop(1, '#49cba612')
    ctx.fillStyle = gradient
    ctx.fill()
    const px = (f: number) => ((f - this.at(0)) / this.span) * w,
      vx = px(s.vfo),
      [low, high] = edges(s)
    ctx.fillStyle = '#b6e97731'
    ctx.fillRect(px(s.vfo + low), 0, ((high - low) / this.span) * w, h - axis)
    ctx.fillStyle = '#c7f585'
    ctx.fillRect(vx, 0, 1.3, h - axis)
    ctx.beginPath()
    ctx.moveTo(vx - 5, 0)
    ctx.lineTo(vx + 5, 0)
    ctx.lineTo(vx, 7)
    ctx.fill()
    if (this.showTarget()) {
      ctx.fillStyle = '#c7f585'
      ctx.textAlign = 'left'
      ctx.fillText(C.target, px(this.scene().home) + 5, 18)
    }
    if (this.scene().id === 'qrm') {
      ctx.font = '9px "IBM Plex Mono",monospace'
      ctx.textAlign = 'left'
      for (const [i, st] of this.scene().stations.entries()) {
        const x = px(st.f),
          y = 14 + i * 14
        if (x < 0 || x > w) continue
        ctx.fillStyle = i ? '#9de9e1' : '#c7f585'
        ctx.fillRect(x, y, 1, scope - y)
        ctx.fillText(
          i
            ? '+' + ((st.f - this.scene().home) / 1000).toFixed(1) + ' ' + C.khz
            : C.target,
          x + 4,
          y,
        )
      }
    }
    if (this.ghost !== null) {
      const x = px(this.ghost)
      ctx.fillStyle = '#d4dfec80'
      ctx.fillRect(x, 0, 1, h - axis)
      ctx.textAlign = 'left'
      ctx.fillStyle = '#d4dfec'
      ctx.fillText(
        freq(this.snap(this.ghost)),
        clamp(x + 5, 5, w - 80),
        scope - 8,
      )
    }
  }
  segments(fullBand = false) {
    const b = this.scene().band,
      lo = fullBand ? b.low : this.at(0),
      hi = fullBand ? b.high : this.at(1),
      breaks = [
        lo,
        ...[
          b.low,
          b.extra,
          b.general,
          b.rPhone,
          b.rAll,
          b.rEnd,
          b.high,
          b.ft,
          b.ft + 3000,
        ].filter((f) => f > lo && f < hi),
        hi,
      ].sort((a, b) => a - b)
    const spans: { label: string; left: number; right: number }[] = []
    for (let i = 1; i < breaks.length; i++) {
      if (breaks[i] === breaks[i - 1]) continue
      const label = segment(b, (breaks[i] + breaks[i - 1]) / 2, this.r3),
        last = spans.at(-1)
      if (last?.label === label) last.right = breaks[i]
      else spans.push({ label, left: breaks[i - 1], right: breaks[i] })
    }
    return spans
  }
}
