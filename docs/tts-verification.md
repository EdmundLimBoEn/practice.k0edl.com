# Speech verification

| Clip | WPM | Artic. WPM | Pauses/min | Median ms | f0 Hz | SD st | <300 Hz % | LF dB | Station Δ dB | WER | Phonetics | Opus LUFS | AAC LUFS | Seconds |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---|---:|---:|---:|
| Real excerpts | 152–163 | 168–180 | 19.5–26.3 | 200–290 | 128–165 | 4.93–5.38 | 4.2–4.6 | −26 to −21 | — | — | — | — | — | — |
| 40v-domestic | 157 | 170 | 19.3 | 240 | 159 | 4.53 | 5.7 | -19.9 | 4.5 | 1.7% | OK | -16.16 | -16.03 | 115.1 |
| 40v-dx | 158 | 178 | 24.3 | 220 | 155 | 5.31 | 5.7 | -25.8 | 4.8 | 7.7% | OK | -16.47 | -16.31 | 54.3 |
| 20v-domestic | 160 | 174 | 22.6 | 240 | 161 | 4.61 | 6.6 | -23.4 | 5.4 | 1.0% | OK | -16.16 | -16.03 | 116.8 |
| 20v-dx | 150 | 181 | 26.7 | 240 | 148 | 5.07 | 8.4 | -17.0 | 5.9 | 3.7% | OK | -16.19 | -16.01 | 53.9 |
| 15v-domestic | 156 | 171 | 20.9 | 240 | 171 | 3.79 | 4.8 | -27.6 | 3.2 | 2.3% | OK | -16.4 | -16.28 | 83.0 |
| 15v-dx | 156 | 184 | 23.3 | 220 | 173 | 3.63 | 8.9 | -22.4 | 4.7 | 5.0% | OK | -16.17 | -16.05 | 54.0 |
| 2v-repeater | 166 | 187 | 29.8 | 230 | 139 | 5.93 | 6.1 | -19.2 | 5.5 | 4.3% | OK | -16.29 | -16.03 | 44.3 |
| 2v-simplex | 159 | 181 | 20.9 | 250 | 159 | 5.38 | 7.4 | -22.8 | 5.2 | 0.7% | OK | -16.18 | -16.05 | 51.8 |
| qrm-target | 158 | 174 | 23.9 | 220 | 147 | 4.16 | 6.7 | -23.4 | 4.4 | 1.0% | OK | -16.34 | -16.23 | 77.8 |
| qrm-upper | 162 | 175 | 27.7 | 220 | 156 | 3.72 | 5.5 | -22.6 | 5.6 | 2.6% | OK | -16.16 | -16.04 | 75.7 |
| qrm-outer | 159 | 173 | 24.6 | 220 | 151 | 5.65 | 5.6 | -25.0 | 4.2 | 1.5% | OK | -16.18 | -16.03 | 75.6 |
| 40v-portable | 157 | 173 | 23.4 | 240 | 135 | 4.35 | 7.3 | -19.1 | 5.3 | 3.3% | OK | -16.18 | -16.02 | 105.0 |

Rates use Whisper word timestamps on final AAC. Articulation caps interword gaps at 0.5 s. Pitch and energy use decoded Opus at 16 kHz. Pauses use 20 ms RMS frames and the reference adaptive threshold, including handoffs. LF compares 60–150 Hz with 300–600 Hz. Station separation compares RMS across complete overs, excluding handoff gaps. The 3–8 dB station separation is a design target. Pitch summaries pool both speakers.

WER uses a separate GPT-4o transcription. The phonetics check counts each ordered full spelling against the script. Loudness is measured independently after encoding.
