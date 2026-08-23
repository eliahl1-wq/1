"""Objective guardrails for the generated Surviv firearm library."""

from __future__ import annotations

import json
import math
import wave
from pathlib import Path

import numpy as np


ROOT = Path(__file__).resolve().parents[1] / "public" / "audio" / "surviv" / "gunshots"
EXPECTED_WEAPONS = {"pistol", "revolver", "smg", "assault", "shotgun", "dmr", "sniper", "lmg"}


def read_wav(path: Path) -> tuple[int, np.ndarray]:
    with wave.open(str(path), "rb") as source:
        assert source.getnchannels() == 2, f"{path}: expected stereo"
        assert source.getsampwidth() == 2, f"{path}: expected PCM16"
        rate = source.getframerate()
        frames = source.readframes(source.getnframes())
    return rate, np.frombuffer(frames, dtype="<i2").reshape(-1, 2).astype(np.float64) / 32768


def band_share(signal: np.ndarray, rate: int, low: float, high: float) -> float:
    windowed = signal * np.hanning(len(signal))
    spectrum = np.abs(np.fft.rfft(windowed)) ** 2
    frequencies = np.fft.rfftfreq(len(signal), 1 / rate)
    selected = (frequencies >= low) & (frequencies < high)
    return float(spectrum[selected].sum() / max(1e-12, spectrum.sum()))


def main() -> None:
    manifest = json.loads((ROOT / "manifest.json").read_text(encoding="utf-8"))
    assert set(manifest["weapons"]) == EXPECTED_WEAPONS
    assert manifest["variantsPerWeapon"] >= 3
    assert len(manifest.get("explosions", {}).get("grenade", [])) >= 3
    reports = {}

    for weapon, entries in manifest["weapons"].items():
        variants = []
        for entry in entries:
            path = ROOT.parent.parent.parent.parent / entry["file"]
            rate, stereo = read_wav(path)
            assert rate == 48_000, f"{path}: unexpected sample rate"
            assert np.isfinite(stereo).all(), f"{path}: non-finite samples"
            peak = float(np.abs(stereo).max())
            assert 0.58 < peak < 0.96, f"{path}: unsafe or weak peak {peak:.3f}"
            assert not np.any(np.abs(stereo) >= 0.999), f"{path}: clipped samples"
            assert abs(float(stereo.mean())) < 0.002, f"{path}: DC offset"

            mono = stereo.mean(axis=1)
            onset = mono[: max(1, int(rate * 0.018))]
            late = mono[int(len(mono) * 0.70):]
            onset_rms = math.sqrt(float(np.mean(onset * onset)) + 1e-12)
            late_rms = math.sqrt(float(np.mean(late * late)) + 1e-12)
            transient_db = 20 * math.log10(onset_rms / late_rms)
            assert transient_db > 7.5, f"{path}: tail masks transient ({transient_db:.1f} dB)"

            bands = {
                "pressure": band_share(mono, rate, 30, 250),
                "body": band_share(mono, rate, 250, 2500),
                "texture": band_share(mono, rate, 2500, 16_000),
            }
            assert bands["body"] > 0.12, f"{path}: insufficient gunshot body"
            assert bands["texture"] > 0.006, f"{path}: insufficient muzzle texture"
            variants.append(mono)

        correlations = []
        for index in range(len(variants) - 1):
            correlations.append(float(np.corrcoef(variants[index], variants[index + 1])[0, 1]))
        assert max(abs(value) for value in correlations) < 0.35, f"{weapon}: variants are too similar"
        first = variants[0]
        reports[weapon] = {
            "duration": round(len(first) / 48_000, 3),
            "crestDb": round(20 * math.log10(np.abs(first).max() / math.sqrt(np.mean(first * first))), 2),
            "pressurePercent": round(band_share(first, 48_000, 30, 250) * 100, 1),
            "bodyPercent": round(band_share(first, 48_000, 250, 2500) * 100, 1),
            "texturePercent": round(band_share(first, 48_000, 2500, 16_000) * 100, 1),
        }

    explosion_variants = []
    for entry in manifest["explosions"]["grenade"]:
        path = ROOT.parent.parent.parent.parent / entry["file"]
        rate, stereo = read_wav(path)
        assert rate == 48_000, f"{path}: unexpected sample rate"
        peak = float(np.abs(stereo).max())
        assert 0.75 < peak < 0.96, f"{path}: unsafe or weak peak {peak:.3f}"
        assert not np.any(np.abs(stereo) >= 0.999), f"{path}: clipped samples"
        assert abs(float(stereo.mean())) < 0.002, f"{path}: DC offset"
        mono = stereo.mean(axis=1)
        onset = mono[: int(rate * 0.022)]
        late = mono[int(len(mono) * 0.72):]
        onset_rms = math.sqrt(float(np.mean(onset * onset)) + 1e-12)
        late_rms = math.sqrt(float(np.mean(late * late)) + 1e-12)
        assert 20 * math.log10(onset_rms / late_rms) > 7.5, f"{path}: blast transient is masked"
        assert band_share(mono, rate, 30, 250) > 0.18, f"{path}: insufficient pressure"
        assert band_share(mono, rate, 250, 2500) > 0.12, f"{path}: insufficient blast body"
        assert band_share(mono, rate, 2500, 16_000) > 0.004, f"{path}: insufficient debris texture"
        explosion_variants.append(mono)

    explosion_correlations = [
        float(np.corrcoef(explosion_variants[index], explosion_variants[index + 1])[0, 1])
        for index in range(len(explosion_variants) - 1)
    ]
    assert max(abs(value) for value in explosion_correlations) < 0.35, "grenade variants are too similar"
    grenade = explosion_variants[0]
    explosion_report = {
        "duration": round(len(grenade) / 48_000, 3),
        "crestDb": round(20 * math.log10(np.abs(grenade).max() / math.sqrt(np.mean(grenade * grenade))), 2),
        "pressurePercent": round(band_share(grenade, 48_000, 30, 250) * 100, 1),
        "bodyPercent": round(band_share(grenade, 48_000, 250, 2500) * 100, 1),
        "debrisPercent": round(band_share(grenade, 48_000, 2500, 16_000) * 100, 1),
    }
    total_files = sum(len(value) for value in manifest["weapons"].values()) + len(explosion_variants)
    print(json.dumps({
        "files": total_files,
        "weapons": reports,
        "explosions": {"grenade": explosion_report},
    }, indent=2))


if __name__ == "__main__":
    main()
