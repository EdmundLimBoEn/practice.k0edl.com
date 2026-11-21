import { C } from '../ui/copy'
export interface Band {
  phoneLabel?: string
  n: number
  low: number
  high: number
  extra: number
  general: number
  rPhone: number
  rAll: number
  rEnd: number
  ft: number
  home: number
  voice: number[]
}
export const bands: Band[] = [
  {
    n: 40,
    low: 7000000,
    high: 7300000,
    extra: 7125000,
    general: 7175000,
    rPhone: 7030000,
    rAll: 7040000,
    rEnd: 7200000,
    ft: 7074000,
    home: 7250000,
    voice: [
      7188000, 7200000, 7225000, 7250000, 7260000, 7290000, 7150000, 7095000,
    ],
  },
  {
    n: 20,
    low: 14000000,
    high: 14350000,
    extra: 14150000,
    general: 14225000,
    rPhone: 14100000,
    rAll: 14112000,
    rEnd: 14350000,
    ft: 14074000,
    home: 14260000,
    voice: [
      14230000, 14247000, 14260000, 14285000, 14300000, 14320000, 14195000,
    ],
  },
  {
    n: 15,
    low: 21000000,
    high: 21450000,
    extra: 21200000,
    general: 21275000,
    rPhone: 21150000,
    rAll: 21150000,
    rEnd: 21450000,
    ft: 21074000,
    home: 21340000,
    voice: [21285000, 21295000, 21340000, 21360000, 21400000, 21250000],
  },
  {
    n: 2,
    low: 144000000,
    high: 148000000,
    extra: 0,
    general: 0,
    rPhone: 0,
    rAll: 0,
    rEnd: 146000000,
    ft: 0,
    home: 146520000,
    voice: [146520000, 146940000, 147000000],
  },
]
export function segment(b: Band, f: number, r3: boolean) {
  if (f < b.low || f > (r3 ? b.rEnd : b.high)) return C.outside
  if (b.n === 2) return C.fmSeg
  if (b.ft && f >= b.ft && f < b.ft + 3000) return C.digital
  if (r3)
    return f < b.rPhone
      ? C.narrow
      : f < b.rAll || b.n !== 40
        ? C.voiceSeg
        : C.all
  return f < b.extra
    ? C.narrow
    : f < b.general
      ? C.extra
      : (b.phoneLabel ?? C.general)
}
