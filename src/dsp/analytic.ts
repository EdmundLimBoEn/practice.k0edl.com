// In-place radix-2 FFT. The inverse includes the 1/N normalization.
export function fft(re: Float32Array, im: Float32Array, inverse = false) {
  const n = re.length
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1
    for (; j & bit; bit >>= 1) j ^= bit
    j ^= bit
    if (i < j) {
      ;[re[i], re[j]] = [re[j], re[i]]
      ;[im[i], im[j]] = [im[j], im[i]]
    }
  }
  for (let size = 2; size <= n; size *= 2) {
    const angle = ((inverse ? 2 : -2) * Math.PI) / size,
      cr = Math.cos(angle),
      ci = Math.sin(angle)
    for (let start = 0; start < n; start += size) {
      let wr = 1,
        wi = 0
      for (let k = 0; k < size / 2; k++) {
        const a = start + k,
          b = a + size / 2,
          x = re[b] * wr - im[b] * wi,
          y = re[b] * wi + im[b] * wr
        re[b] = re[a] - x
        im[b] = im[a] - y
        re[a] += x
        im[a] += y
        const next = wr * cr - wi * ci
        wi = wi * cr + wr * ci
        wr = next
      }
    }
  }
  if (inverse)
    for (let i = 0; i < n; i++) {
      re[i] /= n
      im[i] /= n
    }
}
export const clipRate = 12000
export function analytic(samples: Float32Array, length = samples.length) {
  const re = samples.slice(),
    im = new Float32Array(re.length)
  fft(re, im)
  for (let i = 0; i < re.length; i++) {
    const f = (i * clipRate) / re.length,
      g = f >= 300 && f <= 2700 ? 2 : 0
    re[i] *= g
    im[i] *= g
  }
  fft(re, im, true)
  return { re, im, length }
}
export type Clip = ReturnType<typeof analytic>
export function synthetic(seed: number) {
  const data = new Float32Array(65536)
  let phase = 0
  for (let i = 0; i < data.length; i++) {
    const t = i / clipRate,
      syll = t * (3.2 + seed * 0.13) + seed,
      k = Math.floor(syll),
      p = syll - k
    const env = Math.sin(Math.PI * p) ** 0.8 * (k % 7 === 4 ? 0.12 : 1),
      fund = 99 + seed * 7 + 22 * Math.sin(t * 4 + seed) + 18 * (1 - p)
    phase += (2 * Math.PI * fund) / clipRate
    const f1 = 520 + 220 * Math.sin(k * 2.4 + seed),
      f2 = 1450 + 530 * Math.cos(k * 1.7)
    let v = 0
    for (let h = 2; h <= 22; h++) {
      const f = h * fund
      v +=
        Math.sin(h * phase) *
        (0.65 * Math.exp(-((f - f1) ** 2) / 24000) +
          0.37 * Math.exp(-((f - f2) ** 2) / 55000) +
          0.13 * Math.exp(-((f - 2480) ** 2) / 40000))
    }
    data[i] = v * 0.3 * env
  }
  return analytic(data)
}
