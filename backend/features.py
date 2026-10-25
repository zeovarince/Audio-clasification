"""Modul ekstraksi fitur audio untuk SilentGuard Lab.

Logika ekstraksi fitur di sini disalin persis dari model training
(Cell 14 pada model2.0/klasifikasi_berisik_audio.ipynb) untuk memastikan
paritas 100% antara training dan inferensi.
"""

from typing import Dict
import numpy as np
import librosa


def extract_features(y: np.ndarray, sr: int = 22050) -> Dict[str, float]:
    """Ekstraksi 100 fitur spektral, energi, dan MFCC dari array audio mono float32.

    Args:
        y: Sinyal audio mono float32 (amplitudo ternormalisasi -1.0 sampai 1.0)
        sr: Sample rate audio (default 22050 Hz)

    Returns:
        Dictionary berisi 100 fitur numerik.
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

    return f
