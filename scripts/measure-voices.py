"""Measure shipped Opus audio using the reference recordings' analysis methods."""
import hashlib
import json
import subprocess
import sys
from itertools import groupby
from pathlib import Path

import numpy as np
import parselmouth
from scipy.signal import welch

ROOT = Path(__file__).resolve().parents[1]
CACHE = ROOT / ".tts-cache/v3"
VOICE = ROOT / "public/audio/voice"


def measure(clip):
    rate = 16000
    decoded = subprocess.check_output([
        "ffmpeg", "-v", "error", "-i", str(VOICE / (clip + ".ogg")),
        "-ac", "1", "-ar", str(rate), "-f", "f32le", "-"
    ])
    samples = np.frombuffer(decoded, dtype="<f4")
    duration = len(samples) / rate
    frames = samples[:len(samples) // 320 * 320].reshape(-1, 320)
    levels = 20 * np.log10(np.sqrt(np.mean(frames**2, axis=1)) + 1e-9)
    floor, peak = np.percentile(levels, [10, 95])
    activity = levels > floor + 0.35 * (peak - floor)
    runs = [sum(1 for _ in run) * .02 for active, run in groupby(activity) if not active]
    pauses = [length for length in runs if length >= .15]

    speech = frames[levels > floor + .5 * (peak - floor)].ravel()
    freq, power = welch(speech, rate, nperseg=1024)
    bass = 100 * power[freq < 300].sum() / power.sum()
    freq, power = welch(samples, rate, nperseg=8192)
    def band(lo, hi):
        return power[(freq >= lo) & (freq < hi)].sum()

    pitch = parselmouth.Sound(samples.astype(float), rate).to_pitch(
        time_step=.01, pitch_floor=70, pitch_ceiling=400
    ).selected_array["frequency"]
    pitch = pitch[pitch > 0]
    digest = hashlib.sha256((VOICE / (clip + ".m4a")).read_bytes()).hexdigest()
    words = json.loads((CACHE / (digest + "-whisper-1.json")).read_text())["words"]
    talk = sum(w["end"] - w["start"] for w in words)
    talk += sum(min(.5, b["start"] - a["end"]) for a, b in zip(words, words[1:]))
    stations = {}
    manifest = json.loads((VOICE.parent / "manifest.json").read_text())
    entry = next(c for c in manifest["clips"] if c["id"] == clip)
    for turn in entry["overs"]:
        over = samples[round(turn["start"] * rate):round(turn["end"] * rate)]
        stations.setdefault(turn["callsign"], []).append(over)
    rms = [10 * np.log10(np.mean(np.concatenate(overs)**2)) for overs in stations.values()]
    return [len(words)*60/duration, len(words)*60/talk, len(pauses)*60/duration,
            np.median(pauses)*1000, np.median(pitch), np.std(12*np.log2(pitch)),
            bass, 10*np.log10(band(60, 150)/band(300, 600)), max(rms)-min(rms)]


if __name__ == "__main__":
    print(json.dumps([round(float(value), 2) for value in measure(sys.argv[1])], allow_nan=False))
