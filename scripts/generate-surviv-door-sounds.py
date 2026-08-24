"""Generate layered, sample-free Surviv door opening recordings."""

from __future__ import annotations

import math
import wave
from pathlib import Path

import numpy as np
from scipy.signal import butter, sosfilt


SAMPLE_RATE = 48_000
DURATION = 0.46
OUTPUT = Path(__file__).resolve().parents[1] / "public" / "audio" / "surviv" / "doors"


def bandpass(signal: np.ndarray, low: float, high: float) -> np.ndarray:
    sos = butter(3, [low, high], btype="bandpass", fs=SAMPLE_RATE, output="sos")
    return sosfilt(sos, signal)


def lowpass(signal: np.ndarray, cutoff: float) -> np.ndarray:
    return sosfilt(butter(3, cutoff, btype="lowpass", fs=SAMPLE_RATE, output="sos"), signal)


def burst(rng: np.random.Generator, length: int, decay: float, low: float, high: float) -> np.ndarray:
    noise = bandpass(rng.standard_normal(length), low, high)
    return noise * np.exp(-np.arange(length) / (SAMPLE_RATE * decay))


def add_mode(track: np.ndarray, start: float, frequency: float, duration: float, gain: float, rng: np.random.Generator) -> None:
    begin = int(start * SAMPLE_RATE)
    count = min(int(duration * SAMPLE_RATE), len(track) - begin)
    if count <= 0:
        return
    time = np.arange(count) / SAMPLE_RATE
    phase_wobble = 0.018 * np.sin(2 * np.pi * (5.2 + rng.random()) * time)
    envelope = np.sin(np.pi * np.minimum(1, time / 0.006)) * np.exp(-time / (duration * 0.43))
    track[begin:begin + count] += np.sin(2 * np.pi * frequency * time + phase_wobble) * envelope * gain


def render(material: str, variant: int) -> np.ndarray:
    rng = np.random.default_rng(0xD001 + variant * 977 + (9000 if material == "metal" else 0))
    count = int(SAMPLE_RATE * DURATION)
    left = np.zeros(count)
    right = np.zeros(count)

    # Handle and latch: two close mechanical contacts instead of one digital click.
    for click_index, start in enumerate((0.006, 0.032 + variant * 0.0015)):
        length = int(SAMPLE_RATE * (0.030 if click_index == 0 else 0.022))
        click = burst(
            rng,
            length,
            0.007 if click_index == 0 else 0.005,
            620 if material == "wood" else 1050,
            5200 if material == "wood" else 7600,
        )
        click *= (0.23 if click_index == 0 else 0.15) / (np.max(np.abs(click)) + 1e-9)
        begin = int(start * SAMPLE_RATE)
        left[begin:begin + length] += click
        right[begin:begin + length] += np.roll(click, 2 + variant)

    # Door-leaf movement: filtered friction whose amplitude rises as weight transfers.
    movement_start = int(0.045 * SAMPLE_RATE)
    movement_count = int((0.34 + variant * 0.012) * SAMPLE_RATE)
    raw = rng.standard_normal(movement_count)
    friction = bandpass(raw, 75 if material == "wood" else 120, 1450 if material == "wood" else 2600)
    time = np.arange(movement_count) / SAMPLE_RATE
    motion = np.sin(np.pi * np.minimum(1, time / (movement_count / SAMPLE_RATE))) ** 0.72
    motion *= 0.82 + 0.18 * np.sin(2 * np.pi * (7.1 + variant * 0.7) * time + variant)
    friction *= motion
    friction *= (0.072 if material == "wood" else 0.052) / (np.std(friction) + 1e-9)
    left[movement_start:movement_start + movement_count] += friction
    right[movement_start:movement_start + movement_count] += np.roll(friction, 5 + variant * 2) * 0.94

    # Irregular hinge stick-slip squeaks. Each short resonance bends downward.
    squeak_times = (0.074, 0.128 + variant * 0.004, 0.205, 0.286 + variant * 0.006)
    base = (370, 510, 430, 320) if material == "wood" else (920, 1260, 1080, 760)
    for index, start in enumerate(squeak_times):
        duration = 0.060 + rng.random() * 0.035
        frequency = base[index] * (0.94 + rng.random() * 0.12)
        add_mode(left, start, frequency, duration, 0.055 if material == "wood" else 0.042, rng)
        add_mode(right, start + 0.0008, frequency * 0.992, duration, 0.052 if material == "wood" else 0.045, rng)

    # Broad panel/body resonance makes the moving object feel full-sized.
    body_noise = lowpass(rng.standard_normal(count), 230 if material == "wood" else 340)
    body_env = np.zeros(count)
    body_env[movement_start:movement_start + movement_count] = np.sin(np.pi * np.arange(movement_count) / movement_count)
    body_noise *= body_env * (0.065 if material == "wood" else 0.045)
    left += body_noise
    right += np.roll(body_noise, 9) * 0.96

    # A restrained frame flex near the end, not a closing slam.
    flex_start = 0.345 + variant * 0.008
    flex_len = int(0.075 * SAMPLE_RATE)
    flex = burst(rng, flex_len, 0.025, 85, 950 if material == "wood" else 1700)
    flex *= (0.105 if material == "wood" else 0.078) / (np.max(np.abs(flex)) + 1e-9)
    begin = int(flex_start * SAMPLE_RATE)
    left[begin:begin + flex_len] += flex
    right[begin:begin + flex_len] += np.roll(flex, 4) * 0.9

    stereo = np.stack([left, right], axis=1)
    stereo = np.tanh(stereo * 1.18)
    peak = np.max(np.abs(stereo)) + 1e-9
    stereo *= (0.46 if material == "wood" else 0.42) / peak
    fade = int(0.025 * SAMPLE_RATE)
    stereo[-fade:] *= np.linspace(1, 0, fade)[:, None]
    return stereo


def write_wav(path: Path, audio: np.ndarray) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    pcm = np.clip(audio, -1, 1)
    pcm = (pcm * 32767).astype("<i2")
    with wave.open(str(path), "wb") as output:
        output.setnchannels(2)
        output.setsampwidth(2)
        output.setframerate(SAMPLE_RATE)
        output.writeframes(pcm.tobytes())


for door_material in ("wood", "metal"):
    for door_variant in range(3):
        write_wav(
            OUTPUT / door_material / f"{door_material}-{door_variant + 1}.wav",
            render(door_material, door_variant),
        )

