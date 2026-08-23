"""Render the original layered Surviv firearm library.

The source is deterministic and sample-free: every shot is assembled from
separately filtered pressure, body, muzzle-crack, mechanism and early-reflection
layers. Re-run this file whenever a profile is intentionally rebalanced.
"""

from __future__ import annotations

import json
import math
import wave
from pathlib import Path

import numpy as np
from scipy.signal import butter, sosfilt


SAMPLE_RATE = 48_000
VARIANTS = 3
OUTPUT_ROOT = Path(__file__).resolve().parents[1] / "public" / "audio" / "surviv" / "gunshots"


PROFILES = {
    "pistol": {
        "duration": 0.255, "crack": 0.92, "crack_decay": 0.0065, "crack_hp": 1700,
        "body": 0.70, "body_band": (190, 2700), "body_decay": 0.047,
        "pressure": 0.30, "pressure_band": (48, 310), "pressure_decay": 0.060,
        "mechanical": 0.13, "mechanical_delays": (0.020, 0.037),
        "tail": 0.19, "tail_band": (250, 4800), "tail_decay": 0.105,
        "stereo": 0.065, "drive": 1.22, "peak": 0.72,
    },
    "revolver": {
        "duration": 0.340, "crack": 1.02, "crack_decay": 0.0085, "crack_hp": 1450,
        "body": 0.84, "body_band": (145, 2450), "body_decay": 0.066,
        "pressure": 0.48, "pressure_band": (42, 285), "pressure_decay": 0.085,
        "mechanical": 0.09, "mechanical_delays": (0.026,),
        "tail": 0.25, "tail_band": (190, 4300), "tail_decay": 0.150,
        "stereo": 0.075, "drive": 1.28, "peak": 0.80,
    },
    "smg": {
        "duration": 0.180, "crack": 0.90, "crack_decay": 0.0047, "crack_hp": 1950,
        "body": 0.57, "body_band": (245, 3100), "body_decay": 0.032,
        "pressure": 0.19, "pressure_band": (65, 350), "pressure_decay": 0.042,
        "mechanical": 0.18, "mechanical_delays": (0.014, 0.028),
        "tail": 0.11, "tail_band": (380, 5400), "tail_decay": 0.070,
        "stereo": 0.040, "drive": 1.18, "peak": 0.67,
    },
    "assault": {
        "duration": 0.270, "crack": 1.02, "crack_decay": 0.0062, "crack_hp": 1800,
        "body": 0.82, "body_band": (155, 2850), "body_decay": 0.052,
        "pressure": 0.42, "pressure_band": (43, 300), "pressure_decay": 0.070,
        "mechanical": 0.15, "mechanical_delays": (0.017, 0.033),
        "tail": 0.20, "tail_band": (240, 5000), "tail_decay": 0.115,
        "stereo": 0.055, "drive": 1.25, "peak": 0.78,
    },
    "shotgun": {
        "duration": 0.430, "crack": 0.88, "crack_decay": 0.0110, "crack_hp": 1100,
        "body": 1.02, "body_band": (105, 2250), "body_decay": 0.088,
        "pressure": 0.72, "pressure_band": (35, 260), "pressure_decay": 0.125,
        "mechanical": 0.08, "mechanical_delays": (0.048,),
        "tail": 0.34, "tail_band": (145, 3900), "tail_decay": 0.205,
        "stereo": 0.115, "drive": 1.34, "peak": 0.88, "rough": 0.30,
    },
    "dmr": {
        "duration": 0.390, "crack": 1.12, "crack_decay": 0.0075, "crack_hp": 1650,
        "body": 0.94, "body_band": (120, 2600), "body_decay": 0.073,
        "pressure": 0.58, "pressure_band": (38, 275), "pressure_decay": 0.098,
        "mechanical": 0.12, "mechanical_delays": (0.024, 0.046),
        "tail": 0.30, "tail_band": (165, 4400), "tail_decay": 0.185,
        "stereo": 0.085, "drive": 1.30, "peak": 0.84,
    },
    "sniper": {
        "duration": 0.620, "crack": 1.25, "crack_decay": 0.0090, "crack_hp": 1500,
        "body": 1.05, "body_band": (90, 2450), "body_decay": 0.095,
        "pressure": 0.78, "pressure_band": (31, 245), "pressure_decay": 0.155,
        "mechanical": 0.055, "mechanical_delays": (0.070,),
        "tail": 0.44, "tail_band": (120, 4100), "tail_decay": 0.285,
        "stereo": 0.140, "drive": 1.38, "peak": 0.92,
    },
    "lmg": {
        "duration": 0.245, "crack": 0.96, "crack_decay": 0.0058, "crack_hp": 1750,
        "body": 0.78, "body_band": (145, 2750), "body_decay": 0.049,
        "pressure": 0.39, "pressure_band": (42, 300), "pressure_decay": 0.067,
        "mechanical": 0.23, "mechanical_delays": (0.013, 0.026, 0.043),
        "tail": 0.16, "tail_band": (270, 4800), "tail_decay": 0.098,
        "stereo": 0.050, "drive": 1.30, "peak": 0.76,
    },
}


def envelope(t: np.ndarray, attack: float, decay: float, delay: float = 0.0) -> np.ndarray:
    local = np.maximum(0.0, t - delay)
    active = t >= delay
    return active * (1.0 - np.exp(-local / max(attack, 1e-5))) * np.exp(-local / decay)


def filtered_noise(rng: np.random.Generator, length: int, low: float | None, high: float | None,
                   order: int = 2) -> np.ndarray:
    noise = rng.standard_normal(length)
    nyquist = SAMPLE_RATE / 2
    if low and high:
        sos = butter(order, (low / nyquist, high / nyquist), btype="bandpass", output="sos")
    elif low:
        sos = butter(order, low / nyquist, btype="highpass", output="sos")
    elif high:
        sos = butter(order, high / nyquist, btype="lowpass", output="sos")
    else:
        return noise
    return sosfilt(sos, noise)


def normalized(signal: np.ndarray) -> np.ndarray:
    rms = math.sqrt(float(np.mean(signal * signal)) + 1e-12)
    return signal / rms


def add_microburst(destination: np.ndarray, source: np.ndarray, t: np.ndarray, delay: float,
                   attack: float, decay: float, gain: float) -> None:
    destination += normalized(source) * envelope(t, attack, decay, delay) * gain


def render_shot(weapon: str, variant: int) -> np.ndarray:
    profile = PROFILES[weapon]
    rng = np.random.default_rng(0x5A17 + variant * 7919 + list(PROFILES).index(weapon) * 104729)
    length = int(profile["duration"] * SAMPLE_RATE)
    t = np.arange(length) / SAMPLE_RATE
    variance = 1.0 + rng.uniform(-0.035, 0.035)

    # Supersonic/muzzle transient: two differently coloured, sub-10 ms cracks.
    crack = np.zeros(length)
    crack_source = filtered_noise(rng, length, profile["crack_hp"] * variance, 15_500, 2)
    add_microburst(crack, crack_source, t, 0.00010, 0.000055, profile["crack_decay"], profile["crack"])
    snap_source = filtered_noise(rng, length, 760 * variance, 8_500, 2)
    add_microburst(crack, snap_source, t, 0.00072 + rng.uniform(0, 0.00022), 0.00010,
                   profile["crack_decay"] * 1.55, profile["crack"] * 0.42)

    # Combustion/body uses overlapping broad bands instead of a pitched tone.
    body = np.zeros(length)
    body_low, body_high = profile["body_band"]
    body_source = filtered_noise(rng, length, body_low * variance, body_high * variance, 2)
    add_microburst(body, body_source, t, 0.00055, 0.00035, profile["body_decay"], profile["body"])
    body_texture = filtered_noise(rng, length, body_low * 1.6, body_high * 1.45, 2)
    add_microburst(body, body_texture, t, 0.0021 + rng.uniform(0, 0.0008), 0.0008,
                   profile["body_decay"] * 0.72, profile["body"] * 0.34)

    # Broad, non-tonal pressure wave. A second delayed push gives large weapons
    # physical weight without resorting to a sine drop or distorted sub bass.
    pressure = np.zeros(length)
    pressure_low, pressure_high = profile["pressure_band"]
    pressure_source = filtered_noise(rng, length, pressure_low, pressure_high * variance, 2)
    add_microburst(pressure, pressure_source, t, 0.0009, 0.0015,
                   profile["pressure_decay"], profile["pressure"])
    add_microburst(
        pressure,
        filtered_noise(rng, length, pressure_low, pressure_high * 1.35, 2),
        t,
        0.0040 + rng.uniform(0, 0.0015),
        0.0018,
        profile["pressure_decay"] * 0.68,
        profile["pressure"] * 0.30,
    )

    # Action/casing texture: tiny broad clacks, intentionally low in the mix.
    mechanical = np.zeros(length)
    for index, base_delay in enumerate(profile["mechanical_delays"]):
        delay = base_delay + rng.uniform(-0.0015, 0.0018)
        mech_source = filtered_noise(rng, length, 900 + index * 180, 7_200 - index * 350, 2)
        add_microburst(mechanical, mech_source, t, delay, 0.00008, 0.0038 + index * 0.0015,
                       profile["mechanical"] * (0.82 ** index))

    # Natural close-range tail: irregular early reflections over diffuse air,
    # kept short enough that automatic fire stays articulate.
    tail_low, tail_high = profile["tail_band"]
    tail_source = normalized(filtered_noise(rng, length, tail_low, tail_high, 2))
    tail = tail_source * envelope(t, 0.004, profile["tail_decay"], 0.006) * profile["tail"]
    reflection_source = normalized(filtered_noise(rng, length, tail_low * 1.15, tail_high * 0.88, 2))
    for index, delay in enumerate((0.013, 0.026, 0.044)):
        gain = profile["tail"] * (0.20 / (index + 1)) * rng.uniform(0.82, 1.14)
        tail += reflection_source * envelope(t, 0.0007, profile["tail_decay"] * 0.62, delay) * gain

    if profile.get("rough"):
        rough_source = filtered_noise(rng, length, 180, 6_500, 1)
        body += normalized(rough_source) * envelope(t, 0.0005, 0.055, 0.0015) * profile["rough"]

    mono = crack + body + pressure + mechanical + tail

    # Only the diffuse tail receives stereo width; the pressure and muzzle
    # transient remain centred and phase-stable like a close firearm recording.
    side = normalized(filtered_noise(rng, length, 320, 6_200, 2))
    side *= envelope(t, 0.006, profile["tail_decay"] * 0.92, 0.008) * profile["stereo"]
    left = mono + side
    right = mono - side * 0.92
    stereo = np.column_stack((left, right))

    # Remove DC, apply gentle bus saturation and retain deliberate loudness
    # differences through profile-specific energy and peak targets.
    dc_filter = butter(2, 24 / (SAMPLE_RATE / 2), btype="highpass", output="sos")
    stereo[:, 0] = sosfilt(dc_filter, stereo[:, 0])
    stereo[:, 1] = sosfilt(dc_filter, stereo[:, 1])
    drive = profile["drive"]
    stereo = np.tanh(stereo * drive) / math.tanh(drive)
    # Non-linear saturation can reintroduce a minute asymmetrical offset.
    stereo[:, 0] = sosfilt(dc_filter, stereo[:, 0])
    stereo[:, 1] = sosfilt(dc_filter, stereo[:, 1])
    fade_samples = max(16, int(0.018 * SAMPLE_RATE))
    stereo[-fade_samples:] *= np.linspace(1.0, 0.0, fade_samples)[:, None]
    peak = float(np.max(np.abs(stereo))) or 1.0
    stereo *= (profile["peak"] + (variant - 1) * 0.006) / peak
    return stereo


def write_wav(path: Path, stereo: np.ndarray) -> dict[str, float | int | str]:
    path.parent.mkdir(parents=True, exist_ok=True)
    pcm = np.clip(stereo, -1.0, 1.0)
    pcm16 = np.round(pcm * 32767).astype("<i2")
    with wave.open(str(path), "wb") as output:
        output.setnchannels(2)
        output.setsampwidth(2)
        output.setframerate(SAMPLE_RATE)
        output.writeframes(pcm16.tobytes())
    mono = stereo.mean(axis=1)
    return {
        "file": path.relative_to(OUTPUT_ROOT.parent.parent.parent.parent).as_posix(),
        "frames": len(stereo),
        "durationSeconds": round(len(stereo) / SAMPLE_RATE, 3),
        "peakDbfs": round(20 * math.log10(float(np.max(np.abs(stereo))) + 1e-12), 2),
        "rmsDbfs": round(20 * math.log10(math.sqrt(float(np.mean(mono * mono))) + 1e-12), 2),
    }


def main() -> None:
    manifest = {"sampleRate": SAMPLE_RATE, "variantsPerWeapon": VARIANTS, "weapons": {}}
    for weapon in PROFILES:
        rendered = []
        for variant in range(1, VARIANTS + 1):
            audio = render_shot(weapon, variant)
            path = OUTPUT_ROOT / weapon / f"{weapon}-{variant}.wav"
            rendered.append(write_wav(path, audio))
        manifest["weapons"][weapon] = rendered
    manifest_path = OUTPUT_ROOT / "manifest.json"
    manifest_path.write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
    print(f"Rendered {len(PROFILES) * VARIANTS} original gunshots to {OUTPUT_ROOT}")


if __name__ == "__main__":
    main()
