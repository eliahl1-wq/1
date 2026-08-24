"""Prepare compact Surviv door cues from real CC0 foley recordings.

The source recordings are kept in ``scripts/audio-source/surviv-doors`` so the
shipped files are reproducible and never fall back to procedural door noise.
See the attribution file beside the generated assets for provenance.
"""

from __future__ import annotations

import wave
from pathlib import Path

import numpy as np


SAMPLE_RATE = 48_000
SOURCE = Path(__file__).resolve().parent / "audio-source" / "surviv-doors"
OUTPUT = Path(__file__).resolve().parents[1] / "public" / "audio" / "surviv" / "doors"
MAX_DURATION_SECONDS = 1.15

FILES = {
    "wood": {
        "open": ("door_open.wav", "door_creak_open.wav"),
        "close": ("door_close.wav", "door_creak_close.wav"),
    },
    "metal": {
        "open": ("manhole_open.wav", "grind_metal.wav"),
        "close": ("clang_metal.wav", "lock.wav"),
    },
}


def read_wav(path: Path) -> np.ndarray:
    with wave.open(str(path), "rb") as source:
        channels = source.getnchannels()
        sample_width = source.getsampwidth()
        sample_rate = source.getframerate()
        frames = source.readframes(source.getnframes())
    if sample_width != 2 or sample_rate != SAMPLE_RATE:
        raise ValueError(f"Expected stereo/mono 16-bit {SAMPLE_RATE} Hz WAV: {path}")
    audio = np.frombuffer(frames, dtype="<i2").astype(np.float64) / 32768.0
    audio = audio.reshape(-1, channels)
    if channels == 1:
        audio = np.repeat(audio, 2, axis=1)
    elif channels > 2:
        audio = audio[:, :2]
    return audio


def trim_and_master(audio: np.ndarray) -> np.ndarray:
    envelope = np.max(np.abs(audio), axis=1)
    active = np.flatnonzero(envelope > 0.0025)
    if active.size:
        pad = int(SAMPLE_RATE * 0.018)
        start = max(0, int(active[0]) - pad)
        end = min(len(audio), int(active[-1]) + pad + 1)
        audio = audio[start:end]

    audio = audio[: int(SAMPLE_RATE * MAX_DURATION_SECONDS)].copy()
    peak = float(np.max(np.abs(audio))) + 1e-9
    rms = float(np.sqrt(np.mean(np.square(audio)))) + 1e-9
    audio *= min(0.82 / peak, 0.072 / rms)

    fade = min(int(SAMPLE_RATE * 0.012), len(audio) // 3)
    if fade:
        audio[:fade] *= np.linspace(0, 1, fade)[:, None]
        audio[-fade:] *= np.linspace(1, 0, fade)[:, None]
    return np.clip(audio, -1, 1)


def write_wav(path: Path, audio: np.ndarray) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    pcm = (audio * 32767).astype("<i2")
    with wave.open(str(path), "wb") as output:
        output.setnchannels(2)
        output.setsampwidth(2)
        output.setframerate(SAMPLE_RATE)
        output.writeframes(pcm.tobytes())


for material, actions in FILES.items():
    for action, source_names in actions.items():
        for index, source_name in enumerate(source_names, start=1):
            write_wav(
                OUTPUT / material / f"{action}-{index}.wav",
                trim_and_master(read_wav(SOURCE / source_name)),
            )

print("Prepared 8 real-foley Surviv door cues")
