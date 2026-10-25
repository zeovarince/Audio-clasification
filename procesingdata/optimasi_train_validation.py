"""Utilitas reproducible untuk fitur audio 28 kolom dan klasifikasi SVM.

Fungsi-fungsi di file ini dipanggil bertahap dari klasifikasi.ipynb agar setiap
tahap CRISP-DM dapat ditampilkan, diperiksa, dan dijalankan ulang di notebook.
"""

from __future__ import annotations

from functools import lru_cache
from pathlib import Path
import hashlib
import importlib.metadata as package_metadata
import json
import math
import re
import time
import warnings

import joblib
import numpy as np
import pandas as pd
import soundfile as sf
from scipy.fft import dct
from scipy.signal import resample_poly
from sklearn.metrics import (accuracy_score, classification_report,
                             confusion_matrix, f1_score,
                             precision_recall_fscore_support)
from sklearn.model_selection import GridSearchCV, StratifiedGroupKFold
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler
from sklearn.svm import SVC


HERE = Path(__file__).resolve().parent
ROOT = HERE.parent
ARTIFACTS = HERE / "artifacts"
SAMPLE_RATE = 16_000
WINDOW_SECONDS = 30.0
WINDOW_HOP_SECONDS = 15.0
RMS_FRAME_SECONDS = 1.0
RMS_HOP_SECONDS = 0.5
FFT_SIZE = 1024
FFT_HOP_SIZE = 512
N_MELS = 64
N_MFCC = 13
SEED = 42
CLASSES = ["non berisik", "berisik"]
LABEL_FOLDERS = {"berisik": "berisik", "non berisik": "non-berisik"}
AUDIO_EXTENSIONS = {".wav", ".mp3", ".flac", ".ogg", ".m4a", ".aac", ".wma"}

RMS_COLUMNS = [
    "rms_overall", "rms_frame_mean", "rms_frame_std",
    "rms_frame_min", "rms_frame_max",
]
SUMMARY_NAMES = ["mean", "std", "median", "p10", "p90"]
CENTROID_COLUMNS = [f"centroid_{name}" for name in SUMMARY_NAMES]
ZCR_COLUMNS = [f"zcr_{name}" for name in SUMMARY_NAMES]
MFCC_COLUMNS = [f"mfcc_{index:02d}" for index in range(N_MFCC)]
FEATURE_COLUMNS = RMS_COLUMNS + CENTROID_COLUMNS + ZCR_COLUMNS + MFCC_COLUMNS
FEATURE_VERSION = "rms5-centroid5-zcr5-mfcc13-v3"


def source_group(filename: str) -> str:
    """Ambil ID sumber dari awalan nama seperti 24-027; fallback per file."""
    match = re.match(r"^(\d+-\d+)", Path(filename).name)
    return match.group(1) if match else "file:" + Path(filename).name


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as audio_file:
        for block in iter(lambda: audio_file.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def inventory_audio(root: Path = ROOT) -> pd.DataFrame:
    """Audit file dan metadata dasar tanpa menyimpan path absolut ke CSV."""
    rows = []
    for label, folder_name in LABEL_FOLDERS.items():
        folder = root / folder_name
        if not folder.is_dir():
            raise FileNotFoundError(f"Folder kelas tidak ditemukan: {folder_name}/")
        for path in sorted(folder.rglob("*")):
            if not path.is_file() or path.suffix.lower() not in AUDIO_EXTENSIONS:
                continue
            record_id = path.relative_to(root).as_posix()
            row = {
                "record_id": record_id,
                "file_name": path.name,
                "label": label,
                "format": path.suffix.lower(),
                "duration_seconds": np.nan,
                "sample_rate": np.nan,
                "channels": np.nan,
                "file_size_bytes": path.stat().st_size,
                "source_group": source_group(path.name),
                "file_sha256": "",
                "valid": False,
                "clipped_fraction": np.nan,
                "silent": False,
                "error": "",
                "_path": path,
            }
            try:
                if row["file_size_bytes"] == 0:
                    raise ValueError("file kosong (0 byte)")
                info = sf.info(str(path))
                if info.frames <= 0 or info.samplerate <= 0 or info.channels <= 0:
                    raise ValueError("header audio tidak memiliki frame/sampling rate/kanal valid")
                row.update({
                    "duration_seconds": float(info.duration),
                    "sample_rate": int(info.samplerate),
                    "channels": int(info.channels),
                    "valid": True,
                    "file_sha256": sha256_file(path),
                })
            except Exception as exc:
                row["error"] = f"{type(exc).__name__}: {exc}"
            rows.append(row)
    columns = [
        "record_id", "file_name", "label", "format", "duration_seconds",
        "sample_rate", "channels", "file_size_bytes", "source_group",
        "file_sha256", "valid", "clipped_fraction", "silent", "error", "_path",
    ]
    return pd.DataFrame(rows, columns=columns)


def load_mono_16k(path: Path) -> tuple[np.ndarray, dict]:
    """Baca, sanitasi, konversi mono, lalu resample tanpa normalisasi gain."""
    samples, original_rate = sf.read(str(path), dtype="float32", always_2d=True)
    if samples.size == 0 or original_rate <= 0:
        raise ValueError(f"Audio kosong/tidak valid: {path.name}")
    samples = np.nan_to_num(samples, nan=0.0, posinf=0.0, neginf=0.0)
    # Ukur clipping proxy sebelum kanal dicampur agar clipping satu kanal tidak
    # tertutupi oleh rata-rata stereo.
    clipped_fraction = float(np.mean(np.abs(samples) >= 0.999))
    mono = samples.mean(axis=1, dtype=np.float32)
    if int(original_rate) != SAMPLE_RATE:
        divisor = math.gcd(int(original_rate), SAMPLE_RATE)
        mono = resample_poly(
            mono, SAMPLE_RATE // divisor, int(original_rate) // divisor
        ).astype(np.float32)
    mono = np.nan_to_num(mono, nan=0.0, posinf=0.0, neginf=0.0)
    if mono.size == 0 or not np.isfinite(mono).all():
        raise ValueError(f"Waveform hasil preprocessing tidak valid: {path.name}")
    return mono, {
        "original_sample_rate": int(original_rate),
        "original_channels": int(samples.shape[1]),
        "clipped_fraction": clipped_fraction,
        "silent": bool(np.sqrt(np.mean(mono.astype(np.float64) ** 2)) < 1e-5),
    }


def audio_windows(waveform: np.ndarray) -> list[np.ndarray]:
    """Window 30 dtk dengan hop 15 dtk; pad audio pendek, sertakan tail panjang."""
    size = int(round(WINDOW_SECONDS * SAMPLE_RATE))
    hop = int(round(WINDOW_HOP_SECONDS * SAMPLE_RATE))
    if len(waveform) <= size:
        return [np.pad(waveform, (0, size - len(waveform)))]
    starts = list(range(0, len(waveform) - size + 1, hop))
    if len(waveform) - (starts[-1] + size) >= int(0.25 * size):
        starts.append(len(waveform) - size)
    return [waveform[start:start + size] for start in sorted(set(starts))]


def rms_features(waveform: np.ndarray) -> dict[str, float]:
    """Lima RMS: RMS seluruh rekaman dan empat ringkasan RMS frame 1 dtk."""
    frame_size = int(round(RMS_FRAME_SECONDS * SAMPLE_RATE))
    hop = int(round(RMS_HOP_SECONDS * SAMPLE_RATE))
    padded = waveform
    if len(padded) < frame_size:
        padded = np.pad(padded, (0, frame_size - len(padded)))
    starts = np.arange(0, len(padded) - frame_size + 1, hop, dtype=int)
    frame_values = np.stack([padded[start:start + frame_size] for start in starts])
    frame_rms = np.sqrt(np.mean(frame_values.astype(np.float64) ** 2, axis=1))
    return {
        "rms_overall": float(np.sqrt(np.mean(waveform.astype(np.float64) ** 2))),
        "rms_frame_mean": float(frame_rms.mean()),
        "rms_frame_std": float(frame_rms.std()),
        "rms_frame_min": float(frame_rms.min()),
        "rms_frame_max": float(frame_rms.max()),
    }


@lru_cache(maxsize=4)
def make_mel_filterbank(sample_rate=SAMPLE_RATE, n_fft=FFT_SIZE,
                        n_mels=N_MELS, fmin=50.0, fmax=SAMPLE_RATE / 2):
    """Filterbank segitiga mel untuk spektrum daya."""
    def hz_to_mel(hz):
        return 2595.0 * np.log10(1.0 + hz / 700.0)

    def mel_to_hz(mel):
        return 700.0 * (10.0 ** (mel / 2595.0) - 1.0)

    edges = mel_to_hz(np.linspace(hz_to_mel(fmin), hz_to_mel(fmax), n_mels + 2))
    frequencies = np.fft.rfftfreq(n_fft, d=1.0 / sample_rate)
    bank = np.zeros((n_mels, len(frequencies)), dtype=np.float64)
    for index in range(n_mels):
        left, center, right = edges[index:index + 3]
        bank[index] = np.maximum(0.0, np.minimum(
            (frequencies - left) / max(center - left, 1e-12),
            (right - frequencies) / max(right - center, 1e-12),
        ))
    return bank, frequencies


def summarize_five(values: np.ndarray, prefix: str) -> dict[str, float]:
    values = np.asarray(values, dtype=np.float64)
    return {
        f"{prefix}_mean": float(np.mean(values)),
        f"{prefix}_std": float(np.std(values)),
        f"{prefix}_median": float(np.median(values)),
        f"{prefix}_p10": float(np.percentile(values, 10)),
        f"{prefix}_p90": float(np.percentile(values, 90)),
    }


def acoustic_features(path: Path) -> tuple[dict[str, float], dict]:
    """Hasilkan tepat 28 fitur numerik dengan satu resep per rekaman."""
    waveform, quality = load_mono_16k(path)
    result = rms_features(waveform)
    centroid_frames, zcr_frames, mfcc_frames = [], [], []
    mel_bank, frequencies = make_mel_filterbank()
    taper = np.hanning(FFT_SIZE).astype(np.float32)
    for window in audio_windows(waveform):
        frames = np.lib.stride_tricks.sliding_window_view(window, FFT_SIZE)[::FFT_HOP_SIZE]
        spectrum = np.fft.rfft(frames * taper, axis=1)
        magnitude = np.abs(spectrum)
        power = (magnitude ** 2) / FFT_SIZE
        mel_power = power @ mel_bank.T
        log_mel = 10.0 * np.log10(np.maximum(mel_power, 1e-10))
        mfcc = dct(log_mel, type=2, axis=1, norm="ortho")[:, :N_MFCC]
        magnitude_sum = np.maximum(magnitude.sum(axis=1), 1e-12)
        centroid = (magnitude @ frequencies) / magnitude_sum
        zcr = (np.signbit(frames[:, 1:]) != np.signbit(frames[:, :-1])).mean(axis=1)
        centroid_frames.append(centroid)
        zcr_frames.append(zcr)
        mfcc_frames.append(mfcc)

    pooled_centroid = np.concatenate(centroid_frames)
    pooled_zcr = np.concatenate(zcr_frames)
    pooled_mfcc = np.concatenate(mfcc_frames, axis=0)
    result.update(summarize_five(pooled_centroid, "centroid"))
    result.update(summarize_five(pooled_zcr, "zcr"))
    result.update({
        f"mfcc_{index:02d}": float(pooled_mfcc[:, index].mean())
        for index in range(N_MFCC)
    })
    if list(result) != FEATURE_COLUMNS:
        raise RuntimeError(
            f"Urutan/ukuran fitur keliru: dapat {len(result)}, seharusnya 28."
        )
    if not np.isfinite(np.asarray(list(result.values()), dtype=np.float64)).all():
        raise ValueError(f"Fitur non-finite untuk {path.name}")
    return result, quality


def extract_feature_table(inventory: pd.DataFrame, progress=True):
    """Ekstraksi seluruh audio terbaca; gagal baca dicatat di inventaris."""
    updated = inventory.copy(deep=True)
    rows = []
    valid_indices = updated.index[updated["valid"].astype(bool)].tolist()
    total = len(valid_indices)
    for number, index in enumerate(valid_indices, start=1):
        row = updated.loc[index]
        try:
            features, quality = acoustic_features(Path(row["_path"]))
            updated.loc[index, "clipped_fraction"] = quality["clipped_fraction"]
            updated.loc[index, "silent"] = quality["silent"]
            record = {
                "record_id": row["record_id"], "file_name": row["file_name"],
                "label": row["label"], "source_group": row["source_group"],
                "file_sha256": row["file_sha256"], **features,
            }
            rows.append(record)
        except Exception as exc:
            updated.loc[index, "valid"] = False
            updated.loc[index, "error"] = f"{type(exc).__name__}: {exc}"
        if progress and (number % 10 == 0 or number == total):
            print(f"Ekstraksi fitur: {number}/{total}")
    feature_table = pd.DataFrame(rows)
    if not feature_table.empty:
        numeric = feature_table[FEATURE_COLUMNS].to_numpy(dtype=np.float64)
        if numeric.shape[1] != 28 or not np.isfinite(numeric).all():
            raise ValueError("Fitur harus berjumlah tepat 28 dan finite.")
    return updated, feature_table


def duplicate_audit(feature_table: pd.DataFrame):
    """Tandai hash duplikat/label konflik, lalu buat data modeling tanpa duplikasi."""
    hash_labels = feature_table.groupby("file_sha256")["label"].agg(
        lambda labels: sorted(set(labels))
    )
    conflict_hashes = set(hash_labels[hash_labels.map(len) > 1].index)
    grouped = feature_table.groupby("file_sha256", sort=True)

    # Union source IDs connected by identical audio so no copy crosses a split.
    source_ids = set(feature_table["source_group"].astype(str))
    parents = {source_id: source_id for source_id in source_ids}

    def find(item):
        while parents[item] != item:
            parents[item] = parents[parents[item]]
            item = parents[item]
        return item

    def union(left, right):
        root_left, root_right = find(left), find(right)
        if root_left != root_right:
            parents[root_right] = root_left

    for file_hash, group in grouped:
        sources = sorted(set(group["source_group"].astype(str)))
        for other in sources[1:]:
            union(sources[0], other)

    enriched = feature_table.copy()
    enriched["leakage_group"] = enriched["source_group"].astype(str).map(
        lambda value: find(value)
    )
    enriched["model_status"] = "eligible"
    enriched.loc[enriched["file_sha256"].isin(conflict_hashes), "model_status"] = (
        "excluded_conflicting_labels"
    )
    consistent = enriched.loc[~enriched["file_sha256"].isin(conflict_hashes)].copy()
    model_table = consistent.sort_values("record_id").drop_duplicates(
        "file_sha256", keep="first"
    ).reset_index(drop=True)
    return enriched, model_table, conflict_hashes


def grouped_train_validation_test_split(
    file_table: pd.DataFrame,
    train_size=0.70,
    validation_size=0.15,
    test_size=0.15,
    seed_trials=500,
):
    """Bagi setiap file valid ke train/validation/test tanpa memecah grup.

    Beberapa pengacakan StratifiedGroupKFold tujuh fold dicoba. Pasangan fold
    validation/test yang ukurannya dan jumlah per kelasnya paling dekat dengan
    target dipilih; akurasi/model tidak digunakan untuk memilih split. Pemanggil
    dapat lalu menyaring representatif audio unik untuk pemodelan, namun manifest
    split tetap memuat semua file sumber.
    """
    if file_table["label"].nunique() != 2:
        raise ValueError("Diperlukan contoh dari kedua kelas untuk split.")
    if not np.isclose(train_size + validation_size + test_size, 1.0):
        raise ValueError("Proporsi train, validation, dan test harus berjumlah 1.")
    y = file_table["label"].to_numpy()
    groups = file_table["leakage_group"].astype(str).to_numpy()
    if len(np.unique(groups)) < 7:
        raise ValueError("Split 70/15/15 berbasis grup memerlukan sedikitnya 7 grup.")
    if seed_trials < 1:
        raise ValueError("seed_trials harus minimal 1.")
    class_labels = list(CLASSES)
    total_by_class = {label: int(np.sum(y == label)) for label in class_labels}
    target_sizes = {
        "train": train_size,
        "validation": validation_size,
        "test": test_size,
    }
    all_indices = np.arange(len(file_table))
    best_candidate = None
    public_candidates = []
    for seed in range(SEED, SEED + seed_trials):
        splitter = StratifiedGroupKFold(
            n_splits=7, shuffle=True, random_state=seed
        )
        folds = [
            heldout_idx
            for _, heldout_idx in splitter.split(np.zeros(len(file_table)), y, groups)
        ]
        for validation_fold, validation_idx in enumerate(folds, start=1):
            for test_fold, test_idx in enumerate(folds, start=1):
                if validation_fold == test_fold:
                    continue
                train_idx = np.setdiff1d(
                    all_indices, np.concatenate([validation_idx, test_idx]),
                    assume_unique=False,
                )
                indices = {
                    "train": train_idx,
                    "validation": validation_idx,
                    "test": test_idx,
                }
                if any(
                    len(np.unique(y[idx])) < 2 for idx in indices.values()
                ):
                    continue
                actual_counts = {
                    name: {label: int(np.sum(y[idx] == label))
                           for label in class_labels}
                    for name, idx in indices.items()
                }
                actual_sizes = {
                    name: len(idx) / len(file_table)
                    for name, idx in indices.items()
                }
                # Nilai split hanya dinilai dari ukuran dan kelas, bukan fitur
                # atau performa model, agar test tidak dipilih berdasarkan skor.
                score = sum(
                    abs(actual_counts[name][label] - target_sizes[name] * total_by_class[label])
                    for name in indices
                    for label in class_labels
                ) / len(file_table)
                candidate = {
                    "score": float(score),
                    "seed": int(seed),
                    "validation_fold": int(validation_fold),
                    "test_fold": int(test_fold),
                    "train_idx": train_idx,
                    "validation_idx": validation_idx,
                    "test_idx": test_idx,
                    "actual_sizes": actual_sizes,
                    "actual_counts": actual_counts,
                }
                public_candidates.append({
                    key: value for key, value in candidate.items()
                    if key not in {"train_idx", "validation_idx", "test_idx"}
                })
                if best_candidate is None or (
                    candidate["score"], candidate["seed"],
                    candidate["validation_fold"], candidate["test_fold"]
                ) < (
                    best_candidate["score"], best_candidate["seed"],
                    best_candidate["validation_fold"], best_candidate["test_fold"]
                ):
                    best_candidate = candidate
    if best_candidate is None:
        raise ValueError("Tidak ditemukan split 70/15/15 yang memuat kedua kelas.")
    selected = best_candidate
    train_idx = selected["train_idx"]
    validation_idx = selected["validation_idx"]
    test_idx = selected["test_idx"]
    train = file_table.iloc[train_idx].copy().reset_index(drop=True)
    validation = file_table.iloc[validation_idx].copy().reset_index(drop=True)
    test = file_table.iloc[test_idx].copy().reset_index(drop=True)
    partitions = {"train": train, "validation": validation, "test": test}
    names = list(partitions)
    for i, left_name in enumerate(names):
        for right_name in names[i + 1:]:
            left, right = partitions[left_name], partitions[right_name]
            if set(left.leakage_group) & set(right.leakage_group):
                raise RuntimeError(
                    f"Kebocoran grup antara {left_name} dan {right_name}."
                )
            if set(left.file_sha256) & set(right.file_sha256):
                raise RuntimeError(
                    f"Kebocoran duplikat antara {left_name} dan {right_name}."
                )
    return train, validation, test, selected, sorted(
        public_candidates, key=lambda item: item["score"]
    )[:20]


def make_svm_pipeline():
    return Pipeline([
        ("scaler", StandardScaler()),
        ("svc", SVC(kernel="rbf", class_weight=None, random_state=SEED)),
    ])


def tune_svm(train: pd.DataFrame):
    """CV grouped 5-fold hanya pada training; scaler ada di dalam pipeline."""
    n_groups = train["leakage_group"].nunique()
    if n_groups < 5:
        raise ValueError(f"Cross-validation butuh >=5 grup train; tersedia {n_groups}.")
    cv = StratifiedGroupKFold(n_splits=5, shuffle=True, random_state=SEED)
    grid = {
        "svc__C": [0.1, 1, 10, 100],
        "svc__gamma": ["scale", 0.01, 0.1, 1],
    }
    search = GridSearchCV(
        estimator=make_svm_pipeline(), param_grid=grid,
        scoring="f1_macro", cv=cv, n_jobs=1, refit=True,
        return_train_score=False,
    )
    search.fit(
        train[FEATURE_COLUMNS].to_numpy(dtype=np.float32),
        train["label"].to_numpy(),
        groups=train["leakage_group"].astype(str).to_numpy(),
    )
    cv_results = pd.DataFrame(search.cv_results_).sort_values(
        ["rank_test_score", "mean_test_score"]
    )
    return search, cv_results


def evaluate_svm(model, data: pd.DataFrame, split_name="test"):
    """Hitung metrik pada subset bernama dan kembalikan prediksi per rekaman."""
    X_test = data[FEATURE_COLUMNS].to_numpy(dtype=np.float32)
    y_test = data["label"].to_numpy()
    started = time.perf_counter()
    prediction = model.predict(X_test)
    inference_seconds = time.perf_counter() - started
    report = classification_report(
        y_test, prediction, labels=CLASSES, target_names=CLASSES,
        zero_division=0, output_dict=True,
    )
    precision, recall, f1, _ = precision_recall_fscore_support(
        y_test, prediction, labels=CLASSES, average=None, zero_division=0
    )
    metrics = {
        "accuracy": float(accuracy_score(y_test, prediction)),
        "precision_macro": float(np.mean(precision)),
        "recall_macro": float(np.mean(recall)),
        "f1_macro": float(f1_score(y_test, prediction, labels=CLASSES,
                                   average="macro", zero_division=0)),
        "precision_berisik": float(precision[1]),
        "recall_berisik": float(recall[1]),
        "f1_berisik": float(f1[1]),
        "confusion_matrix": confusion_matrix(y_test, prediction, labels=CLASSES).tolist(),
        "classification_report": report,
        "record_count": int(len(data)),
        "group_count": int(data["leakage_group"].nunique()),
        "evaluated_split": str(split_name),
        "inference_seconds": float(inference_seconds),
        "inference_ms_per_record": float(inference_seconds * 1000 / max(len(data), 1)),
    }
    predictions = data[["record_id", "file_name", "label", "source_group",
                        "leakage_group"]].copy()
    predictions["prediction"] = prediction
    predictions["correct"] = predictions["label"] == predictions["prediction"]
    return metrics, predictions


def infer_audio_file(path: Path, model) -> dict:
    """Inferensi satu file dengan resep fitur yang sama persis dengan training."""
    features, quality = acoustic_features(Path(path))
    vector = pd.DataFrame([[features[column] for column in FEATURE_COLUMNS]],
                          columns=FEATURE_COLUMNS).to_numpy(dtype=np.float32)
    prediction = str(model.predict(vector)[0])
    return {
        "record_id": Path(path).name,
        "prediction": prediction,
        "rms_overall": features["rms_overall"],
        "quality": quality,
        "feature_count": len(features),
    }


def package_versions():
    versions = {}
    for name in ["numpy", "pandas", "scipy", "soundfile", "scikit-learn", "joblib"]:
        try:
            versions[name] = package_metadata.version(name)
        except package_metadata.PackageNotFoundError:
            versions[name] = None
    return versions


def inventory_csv_view(inventory: pd.DataFrame) -> pd.DataFrame:
    """Kolom yang aman disimpan; path internal dihilangkan."""
    columns = [
        "record_id", "file_name", "label", "format", "duration_seconds",
        "sample_rate", "channels", "file_size_bytes", "source_group",
        "file_sha256", "valid", "clipped_fraction", "silent", "error",
    ]
    return inventory[columns].copy()


def save_model_and_metadata(model, validation_metrics, test_metrics, split_info,
                            conflict_hashes, selected_folds, cv_best_score, cv_best_params,
                            model_path: Path, metadata_path: Path):
    """Simpan pipeline final serta resep yang cukup untuk pemakaian ulang."""
    model_path.parent.mkdir(parents=True, exist_ok=True)
    bundle = {
        "pipeline": model,
        "feature_columns": list(FEATURE_COLUMNS),
        "classes": list(CLASSES),
        "sample_rate": SAMPLE_RATE,
        "window_seconds": WINDOW_SECONDS,
        "window_hop_seconds": WINDOW_HOP_SECONDS,
        "rms_frame_seconds": RMS_FRAME_SECONDS,
        "rms_hop_seconds": RMS_HOP_SECONDS,
        "fft_size": FFT_SIZE,
        "fft_hop_size": FFT_HOP_SIZE,
        "n_mels": N_MELS,
        "n_mfcc": N_MFCC,
        "feature_version": FEATURE_VERSION,
    }
    joblib.dump(bundle, model_path, compress=3)
    metadata = {
        "model": "SVC RBF in StandardScaler pipeline",
        "selection": "GridSearchCV grouped 5-fold on training data only",
        "best_cv_f1_macro": float(cv_best_score),
        "best_params": cv_best_params,
        "random_seed": SEED,
        "split_strategy": "70/15/15; StratifiedGroupKFold 7-fold candidate pairs, grouped by source and exact duplicate audio",
        "target_split_proportions": {"train": 0.70, "validation": 0.15, "test": 0.15},
        "selected_folds": {
            "validation": int(selected_folds["validation_fold"]),
            "test": int(selected_folds["test_fold"]),
            "random_state": int(selected_folds["seed"]),
        },
        "split_candidate_seed_trials": 500,
        "train_records_unique_audio": int(split_info["train_count"]),
        "validation_records_unique_audio": int(split_info["validation_count"]),
        "test_records_unique_audio": int(split_info["test_count"]),
        "raw_file_counts_by_split": {
            "train": int(split_info["train_raw_file_count"]),
            "validation": int(split_info["validation_raw_file_count"]),
            "test": int(split_info["test_raw_file_count"]),
        },
        "raw_class_counts_by_split": split_info["raw_class_counts"],
        "train_groups": int(split_info["train_groups"]),
        "validation_groups": int(split_info["validation_groups"]),
        "test_groups": int(split_info["test_groups"]),
        "exact_conflicting_hashes_excluded": sorted(conflict_hashes),
        "features": list(FEATURE_COLUMNS),
        "feature_count": len(FEATURE_COLUMNS),
        "feature_recipe": {
            "RMS": "rms_overall plus mean/std/min/max of 1 s RMS frames at 0.5 s hop",
            "spectral_centroid": "mean/std/median/p10/p90 across 1024-sample frames",
            "ZCR": "mean/std/median/p10/p90 across 1024-sample frames",
            "MFCC": "mean of C0-C12; 64 mel bands, log10 power, DCT-II orthonormal",
        },
        "preprocessing": {
            "mono": "mean across channels",
            "target_sample_rate": SAMPLE_RATE,
            "per_file_amplitude_normalization": False,
            "window_seconds": WINDOW_SECONDS,
            "window_hop_seconds": WINDOW_HOP_SECONDS,
            "short_audio": "zero-pad to 30 s",
            "long_audio": "30 s windows at 15 s hop; tail aligned to end if >=7.5 s remains",
        },
        "validation_metrics": validation_metrics,
        "test_metrics": test_metrics,
        "versions": package_versions(),
    }
    metadata_path.write_text(
        json.dumps(metadata, ensure_ascii=False, indent=2, default=str),
        encoding="utf-8",
    )
    return bundle, metadata

