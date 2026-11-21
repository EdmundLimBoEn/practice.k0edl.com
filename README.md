# K0EDL Practice

A receive-only amateur radio simulator for the SST course. The browser synthesizes the band, tunes a receiver and plays audio locally. No transmitter, radio connection, microphone, account or core backend.

## Run

Use Node 22.12+ and npm.

```sh
npm ci
npm run dev
npm run build
npm test
npx playwright install chromium
npm run test:e2e
npm run shots
```

On a Linux machine missing browser libraries, use `npx playwright install --with-deps chromium`. The production site is `dist/`, ready for a static host such as Pages. AudioWorklet requires HTTPS or localhost. Enable audio once, or select a training drill. Fonts, icons, the worklet and speech clips are all local.

Playwright builds and serves the static output on localhost. The screenshot script builds a fresh production bundle and writes six 1440×900 views and one 390×844 view to [shots](shots/). No deploy step is included.

## Tune the receiver

Select a scene or type a frequency in the VFO. For example, 7250 and 7.250 both select 7.250 MHz. Click or tap the scope to tune, drag the marker to move the VFO, drag the background to pan, and pinch or scroll to zoom around the pointer. The six buttons step down or up by 1 kHz, 100 Hz and 10 Hz. Alt + left/right steps by 10 Hz, or 100 Hz with Shift.

Scene presets select a viewport. Phone and FT8 signals remain on the band when you tune between them. The FCC view uses a continental US, Region 2 example. The IARU Region 3 strip shows recommended activity. These simplified teaching overlays do not establish local operating privileges. See [sources](docs/SOURCES.md).

The five drills cover sideband choice, tuning, finding the FT8 watering hole, adjacent-signal QRM and fine tuning. Scores stay in browser local storage. The QRM scene uses a USB target at 14.260 MHz, plus speech at +2.0 and +2.5 kHz. Start wide, then try 2.1 kHz with −200 Hz IF shift. The score uses estimated occupied-spectrum overlap, normalized station power and a target intelligibility threshold. Bandwidths of at least 1.8 kHz can earn a bonus.

## Audio and scope

- **Voice.** The receiver loads a prerecorded exchange for each nearby station and loops it. Synthetic formant voices cover missing or undecodable files. A radix-2 FFT constructs 300–2700 Hz analytic clips. The worklet conjugates the quadrature channel for LSB, mixes each station by its dial offset, translates the selected complex IF to zero, filters both lanes, then restores the audio frequency. The IF filter is a fourth-order Butterworth. Up to eight nearby stations enter the mixer.
- **Opposite sideband.** At the exact carrier, a physical ideal SSB receiver rejects the other sideband. The requested audible training cue uses a 3 kHz displaced mixing reference on opposite-sideband voice, which reverses the order of speech frequencies. FT8 uses ordinary USB selection without this cue.
- **Band conditions.** Each station has its own slow, seeded fading envelope. Difficulty changes the noise reference and fade depth. Manual sliders override the preset. The S-meter and approximate SNR estimate passband signal energy relative to the noise reference. They are teaching instruments rather than calibrated measurements.
- **FT8.** Six USB-offset traces per band, 15-second UTC-aligned slots, a 0.5-second start delay, 79 symbols at 6.25 baud and 6.25 Hz tone spacing. The typed-array sequence includes Costas sync blocks and pseudo-payload tones. It provides tuning practice without encoding or decoding messages.
- **FM.** The receiver selects the strongest overlapping NBFM signal, filters quadrature samples and uses a phase-difference discriminator. Offset affects quieting and distortion. Squelch gates weak signals. Repeater offset and CTCSS are concepts only.
- **Waterfall.** Canvas renders a model of RF occupancy, including station envelopes, noise texture and the actual FT8 symbol schedule. Signal traces remain visible outside the audio passband. The line and shading use the receiver’s VFO and signed IF edges. The scope is a simulated RF display, independent of output volume.
- **Verification.** The same DSP core runs in the AudioWorklet and under Vitest. Tests measure FFT peaks and RMS energy. The read-only `window.__practice` snapshot exposes dial offsets, inversion, passband occupancy, approximate SNR, FM quieting and squelch for browser tests.

## Prerecorded voices

All callsigns and operators in the scripts are fictional. Any match to a real licensee is coincidental. Domestic and DX contacts share the HF bands. On 40 m the Singapore station works Western Australia. The 2 m stations use local simplex and repeater exchanges. The QRM drill mixes three independent conversations.

The browser requests only static files from its own origin. It prefers Opus in Ogg and falls back to AAC in M4A. Audio is decoded at the receiver's sample rate for clips (12 kHz) before analytic filtering. Only the maintainer’s asset-preparation scripts call the OpenAI API. Playing the simulator incurs no API charges.

To regenerate, install FFmpeg with Opus and AAC encoders, supply your own OpenAI credential through the process environment as `OPENAI_API_KEY`, then run:

```sh
npm run tts
python3 -m venv .tts-cache/analysis
.tts-cache/analysis/bin/pip install numpy scipy praat-parselmouth
VOICE_PYTHON=.tts-cache/analysis/bin/python node scripts/verify-tts.mjs
```

Edit the ordered turns and operator directions in [the scripts](scripts/qso-scripts.json). Each over is one voice-acted WAV from `gpt-audio-1.5` chat completions. The ignored `.tts-cache/v3/` directory keeps the raw takes by request hash, processed turn boundaries, model-specific transcripts, Whisper word timestamps and a numeric usage ledger. Keep it across edits. To rebuild from cached takes, run `npm run tts -- 40v-domestic`. To replace only its second over, add `--retake=2`. Verification accepts clip IDs for spot checks. Running it without IDs refreshes the full report.

Each station has its own speech bandpass and compression, with a presence lift around 1.8 kHz. Measured turn pace controls tempo. Seeded station gain and handoff delays survive one two-pass loudness adjustment to the assembled exchange. Both encodings share the resulting mono master. [Per-clip measurements and transcription checks](docs/tts-verification.md).

## Add a band

Band limits, segment edges, default dial, optional FT8 dial and voice placements live in [plans.ts](src/band/plans.ts). [scenes.ts](src/band/scenes.ts) builds the sidebar scenes from those entries. For a future 10 m Technician USB voice training slice, add an entry like the following. Keep `ft` zero for a voice-only slice.

```ts
{ n: 10, phoneLabel: C.tech, low: 28300000, high: 28500000, home: 28400000, voice: [28350000, 28400000, 28470000],
  ft: 0, extra: 28300000, general: 28300000, rPhone: 28300000, rAll: 28300000, rEnd: 28500000 }
```

The optional phone label applies to both the FCC overlay and the stations. Verify Region 3 segments against the cited plan before enabling it. The shipped app contains only 40, 20, 15 and 2 m.

## Review

[UI copy](src/ui/copy.ts) · [Band-plan and protocol sources](docs/SOURCES.md) · [MIT license](LICENSE)
