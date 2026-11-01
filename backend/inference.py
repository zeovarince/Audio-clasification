"""Modul inferensi machine learning untuk SilentGuard Lab."""

import os
from pathlib import Path
from typing import List, Tuple
import warnings
import joblib
import numpy as np

from features import extract_features

# Artefak aktif dashboard: Model 3.0 VotingClassifier (SVM + LightGBM + ExtraTrees) dengan threshold 0.50.
EXPECTED_MODEL_VERSION = "3.0"
EXPECTED_FEATURE_COUNT = 107
EXPECTED_SELECTED_FEATURE_COUNT = 70
EXPECTED_SELECTED_FEATURES_BY_ESTIMATOR = {"svm": 70, "lgb": 60, "et": 65}
EXPECTED_DECISION_THRESHOLD = 0.50
MODEL_FILENAME = "MODEL_KLASIFIKASIV3-0.joblib"
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
_selected_feature_count: int = EXPECTED_SELECTED_FEATURE_COUNT
_selected_features_by_estimator = {}


def load_model():
    """Memuat model klasifikasi ke memori saat startup server."""
    global _bundle, _model, _feature_columns, _sample_rate, _noisy_index, _decision_threshold, _selected_feature_count, _selected_features_by_estimator

    if not MODEL_PATH.is_file():
        raise FileNotFoundError(
            f"Artefak Model {EXPECTED_MODEL_VERSION} tidak ditemukan di {MODEL_PATH}. "
            f"Backend hanya menggunakan {MODEL_FILENAME}."
        )

    loaded_bundle = joblib.load(MODEL_PATH)
    actual_version = str(loaded_bundle.get("version", ""))
    if not actual_version.startswith(EXPECTED_MODEL_VERSION):
        raise ValueError(
            f"Diharapkan Model {EXPECTED_MODEL_VERSION}, tetapi artefak berisi versi "
            f"{actual_version or 'tidak diketahui'} di {MODEL_PATH}."
        )
    loaded_model = loaded_bundle["model"]
    feature_columns = list(loaded_bundle["features"])
    sample_rate = int(loaded_bundle.get("sr", 22050))
    decision_threshold = float(
        loaded_bundle.get(
            "threshold",
            loaded_bundle.get("optimal_threshold", EXPECTED_DECISION_THRESHOLD),
        )
    )
    if not np.isfinite(decision_threshold) or not 0.0 < decision_threshold < 1.0:
        raise ValueError(f"Ambang keputusan model tidak valid: {decision_threshold}")
    if not np.isclose(decision_threshold, EXPECTED_DECISION_THRESHOLD):
        raise ValueError(
            f"Threshold Model 3.0 harus {EXPECTED_DECISION_THRESHOLD:.2f}; "
            f"artefak ini memakai {decision_threshold:.2f}."
        )

    if len(feature_columns) != EXPECTED_FEATURE_COUNT or len(set(feature_columns)) != EXPECTED_FEATURE_COUNT:
        raise ValueError(
            f"Model {EXPECTED_MODEL_VERSION} harus memakai {EXPECTED_FEATURE_COUNT} fitur; "
            f"artefak ini meminta {len(feature_columns)} fitur unik."
        )

    # Validasi arsitektur dan reduksi fitur khusus Model 3.0.
    named_estimators = getattr(loaded_model, "named_estimators_", {})
    if getattr(loaded_model, "voting", None) != "soft" or set(named_estimators) != set(EXPECTED_SELECTED_FEATURES_BY_ESTIMATOR):
        raise ValueError("Artefak bukan soft-voting ensemble Model 3.0 (svm, lgb, et).")
    selected_features = {}
    for name, expected_count in EXPECTED_SELECTED_FEATURES_BY_ESTIMATOR.items():
        estimator = named_estimators[name]
        selector = getattr(estimator, "named_steps", {}).get("selector")
        if selector is None or not hasattr(selector, "get_support"):
            raise ValueError(f"Selector fitur Model 3.0 tidak ditemukan pada estimator {name}.")
        selected_features[name] = int(selector.get_support().sum())
        if selected_features[name] != expected_count:
            raise ValueError(
                f"Estimator {name} seharusnya memilih {expected_count} fitur, "
                f"artefak memilih {selected_features[name]}."
            )

    # Set status setelah semua metadata artefak lolos validasi.
    _bundle = loaded_bundle
    _model = loaded_model
    _feature_columns = feature_columns
    _sample_rate = sample_rate
    _decision_threshold = decision_threshold
    _selected_features_by_estimator = selected_features
    _selected_feature_count = selected_features["svm"]

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
        "model_artifact": MODEL_PATH.name,
        "model_path": str(MODEL_PATH),
        "sample_rate": _sample_rate,
        "feature_count": len(_feature_columns),
        "selected_feature_count": _selected_feature_count if _model is not None else 0,
        "selected_features_by_estimator": _selected_features_by_estimator if _model is not None else {},
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

    # Ekstrak fitur lalu susun 107 kolom yang dipakai artefak Model 3.0.
    features_dict = extract_features(samples, sr=sample_rate)
    missing_features = [name for name in _feature_columns if name not in features_dict]
    unexpected_features = [name for name in features_dict if name not in _feature_columns]
    if missing_features or unexpected_features:
        raise ValueError(
            "Skema fitur backend tidak cocok dengan Model 3.0. "
            f"Kurang: {missing_features}; ekstra: {unexpected_features}."
        )

    # Susun vektor fitur dalam urutan tepat yang diharapkan model pipeline
    vector = np.array([[features_dict[col] for col in _feature_columns]], dtype=np.float64)

    # Prediksi probabilitas dari VotingClassifier ensemble (SVM + LightGBM + ExtraTrees)
    with warnings.catch_warnings():
        warnings.simplefilter("ignore")
        probabilities = _model.predict_proba(vector)[0]
    noise_prob = float(probabilities[_noisy_index])

    # Tentukan label hasil klasifikasi
    label = "berisik" if noise_prob >= _decision_threshold else "non-berisik"

    return noise_prob, label

