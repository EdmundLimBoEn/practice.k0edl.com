import { describe, it, expect } from 'vitest'
import { analytic, clipRate, fft, synthetic } from '../src/dsp/analytic'
import { Receiver } from '../src/dsp/core'
import { symbols, symbolAt } from '../src/dsp/ft8'
import { bands, segment } from '../src/band/plans'
import { qrmScene, scenes, type Mode } from '../src/band/scenes'
import { defaults, edges, parseFrequency, observe } from '../src/radio/model'
import { grade } from '../src/exercises/scoring'
import { C } from '../src/ui/copy'
const rate = 48000,
  n = 65536
function render(
  hz: number,
  mode: Mode = 'LSB',
  offset = 0,
  bw = 2400,
  shift = 0,
) {
  const clip = analytic(
    Float32Array.from(
      { length: 16384 },
      (_, i) => 0.15 * Math.sin((2 * Math.PI * i * hz) / clipRate),
    ),
  )
  const r = new Receiver(rate, [clip]),
    out = new Float32Array(n)
  r.render(
    out,
    {
      ...defaults,
      vfo: defaults.vfo - offset,
      mode,
      bw,
      shift,
      noise: 180,
      qsb: 0,
    },
    [{ f: defaults.vfo, mode: 'LSB', label: '', gain: 1, seed: 1 }],
    1,
  )
  const rms = Math.sqrt(out.reduce((sum, v) => sum + v * v, 0) / n)
  const im = new Float32Array(n)
  fft(out, im)
  let max = 0,
    p = 0
  for (let i = 1; i < n / 2; i++) {
    const mag = Math.hypot(out[i], im[i])
    if (mag > max) {
      max = mag
      p = i
    }
  }
  return { rms, hz: (p * rate) / n }
}
describe('receiver DSP', () => {
  it('preserves a tuned LSB tone and translates the entire spectrum when mistuned', () => {
    expect(render(750).hz).toBeCloseTo(750, 0)
    expect(Math.abs(render(750, 'LSB', -200).hz - 950)).toBeLessThan(1)
  })
  it('reflects tone order for the opposite-sideband teaching cue', () => {
    expect(render(750, 'USB').hz).toBeCloseTo(2250, 0)
    expect(render(1500, 'USB').hz).toBeCloseTo(1500, 0)
  })
  it('attenuates a station outside the IF and translates filter edges', () => {
    expect(render(1500, 'LSB', -3200).rms).toBeLessThan(render(1500).rms * 0.04)
    expect(render(2400, 'LSB', 0, 1800, -200).rms).toBeLessThan(
      render(2400, 'LSB', 0, 3600).rms * 0.25,
    )
  })
  it('removes adjacent speech energy while retaining the target in the QRM drill', () => {
    const clips = [synthetic(2)],
      energy = (small: boolean, target: boolean) => {
        const out = new Float32Array(24000),
          r = new Receiver(rate, clips)
        r.render(
          out,
          {
            ...defaults,
            vfo: qrmScene.home,
            mode: 'USB',
            bw: small ? 2100 : 3600,
            shift: small ? -200 : 0,
            qsb: 0,
            noise: 140,
          },
          target ? qrmScene.stations.slice(0, 1) : qrmScene.stations.slice(1),
          0,
        )
        return out.reduce((sum, x) => sum + x * x, 0)
      }
    expect(energy(true, false)).toBeLessThan(energy(false, false) * 0.04)
    expect(energy(true, true)).toBeGreaterThan(energy(false, true) * 0.4)
  })
  it('creates independent fades and signed receiver edges', () => {
    const a = scenes[0].stations[0],
      b = scenes[0].stations[1]
    expect(observe(a, { ...defaults, vfo: a.f }, 3).energy).not.toBe(
      observe(b, { ...defaults, vfo: b.f }, 3).energy,
    )
    expect(edges(defaults)).toEqual([-2550, -150])
  })
})
it('parses MHz and kHz', () => {
  for (const x of ['14.074', '14074', '14074.0'])
    expect(parseFrequency(x)).toBe(14074000)
  expect(parseFrequency('')).toBeNaN()
})
it('places all seven presets and distinguishes R3 and FCC', () => {
  expect(scenes).toHaveLength(7)
  expect(scenes.filter((s) => s.mode === 'FT8').map((s) => s.home)).toEqual([
    7074000, 14074000, 21074000,
  ])
  expect(segment(bands[0], 7250000, true)).toBe(C.outside)
  expect(segment(bands[0], 7250000, false)).toBe(C.general)
  expect(segment(bands[0], 7074500, true)).toBe(C.digital)
})
it('generates 79 8-FSK symbols at 6.25 baud across 15 second slots', () => {
  const a = symbols(42)
  expect(a.length).toBe(79)
  expect(Math.max(...a)).toBe(7)
  expect(a.slice(0, 7)).toEqual(a.slice(36, 43))
  expect([0, 0.5, 0.661, 13.139, 13.141, 15.5].map(symbolAt)).toEqual([
    -1, 0, 1, 78, -1, 0,
  ])
})
it('requires selectivity, intelligibility and correct tuning for QRM credit', () => {
  const s = { ...defaults, mode: 'USB' as Mode, vfo: qrmScene.home, bw: 3600 }
  expect(grade(3, qrmScene, s).ok).toBe(false)
  expect(grade(3, qrmScene, { ...s, bw: 2100, shift: -200 })).toEqual({
    ok: true,
    bonus: true,
  })
  expect(grade(3, qrmScene, { ...s, bw: 500 }).ok).toBe(false)
  expect(grade(3, qrmScene, { ...s, bw: 1800, vfo: s.vfo + 500 }).ok).toBe(
    false,
  )
})

it('closes FM squelch and gives a centred carrier priority over an overlapping weak one', () => {
  const fm = scenes.at(-1)!,
    station = fm.stations[0],
    s = {
      ...defaults,
      mode: 'FM' as Mode,
      vfo: fm.home,
      sql: 35,
      qsb: 0,
      noise: 160,
    }
  const clips = [750, 1500].map((hz) =>
    analytic(
      Float32Array.from(
        { length: 16384 },
        (_, i) => 0.3 * Math.sin((2 * Math.PI * i * hz) / clipRate),
      ),
    ),
  )
  const a = new Receiver(rate, clips),
    buffer = new Float32Array(32768)
  a.render(
    buffer,
    s,
    [station, { ...station, seed: 2, gain: 0.2, f: fm.home + 350 }],
    0,
  )
  const spectrum = buffer.slice(),
    im = new Float32Array(buffer.length)
  fft(spectrum, im)
  const magnitude = (hz: number) => {
    const bin = Math.round((hz * buffer.length) / rate)
    return Math.hypot(spectrum[bin], im[bin])
  }
  expect(magnitude(750)).toBeGreaterThan(magnitude(1500) * 10)
  a.render(buffer, { ...s, vfo: s.vfo + 6500 }, [station], 1)
  expect(buffer.every((v) => v === 0)).toBe(true)
})

it('guards the optional Worker before minting a short-lived client secret', async () => {
  const worker = (await import('../worker/src/index')).default
  const env = {
    OPENAI_API_KEY: 'unit-test-value',
    LIMIT: { limit: async () => ({ success: false }) },
  }
  const request = (origin: string) =>
    new Request('https://worker.invalid/session', {
      method: 'POST',
      headers: { Origin: origin },
    })
  expect(
    (await worker.fetch(request('https://example.invalid'), env)).status,
  ).toBe(403)
  expect(
    (await worker.fetch(request('https://practice.k0edl.com'), env)).status,
  ).toBe(429)
  const original = globalThis.fetch
  try {
    globalThis.fetch = async (url, init) => {
      expect(String(url)).toBe(
        'https://api.openai.com/v1/realtime/client_secrets',
      )
      expect(JSON.parse(String(init?.body)).expires_after.seconds).toBe(60)
      return Response.json({ value: 'ephemeral-fixture', expires_at: 60 })
    }
    const result = await worker.fetch(request('https://practice.k0edl.com'), {
      ...env,
      LIMIT: { limit: async () => ({ success: true }) },
    })
    expect(result.headers.get('Access-Control-Allow-Origin')).toBe(
      'https://practice.k0edl.com',
    )
    expect(await result.json()).toEqual({
      value: 'ephemeral-fixture',
      expires_at: 60,
    })
  } finally {
    globalThis.fetch = original
  }
})

it('raises the actual receiver noise power between easy and hard', () => {
  function noisePower(noise: number) {
    const r = new Receiver(rate, []),
      out = new Float32Array(16384)
    r.render(out, { ...defaults, noise }, [], 0)
    return out.reduce((sum, sample) => sum + sample ** 2, 0)
  }
  expect(noisePower(0)).toBeGreaterThan(20 * noisePower(20))
})
