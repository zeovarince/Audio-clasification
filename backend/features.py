"""Modul ekstraksi fitur audio untuk SilentGuard Lab.

Logika ekstraksi fitur di sini disalin persis dari model training
(Cell 14 pada model2.0/klasifikasi_berisik_audio.ipynb) untuk memastikan
paritas 100% antara training dan inferensi.
"""

from typing import Dict
import numpy as np
import librosa


def extract_features(y: np.ndarray, sr: int = 22050) -> Dict[str, float]:
    """Ekstraksi 112 fitur Model 4.0 dari audio mono float32.

    Args:
        y: Sinyal audio mono float32 (amplitudo ternormalisasi -1.0 sampai 1.0)
        sr: Sample rate audio (default 22050 Hz)

    Returns:
        Dictionary berisi 112 fitur numerik sesuai urutan fitur model.
    """
    f: Dict[str, float] = {}
    S = np.abs(librosa.stft(y, n_fft=2048, hop_length=512))

    # --- 1. Energi RMS dalam dB ---
    rms = librosa.feature.rms(S=S)[0]
    rms_db = librosa.amplitude_to_db(rms + 1e-10, ref=1.0)
    pct = np.percentile(rms_db, [5, 10, 25, 50, 75, 90, 95])
    for q, v in zip([5, 10, 25, 50, 75, 90, 95], pct):
        f[f"rmsdb_p{q}"] = float(v)
    f["dyn_range"] = float(pct[-1] - pct[0])
    f["snr_est"] = float(pct[-1] - pct[1])
    f["rmsdb_std"] = float(rms_db.std())

    # --- 2. Frame tersunyi (noise floor) & spektral ---
    quiet = rms_db <= np.percentile(rms_db, 20)
    flat = librosa.feature.spectral_flatness(S=S)[0]
    cent = librosa.feature.spectral_centroid(S=S, sr=sr)[0]
    zcr = librosa.feature.zero_crossing_rate(y, hop_length=512)[0][: S.shape[1]]

    spectral_features = {
        "flat": flat,
        "cent": cent,
        "zcr": zcr,
        "bw": librosa.feature.spectral_bandwidth(S=S, sr=sr)[0],
        "roll": librosa.feature.spectral_rolloff(S=S, sr=sr)[0],
    }

    for nama, v in spectral_features.items():
        v = v[: len(quiet)]
        f[f"{nama}_mean"] = float(v.mean())
        f[f"{nama}_std"] = float(v.std())
        quiet_part = v[quiet[: len(v)]]
        f[f"{nama}_quiet"] = float(quiet_part.mean() if len(quiet_part) > 0 else v.mean())

    # --- 3. MFCC (1 sampai 20) ---
    mel = librosa.power_to_db(librosa.feature.melspectrogram(S=S**2, sr=sr, n_mels=40))
    mfcc = librosa.feature.mfcc(S=mel, n_mfcc=20)
    for i in range(20):
        f[f"mfcc{i + 1}_mean"] = float(mfcc[i].mean())
        f[f"mfcc{i + 1}_std"] = float(mfcc[i].std())
        mfcc_quiet = mfcc[i][quiet]
        f[f"mfcc{i + 1}_quiet"] = float(mfcc_quiet.mean() if len(mfcc_quiet) > 0 else mfcc[i].mean())

    # --- 4. Noise floor per band mel (8 band) ---
    mq = mel[:, quiet].mean(axis=1) if np.any(quiet) else mel.mean(axis=1)
    for i, band in enumerate(np.array_split(mq, 8)):
        f[f"noise_band{i + 1}"] = float(band.mean())

    # --- 5. Spectral contrast (7 band) ---
    con = librosa.feature.spectral_contrast(S=S, sr=sr)
    for i in range(con.shape[0]):
        f[f"contrast{i + 1}"] = float(con[i].mean())

    # --- 6. Rekayasa fitur spektral Model 3.0 ---
    fft_freqs = librosa.fft_frequencies(sr=sr, n_fft=2048)
    power_spec = S**2
    total_power = np.sum(power_spec, axis=0) + 1e-10

    hf_mask = fft_freqs >= 3000
    hf_energy = np.sum(power_spec[hf_mask, :], axis=0)
    f["dyn_ratio"] = float(f["dyn_range"] / (f["rmsdb_std"] + 1e-5))
    f["snr_dyn_ratio"] = float(f["snr_est"] / (f["dyn_range"] + 1e-5))
    f["hf_energy_ratio"] = float(np.mean(hf_energy / total_power))
    f["cent_bw_ratio"] = float(f["cent_mean"] / (f["bw_mean"] + 1e-5))
    f["roll_cent_ratio"] = float(f["roll_mean"] / (f["cent_mean"] + 1e-5))
    f["flat_cent_prod"] = float(f["flat_mean"] * f["cent_mean"])
    f["snr_ratio_p95_p5"] = float(f["rmsdb_p95"] / (abs(f["rmsdb_p5"]) + 1e-5))

    # --- 7. Fitur transien Model 4.0 ---
    f["peak_to_p50"] = float(f["rmsdb_p95"] - f["rmsdb_p50"])
    rms_linear = np.sqrt(np.mean(y**2)) + 1e-10
    f["crest_factor"] = float(np.max(np.abs(y)) / rms_linear)
    f["std_sum"] = float(f["rmsdb_std"] + f["cent_std"] / (f["cent_mean"] + 1e-5))

    vocal_mask = (fft_freqs >= 300) & (fft_freqs <= 3400)
    vocal_energy = np.sum(power_spec[vocal_mask, :], axis=0)
    f["vocal_ratio"] = float(np.mean(vocal_energy / total_power))

    hf_spectral_mask = fft_freqs >= 4000
    hf_spectral_energy = np.sum(power_spec[hf_spectral_mask, :], axis=0)
    f["hf_spectral"] = float(np.mean(hf_spectral_energy / total_power))

    return f
