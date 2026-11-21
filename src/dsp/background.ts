import type { Station } from '../band/scenes'

// One distant voice per occupied dial frequency, including each FT8 group.
export function neighbours(stations: Station[]) {
  const seen = new Set<number>()
  const result: Station[] = []
  for (const station of stations) {
    if (station.mode === 'FM' || seen.has(station.f)) continue
    seen.add(station.f)
    const sign = station.mode === 'LSB' ? -1 : 1
    const band = station.f < 1e7 ? 40 : station.f < 2e7 ? 20 : 15
    result.push({
      ...station,
      mode: sign < 0 ? 'LSB' : 'USB',
      f: station.f + sign * (1750 + station.seed * 43),
      tone: undefined,
      seed: station.seed + 100 + Math.floor(station.f / 1000),
      clipId: station.clipId ?? band + 'v-domestic',
      gain: station.gain * 0.09,
    })
  }
  return result
}

export function randomStream(seed: number) {
  return () => {
    seed ^= seed << 13
    seed ^= seed >>> 17
    seed ^= seed << 5
    return (seed >>> 0) / 4294967296
  }
}
