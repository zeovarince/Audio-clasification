"""Modul inferensi machine learning untuk SilentGuard Lab."""

import os
from pathlib import Path
from typing import List, Tuple
import joblib
import numpy as np

from features import extract_features

# Cari lokasi MODEL_DIR dari variabel lingkungan atau default relatif
_env_model_dir = os.environ.get("MODEL_DIR", "../model2.0")
_candidate_dirs = [
    Path(_env_model_dir).resolve(),
    Path(__file__).resolve().parent.parent / "model2.0",
    Path(__file__).resolve().parent / "models",
    Path("model2.0").resolve(),
    Path("models").resolve(),
]

MODEL_DIR = None
for candidate in _candidate_dirs:
    if candidate.exists() and (candidate / "model_klasifikasi_berisik.joblib").exists():
        MODEL_DIR = candidate
        break
    if candidate.exists() and (candidate / "model_klasifikasi_berisik.pkl").exists():
        MODEL_DIR = candidate
        break

if MODEL_DIR is None:
    # Default fallback ke kandidat pertama
    MODEL_DIR = _candidate_dirs[0]

MODEL_PATH = MODEL_DIR / "model_klasifikasi_berisik.joblib"
if not MODEL_PATH.exists():
    MODEL_PATH = MODEL_DIR / "model_klasifikasi_berisik.pkl"

_bundle = None
_model = None
_feature_columns: List[str] = []
_sample_rate: int = 22050
_noisy_index: int = 1


def load_model():
    """Memuat model klasifikasi ke memori saat startup server."""
    global _bundle, _model, _feature_columns, _sample_rate, _noisy_index

    if not MODEL_PATH.exists():
        raise FileNotFoundError(
            f"File model tidak ditemukan di {MODEL_PATH}. "
            f"Pastikan MODEL_DIR diarahkan ke folder model2.0 yang berisi file model."
        )

    _bundle = joblib.load(MODEL_PATH)
    _model = _bundle["model"]
    _feature_columns = list(_bundle["features"])
    _sample_rate = int(_bundle.get("sr", 22050))

    # Temukan indeks kelas "berisik" (label 1) secara dinamis dari model.classes_
    classes = _model.classes_
    noisy_positions = np.where(classes == 1)[0]
    if len(noisy_positions) > 0:
        _noisy_index = int(noisy_positions[0])
    else:
        # Fallback jika classes_ bertipe string
        noisy_positions = np.where(classes == "berisik")[0]
        if len(noisy_positions) > 0:
            _noisy_index = int(noisy_positions[0])
        else:
            _noisy_index = 1

    # Lakukan warm-up forward pass agar inferensi awal tidak tertunda
    try:
        dummy_audio = np.zeros(_sample_rate * 2, dtype=np.float32)
        predict_noise_probability(dummy_audio, _sample_rate)
    except Exception:
        pass

    return _model


def get_model_info():
    """Mengembalikan informasi status dan konfigurasi model."""
    import sklearn

    return {
        "model_loaded": _model is not None,
        "model_path": str(MODEL_PATH),
        "sample_rate": _sample_rate,
        "feature_count": len(_feature_columns),
        "classes": [int(c) if isinstance(c, (int, np.integer)) else str(c) for c in getattr(_model, "classes_", [0, 1])],
        "noisy_class_index": _noisy_index,
        "sklearn_version": sklearn.__version__,
    }


def predict_noise_probability(samples: np.ndarray, sample_rate: int) -> Tuple[float, str]:
    """Menghitung probabilitas suara berisik dari array sampel audio mono float32.

    Args:
        samples: Array numpy float32 dalam rentang -1.0 sampai 1.0
        sample_rate: Sample rate audio, harus sesuai model (22050 Hz)

    Returns:
        Tuple (noise_probability, label)
    """
    if _model is None:
        load_model()

    # Ekstraksi 100 fitur spektral
    features_dict = extract_features(samples, sr=sample_rate)

    # Susun vektor fitur dalam urutan tepat yang diharapkan model pipeline
    vector = np.array([[features_dict[col] for col in _feature_columns]], dtype=np.float64)

    # Prediksi probabilitas dari pipeline (StandardScaler -> SelectKBest -> SVC)
    probabilities = _model.predict_proba(vector)[0]
    noise_prob = float(probabilities[_noisy_index])

    # Tentukan label hasil klasifikasi
    label = "berisik" if noise_prob >= 0.5 else "non-berisik"

    return noise_prob, label
