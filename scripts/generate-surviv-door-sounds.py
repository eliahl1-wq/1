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
FILES = {
    "wood": {
        "open": ("door_open.wav", "door_open.wav"),
        "close": ("door_close.wav", "door_close.wav"),
    },
    "metal": {
        # Metal-framed gameplay doors still use ordinary hinged-door movement.
        # The old manhole/grinding layers read as a stone slab scraping the floor.
        "open": ("door_open.wav", "door_open.wav"),
        "close": ("door_close.wav", "door_close.wav"),
    },
}

SOURCE_WINDOWS = {
    "open": (0.085, 0.570),
    "close": (0.045, 0.500),
}

TARGET_DURATIONS = {
    "open": (0.34, 0.37),
    "close": (0.255, 0.285),
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


def one_pole_lowpass(audio: np.ndarray, cutoff_hz: float) -> np.ndarray:
    alpha = 1.0 - np.exp(-2.0 * np.pi * cutoff_hz / SAMPLE_RATE)
    filtered = np.empty_like(audio)
    filtered[0] = audio[0]
    for index in range(1, len(audio)):
        filtered[index] = filtered[index - 1] + alpha * (audio[index] - filtered[index - 1])
    return filtered


def clean_and_master(audio: np.ndarray, action: str, variant: int, material: str) -> np.ndarray:
    start_seconds, end_seconds = SOURCE_WINDOWS[action]
    audio = audio[
        int(start_seconds * SAMPLE_RATE):min(len(audio), int(end_seconds * SAMPLE_RATE))
    ].copy()
    audio -= np.mean(audio, axis=0, keepdims=True)

    # Time-compress the useful hinge/latch movement instead of retaining the
    # room tail. This keeps interaction feedback fast without a pitch-shifted
    # runtime speed hack.
    target_duration = TARGET_DURATIONS[action][variant - 1]
    target_frames = max(2, int(target_duration * SAMPLE_RATE))
    source_positions = np.linspace(0, len(audio) - 1, target_frames)
    source_index = np.arange(len(audio))
    audio = np.column_stack([
        np.interp(source_positions, source_index, audio[:, channel])
        for channel in range(audio.shape[1])
    ])

    # Restrict old-recorder rumble and hiss. Metal doors are only slightly
    # brighter; they never receive the former manhole/grinding recordings.
    lowpassed = one_pole_lowpass(audio, 6200 if material == "metal" else 5200)
    low_band = one_pole_lowpass(lowpassed, 90)
    audio = lowpassed - low_band

    # A short downward envelope removes the reverberant tail while preserving
    # the useful close/open transient.
    tail_frames = min(len(audio), int(SAMPLE_RATE * (0.075 if action == "open" else 0.060)))
    if tail_frames:
        audio[-tail_frames:] *= np.linspace(1, 0, tail_frames)[:, None] ** 1.7

    peak = float(np.max(np.abs(audio))) + 1e-9
    rms = float(np.sqrt(np.mean(np.square(audio)))) + 1e-9
    audio *= min(0.64 / peak, 0.050 / rms)

    fade = min(int(SAMPLE_RATE * 0.006), len(audio) // 3)
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
                clean_and_master(read_wav(SOURCE / source_name), action, index, material),
            )

print("Prepared 8 real-foley Surviv door cues")
