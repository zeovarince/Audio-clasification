"""Modul inferensi machine learning untuk SilentGuard Lab."""

import os
from pathlib import Path
from typing import List, Tuple
import joblib
import numpy as np

from features import extract_features

# Artefak aktif dashboard: Model 5.0 Pure SVM RBF dengan threshold 0.60.
EXPECTED_MODEL_VERSION = "5.0"
EXPECTED_FEATURE_COUNT = 110
EXPECTED_SELECTED_FEATURE_COUNT = 80
EXPECTED_DECISION_THRESHOLD = 0.6
MODEL_FILENAME = "modelaudiov5.joblib"
_backend_dir = Path(__file__).resolve().parent
_env_model_dir = os.environ.get("MODEL_DIR")
MODEL_DIR = (
    Path(_env_model_dir).expanduser().resolve()
    if _env_model_dir
    else _backend_dir / "models"
)
MODEL_PATH = MODEL_DIR / MODEL_FILENAME

_bundle = None
_model = None
_feature_columns: List[str] = []
_sample_rate: int = 22050
_noisy_index: int = 1
_decision_threshold: float = EXPECTED_DECISION_THRESHOLD


def load_model():
    """Memuat model klasifikasi ke memori saat startup server."""
    global _bundle, _model, _feature_columns, _sample_rate, _noisy_index, _decision_threshold

    if not MODEL_PATH.exists():
        raise FileNotFoundError(
            f"Artefak Model {EXPECTED_MODEL_VERSION} tidak ditemukan di {MODEL_PATH}. "
            "Pastikan backend/models berisi modelaudiov5.joblib "
            "atau arahkan MODEL_DIR ke folder artefak Model 5.0."
        )

    _bundle = joblib.load(MODEL_PATH)
    actual_version = str(_bundle.get("version", ""))
    if not actual_version.startswith(EXPECTED_MODEL_VERSION):
        _bundle = None
        raise ValueError(
            f"Diharapkan Model {EXPECTED_MODEL_VERSION}, tetapi artefak berisi versi "
            f"{actual_version or 'tidak diketahui'} di {MODEL_PATH}."
        )
    _model = _bundle["model"]
    _feature_columns = list(_bundle["features"])
    _sample_rate = int(_bundle.get("sr", 22050))
    _decision_threshold = float(
        _bundle.get(
            "threshold",
            _bundle.get("optimal_threshold", EXPECTED_DECISION_THRESHOLD),
        )
    )
    if not np.isfinite(_decision_threshold) or not 0.0 < _decision_threshold < 1.0:
        raise ValueError(f"Ambang keputusan model tidak valid: {_decision_threshold}")
    if not np.isclose(_decision_threshold, EXPECTED_DECISION_THRESHOLD):
        _bundle = None
        _model = None
        _feature_columns = []
        raise ValueError(
            f"Threshold Model 5.0 harus {EXPECTED_DECISION_THRESHOLD:.2f}; "
            f"artefak ini memakai {_decision_threshold:.2f}."
        )

    actual_feature_count = len(_feature_columns)
    if actual_feature_count != EXPECTED_FEATURE_COUNT:
        _bundle = None
        _model = None
        _feature_columns = []
        raise ValueError(
            f"Model {EXPECTED_MODEL_VERSION} harus memakai {EXPECTED_FEATURE_COUNT} fitur; "
            f"artefak ini meminta {actual_feature_count}."
        )

    selector = getattr(_model, "named_steps", {}).get("selector")
    if selector is None or not hasattr(selector, "get_support"):
        _bundle = None
        _model = None
        _feature_columns = []
        raise ValueError("Pipeline Model 5.0 tidak memiliki SelectKBest yang diharapkan.")
    selected_feature_count = int(selector.get_support().sum())
    if selected_feature_count != EXPECTED_SELECTED_FEATURE_COUNT:
        _bundle = None
        _model = None
        _feature_columns = []
        raise ValueError(
            f"Model 5.0 harus memilih {EXPECTED_SELECTED_FEATURE_COUNT} fitur; "
            f"artefak ini memilih {selected_feature_count}."
        )

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

    # Warm-up juga memastikan fitur model tersedia sebelum service dianggap sehat.
    try:
        dummy_audio = np.zeros(_sample_rate * 2, dtype=np.float32)
        predict_noise_probability(dummy_audio, _sample_rate)
    except Exception:
        _bundle = None
        _model = None
        _feature_columns = []
        raise

    return _model


def get_model_info():
    """Mengembalikan informasi status dan konfigurasi model."""
    import sklearn

    return {
        "model_loaded": _model is not None,
        "model_version": EXPECTED_MODEL_VERSION if _model is not None else None,
        "model_path": str(MODEL_PATH),
        "sample_rate": _sample_rate,
        "feature_count": len(_feature_columns),
        "selected_feature_count": int(
            _model.named_steps["selector"].get_support().sum()
        ) if _model is not None else 0,
        "decision_threshold": _decision_threshold,
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

    # Ekstrak fitur lalu susun hanya 110 kolom yang dipakai artefak Model 5.0.
    features_dict = extract_features(samples, sr=sample_rate)

    # Susun vektor fitur dalam urutan tepat yang diharapkan model pipeline
    vector = np.array([[features_dict[col] for col in _feature_columns]], dtype=np.float64)

    # Prediksi probabilitas dari pipeline (StandardScaler -> SelectKBest -> SVC)
    probabilities = _model.predict_proba(vector)[0]
    noise_prob = float(probabilities[_noisy_index])

    # Tentukan label hasil klasifikasi
    label = "berisik" if noise_prob >= _decision_threshold else "non-berisik"

    return noise_prob, label
