import { Receiver } from './core'
import type { Clip } from './analytic'
import { defaults } from '../radio/model'
import type { Station } from '../band/scenes'
declare const sampleRate: number, currentTime: number
declare abstract class AudioWorkletProcessor {
  port: MessagePort
}
declare function registerProcessor(
  name: string,
  proc: typeof AudioWorkletProcessor,
): void
class PracticeReceiver extends AudioWorkletProcessor {
  core?: Receiver
  state = defaults
  stations: Station[] = []
  epoch = 0
  constructor() {
    super()
    this.port.onmessage = ({ data }) => {
      if (data.clips) this.core = new Receiver(sampleRate, data.clips as Clip[])
      if (data.recording) this.core?.recordings.set(data.id, data.recording)
      if (data.state) {
        this.state = data.state
        this.stations = data.stations
        this.epoch = data.time - currentTime
      }
    }
  }
  process(_: unknown, outputs: Float32Array[][]) {
    this.core?.render(
      outputs[0][0],
      this.state,
      this.stations,
      currentTime + this.epoch,
    )
    return true
  }
}
registerProcessor('practice-receiver', PracticeReceiver)
