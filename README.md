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

On a Linux machine missing browser libraries, use `npx playwright install --with-deps chromium`. The production site is `dist/`, ready for a static host such as Pages. AudioWorklet requires HTTPS or localhost. Enable audio once, or select a training drill. Fonts, icons, the worklet and the empty audio manifest are all local.

Playwright builds and serves the static output on localhost. The screenshot script builds a fresh production bundle and writes six 1440×900 views and one 390×844 view to [shots](shots/). No deploy step is included.

## Tune the receiver

Select a scene or type a frequency in the VFO. For example, 7250 and 7.250 both select 7.250 MHz. Click or tap the scope to tune, drag the marker to move the VFO, drag the background to pan, and pinch or scroll to zoom around the pointer. The six buttons step down or up by 1 kHz, 100 Hz and 10 Hz. Alt + left/right steps by 10 Hz, or 100 Hz with Shift.

Scene presets select a viewport. Phone and FT8 signals remain on the band when you tune between them. The FCC view uses a continental US, Region 2 example. The IARU Region 3 strip shows recommended activity. These simplified teaching overlays do not establish local operating privileges. See [sources](docs/SOURCES.md).

The five drills cover sideband choice, tuning, finding the FT8 watering hole, adjacent-signal QRM and fine tuning. Scores stay in browser local storage. The QRM scene uses a USB target at 14.260 MHz, plus speech at +2.0 and +2.5 kHz. Start wide, then try 2.1 kHz with −200 Hz IF shift. The score uses estimated occupied-spectrum overlap, normalized station power and a target intelligibility threshold. Bandwidths of at least 1.8 kHz can earn a bonus.

## Audio and scope

- **Voice.** Built-in, nonverbal formant voices have syllables, changing pitch and three asymmetric formant regions. For intelligible words, add recordings. A radix-2 FFT constructs 300–2700 Hz analytic clips. The worklet conjugates the quadrature channel for LSB, mixes each station by its dial offset, translates the selected complex IF to zero, filters both lanes, then restores the audio frequency. The IF filter is a fourth-order Butterworth. Up to eight nearby stations enter the mixer.
- **Opposite sideband.** At the exact carrier, a physical ideal SSB receiver rejects the other sideband. The requested audible training cue uses a 3 kHz displaced mixing reference on opposite-sideband voice, which reverses the order of speech frequencies. FT8 uses ordinary USB selection without this cue.
- **Band conditions.** Each station has its own slow, seeded fading envelope. Difficulty changes the noise reference and fade depth. Manual sliders override the preset. The S-meter and approximate SNR estimate passband signal energy relative to the noise reference. They are teaching instruments rather than calibrated measurements.
- **FT8.** Six USB-offset traces per band, 15-second UTC-aligned slots, a 0.5-second start delay, 79 symbols at 6.25 baud and 6.25 Hz tone spacing. The typed-array sequence includes Costas sync blocks and pseudo-payload tones. It provides tuning practice without encoding or decoding messages.
- **FM.** The receiver selects the strongest overlapping NBFM signal, filters quadrature samples and uses a phase-difference discriminator. Offset affects quieting and distortion. Squelch gates weak signals. Repeater offset and CTCSS are concepts only.
- **Waterfall.** Canvas renders a model of RF occupancy, including station envelopes, noise texture and the actual FT8 symbol schedule. Signal traces remain visible outside the audio passband. The line and shading use the receiver’s VFO and signed IF edges. The scope is a simulated RF display, independent of output volume.
- **Verification.** The same DSP core runs in the AudioWorklet and under Vitest. Tests measure FFT peaks and RMS energy. The read-only `window.__practice` snapshot exposes dial offsets, inversion, passband occupancy, approximate SNR, FM quieting and squelch for browser tests.

## Add recordings or generate TTS

Put consented 48 kHz mono WAV or Opus clips in `public/audio/voice/`. Only distribute recordings you have permission to publish. List their filenames in `public/audio/manifest.json`:

```json
{"voice":["garden.wav","coast.opus"]}
```

The browser decodes up to eight clips on first audio start. It uses synthesized voices if none load. The FT8 and FM directories are reserved for future assets.

For optional build-time AI voices, edit `scripts/qso-scripts.json`, provide `OPENAI_API_KEY` through the process environment, and run `npm run tts`. The script requests Opus audio, saves `tts-*.opus` and appends entries while preserving existing recordings. With no key, it exits successfully and leaves the manifest alone. Only audio, scripts and the manifest belong in the site. Review any generated speech before distributing it.

## Add a band

Band limits, segment edges, default dial, optional FT8 dial and voice placements live in [plans.ts](src/band/plans.ts). [scenes.ts](src/band/scenes.ts) builds the sidebar scenes from those entries. For a future 10 m Technician USB voice training slice, add an entry like the following. Keep `ft` zero for a voice-only slice.

```ts
{ n: 10, phoneLabel: C.tech, low: 28300000, high: 28500000, home: 28400000, voice: [28350000, 28400000, 28470000],
  ft: 0, extra: 28300000, general: 28300000, rPhone: 28300000, rAll: 28300000, rEnd: 28500000 }
```

The optional phone label applies to both the FCC overlay and the stations. Verify Region 3 segments against the cited plan before enabling it. The shipped app contains only 40, 20, 15 and 2 m.

## Review

[UI copy](src/ui/copy.ts) · [Band-plan and protocol sources](docs/SOURCES.md) · [MIT license](LICENSE)
