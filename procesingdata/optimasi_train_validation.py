"""Ekstraksi fitur semua split dan optimasi model hanya pada train/validation.

Fitur test lama diekspor sebagai data deskriptif, tetapi tidak dipakai untuk
fit, cross-validation, pemilihan model, atau evaluasi test independen baru.
Letakkan test independen baru pada ../test_baru/{berisik,non-berisik}/.
"""

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
CACHE = ARTIFACTS / "cache"
MODEL_PATH = ARTIFACTS / "model_optimasi_train_validation.joblib"
METADATA_PATH = ARTIFACTS / "metadata_optimasi_train_validation.json"
COMPARISON_PATH = ARTIFACTS / "perbandingan_optimasi_train_validation.csv"
FEATURES_PATH = ARTIFACTS / "dataset_fitur_audio.csv"
NEW_TEST_PATH = ROOT / "test_baru"
SR = 16000
WINDOW_SECONDS = 30.0
WINDOW_HOP_SECONDS = 15.0
FFT_SIZE = 1024
FFT_HOP_SIZE = 512
N_MFCC = 13
FEATURE_VERSION = "rms-centroid-zcr-mfcc13-mean-v2"
SEED = 42
CLASSES = ["non berisik", "berisik"]
RMS_COLUMNS = ["rms_overall"]
MFCC_COLUMNS = [f"mfcc_{index:02d}" for index in range(N_MFCC)]
ACOUSTIC_COLUMNS = ["rms_overall", "centroid_mean", "zcr_mean", *MFCC_COLUMNS]
EXTENSIONS = {".wav", ".mp3", ".flac", ".ogg", ".m4a", ".aac", ".wma"}


def source_group(filename):
    match = re.match(r"^(\d+-\d+)", Path(filename).name)
    return match.group(1) if match else "file:" + Path(filename).name


def package_version(name):
    try:
        return package_metadata.version(name)
    except package_metadata.PackageNotFoundError:
        return None


def load_mono_16k(path):
    samples, sample_rate = sf.read(str(path), dtype="float32", always_2d=True)
    if samples.size == 0 or sample_rate <= 0:
        raise ValueError(f"Audio kosong/tidak valid: {path}")
    samples = np.nan_to_num(samples, nan=0.0, posinf=0.0, neginf=0.0)
    mono = samples.mean(axis=1, dtype=np.float32)
    if int(sample_rate) != SR:
        divisor = math.gcd(int(sample_rate), SR)
        mono = resample_poly(mono, SR // divisor,
                             int(sample_rate) // divisor).astype(np.float32)
    if not np.isfinite(mono).all() or not mono.size:
        raise ValueError(f"Waveform hasil preprocessing tidak valid: {path}")
    return mono


def windows(waveform):
    size = int(round(WINDOW_SECONDS * SR))
    hop = int(round(WINDOW_HOP_SECONDS * SR))
    if len(waveform) <= size:
        return [np.pad(waveform, (0, size - len(waveform)))]
    starts = list(range(0, len(waveform) - size + 1, hop))
    if len(waveform) - (starts[-1] + size) >= int(.25 * size):
        starts.append(len(waveform) - size)
    return [waveform[s:s + size] for s in sorted(set(starts))]


def rms_features(waveform):
    """Satu nilai RMS keseluruhan per rekaman; tidak mengubah gain audio."""
    clean = np.nan_to_num(np.asarray(waveform, dtype=np.float64), nan=0.0,
                          posinf=0.0, neginf=0.0)
    if clean.size == 0:
        raise ValueError("Waveform kosong: RMS tidak dapat dihitung.")
    return {"rms_overall": float(np.sqrt(np.mean(clean ** 2)))}


def make_mel_filterbank(sample_rate=SR, n_fft=1024, n_mels=64,
                        fmin=50.0, fmax=SR / 2):
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
            (right - frequencies) / max(right - center, 1e-12)))
    return bank, frequencies


def acoustic_features(path):
    """Ekstrak 16 fitur per rekaman: RMS, centroid, ZCR, dan MFCC C0-C12.

    Centroid, ZCR, dan setiap koefisien MFCC diringkas dengan satu nilai mean
    atas seluruh frame dari seluruh window rekaman.
    """
    waveform = load_mono_16k(path)
    result = rms_features(waveform)
    mfcc_frames = []
    centroid_frames, zcr_frames = [], []
    n_fft, hop = FFT_SIZE, FFT_HOP_SIZE
    mel_bank, frequencies = make_mel_filterbank(n_fft=n_fft)
    taper = np.hanning(n_fft).astype(np.float32)
    for window in windows(waveform):
        frames = np.lib.stride_tricks.sliding_window_view(window, n_fft)[::hop]
        spectrum = np.fft.rfft(frames * taper, axis=1)
        power = (np.abs(spectrum) ** 2) / n_fft
        mel_power = power @ mel_bank.T
        log_mel = 10.0 * np.log10(np.maximum(mel_power, 1e-10))
        # Tiga belas koefisien, termasuk koefisien 0 (C0).
        mfcc = dct(log_mel, type=2, axis=1, norm="ortho")[:, :N_MFCC].T
        mfcc_frames.append(mfcc)
        magnitude = np.abs(spectrum)
        magnitude_sum = np.maximum(magnitude.sum(axis=1), 1e-12)
        centroid = (magnitude @ frequencies) / magnitude_sum
        zero_crossing = (np.signbit(frames[:, 1:]) != np.signbit(frames[:, :-1])).mean(axis=1)
        centroid_frames.append(centroid)
        zcr_frames.append(zero_crossing)
    pooled_mfcc = np.concatenate(mfcc_frames, axis=1)
    result["centroid_mean"] = float(np.concatenate(centroid_frames).mean())
    result["zcr_mean"] = float(np.concatenate(zcr_frames).mean())
    result.update({column: float(pooled_mfcc[index].mean())
                   for index, column in enumerate(MFCC_COLUMNS)})
    if list(result) != ACOUSTIC_COLUMNS:
        raise RuntimeError("Urutan kolom fitur akustik tidak sesuai konfigurasi.")
    return result


def metrics(y_true, y_pred):
    precision, recall, f1, _ = precision_recall_fscore_support(
        y_true, y_pred, labels=["berisik"], average=None, zero_division=0)
    return {
        "accuracy": float(accuracy_score(y_true, y_pred)),
        "precision_berisik": float(precision[0]),
        "recall_berisik": float(recall[0]),
        "f1_berisik": float(f1[0]),
        "f1_macro": float(f1_score(y_true, y_pred, labels=CLASSES,
                                   average="macro", zero_division=0)),
        "confusion_matrix": confusion_matrix(y_true, y_pred, labels=CLASSES).tolist(),
    }


def tune_svm(X, y, groups):
    folds = min(4, pd.Series(groups).nunique())
    if folds < 2:
        raise ValueError("Grup train tidak cukup untuk cross-validation.")
    cv = StratifiedGroupKFold(n_splits=folds, shuffle=True, random_state=SEED)
    pipe = Pipeline([
        ("scaler", StandardScaler()),
        ("svc", SVC(kernel="rbf", probability=False, random_state=SEED)),
    ])
    grid = {"svc__C": [.1, 1, 10, 100],
            "svc__gamma": ["scale", .01, .1, 1]}
    search = GridSearchCV(pipe, grid, scoring="f1_macro", cv=cv,
                          n_jobs=1, refit=True, return_train_score=False)
    search.fit(X, y, groups=groups)
    return search


def evaluate_new_test(bundle, existing_groups):
    """Test baru dibaca setelah pemilihan model selesai; tidak melakukan tuning."""
    class_dirs = {"berisik": NEW_TEST_PATH / "berisik",
                  "non berisik": NEW_TEST_PATH / "non-berisik"}
    if not all(folder.is_dir() for folder in class_dirs.values()):
        relative_test_path = NEW_TEST_PATH.relative_to(ROOT).as_posix()
        print(f"Test independen baru belum ada. Siapkan: {relative_test_path}/berisik dan "
              f"{relative_test_path}/non-berisik")
        return None
    rows = []
    for label, folder in class_dirs.items():
        for path in sorted(folder.rglob("*")):
            if path.is_file() and path.suffix.lower() in EXTENSIONS:
                rows.append({"path": path, "record_id": path.relative_to(NEW_TEST_PATH).as_posix(),
                             "label": label, "source_group": source_group(path.name)})
    test = pd.DataFrame(rows)
    if test.empty or set(test.label) != set(CLASSES):
        raise ValueError("Test baru harus memuat audio valid di kedua folder kelas.")
    manifest = NEW_TEST_PATH / "metadata.csv"
    context_columns = ["device", "session", "room_context"]
    if manifest.exists():
        meta = pd.read_csv(manifest)
        if {"record_id", "source_group"}.issubset(meta.columns):
            meta["record_id"] = meta["record_id"].astype(str).str.replace("\\", "/", regex=False)
            selected_metadata = ["record_id", "source_group"] + [
                column for column in context_columns if column in meta.columns]
            meta = meta[selected_metadata].rename(
                columns={"source_group": "manifest_source_group"})
            test = test.merge(meta, on="record_id", how="left", validate="one_to_one")
            manifest_groups = test["manifest_source_group"].astype("string").str.strip()
            manifest_groups = manifest_groups.mask(manifest_groups.eq(""))
            test["source_group"] = manifest_groups.fillna(test["source_group"])
        else:
            warnings.warn("metadata.csv perlu kolom record_id dan source_group untuk memakai ID grup manifest.")
    overlap = set(test.source_group.astype(str)) & set(existing_groups)
    if overlap:
        raise ValueError(f"Grup test tumpang tindih dengan data pengembangan: {sorted(overlap)}")
    class_counts = test.label.value_counts().reindex(CLASSES, fill_value=0)
    groups_per_class = test.groupby("label").source_group.nunique().reindex(
        CLASSES, fill_value=0)
    print(f"Test baru: {len(test)} file, {test.source_group.nunique()} grup sumber; "
          f"kelas={class_counts.to_dict()}, grup per kelas={groups_per_class.to_dict()}")
    if (len(test) < 100 or class_counts.min() < 50
            or test.source_group.nunique() < 10 or groups_per_class.min() < 5):
        warnings.warn("Keragaman test masih terbatas. Sasaran awal: >=100 file, "
                      ">=50 file per kelas, >=10 grup sumber, dan >=5 grup per kelas.")
    if not manifest.exists():
        warnings.warn("metadata.csv belum ada; keragaman perangkat/sesi/kondisi tidak dapat diverifikasi.")
    else:
        if "record_id" not in pd.read_csv(manifest, nrows=0).columns:
            warnings.warn("metadata.csv perlu kolom record_id untuk mencocokkan file.")
        else:
            available_context = [column for column in context_columns if column in test.columns]
            if not available_context:
                warnings.warn("metadata.csv belum memuat device/session/room_context; "
                              "variasi kondisi perekaman tidak dapat dinilai.")
            for column in context_columns:
                if column in test.columns:
                    unique_count = int(test[column].nunique(dropna=True))
                    print(f"{column}: {unique_count} nilai unik")
                    if unique_count < 2:
                        warnings.warn(f"Keragaman {column} belum dapat diuji: ditemukan {unique_count} nilai.")
    feature_rows, labels, paths = [], [], []
    feature_start = time.perf_counter()
    for number, row in enumerate(test.itertuples(), start=1):
        values = acoustic_features(row.path)
        feature_rows.append([values[c] for c in bundle["feature_columns"]])
        labels.append(row.label)
        paths.append(row.record_id)
        if number % 10 == 0 or number == len(test):
            print(f"Test baru diproses {number}/{len(test)}")
    feature_seconds = time.perf_counter() - feature_start
    start = time.perf_counter()
    prediction = bundle["pipeline"].predict(np.asarray(feature_rows, dtype=np.float32))
    elapsed = time.perf_counter() - start
    result = metrics(labels, prediction)
    result["classification_report"] = classification_report(
        labels, prediction, labels=CLASSES, target_names=CLASSES,
        zero_division=0, output_dict=True)
    result["file_count"] = len(test)
    result["group_count"] = int(test.source_group.nunique())
    result["class_counts"] = {str(key): int(value) for key, value in class_counts.items()}
    result["groups_per_class"] = {str(key): int(value) for key, value in groups_per_class.items()}
    result["feature_extraction_seconds"] = feature_seconds
    result["prediction_seconds"] = elapsed
    result["end_to_end_seconds"] = feature_seconds + elapsed
    result["per_file_end_to_end_ms"] = (feature_seconds + elapsed) * 1000 / len(test)
    prediction_frame = test.copy()
    prediction_frame["predicted"] = prediction
    context_summaries = []
    for group_column in ["source_group"] + context_columns:
        if group_column not in prediction_frame.columns:
            continue
        available = prediction_frame.dropna(subset=[group_column])
        if available.empty:
            continue
        for group_value, subset in available.groupby(group_column, dropna=True):
            subset_metrics = metrics(subset.label, subset.predicted)
            context_summaries.append({
                "grouping": group_column, "value": str(group_value),
                "file_count": len(subset), "accuracy": subset_metrics["accuracy"],
                "precision_berisik": subset_metrics["precision_berisik"],
                "recall_berisik": subset_metrics["recall_berisik"],
                "f1_berisik": subset_metrics["f1_berisik"],
                "f1_macro": subset_metrics["f1_macro"],
                "confusion_matrix": json.dumps(subset_metrics["confusion_matrix"]),
            })
    if context_summaries:
        pd.DataFrame(context_summaries).to_csv(
            ARTIFACTS / "hasil_test_baru_per_grup.csv", index=False)
    result["per_file_predictions"] = [
        {"record_id": row.record_id, "actual": str(row.label),
         "predicted": str(row.predicted), "source_group": str(row.source_group)}
        for row in prediction_frame.itertuples()]
    (ARTIFACTS / "hasil_test_baru.json").write_text(
        json.dumps(result, indent=2, ensure_ascii=False), encoding="utf-8")
    print("Hasil test baru:", {k: result[k] for k in
          ["accuracy", "precision_berisik", "recall_berisik", "f1_berisik", "f1_macro"]})
    print(classification_report(labels, prediction, labels=CLASSES,
                                target_names=CLASSES, zero_division=0))
    print("Confusion matrix (aktual x prediksi):", result["confusion_matrix"])
    print(f"Waktu ekstraksi fitur: {feature_seconds:.3f} dtk; prediksi model: "
          f"{elapsed:.6f} dtk; total: {feature_seconds + elapsed:.3f} dtk "
          f"({result['per_file_end_to_end_ms']:.1f} ms/file)")
    if context_summaries:
        print("Analisis per grup/konteks tersimpan: hasil_test_baru_per_grup.csv")
    return result


def main():
    ARTIFACTS.mkdir(parents=True, exist_ok=True)
    CACHE.mkdir(parents=True, exist_ok=True)
    inventory = pd.read_csv(ARTIFACTS / "inventaris_audio.csv")
    splits = pd.read_csv(ARTIFACTS / "pembagian_data.csv")
    all_existing_groups = set(splits.source_group.astype(str).unique())
    inventory = inventory.drop(columns=["source_group"], errors="ignore")
    dataset = splits.merge(
        inventory, on=["record_id", "label"], how="inner", validate="one_to_one")
    # Bangun lokasi dari ID relatif agar CSV dan skrip tidak bergantung pada
    # lokasi absolut komputer tertentu.
    dataset["path"] = dataset["record_id"].map(
        lambda record_id: ROOT / Path(str(record_id)))
    if "valid" in dataset:
        if dataset["valid"].dtype == object:
            valid_mask = dataset["valid"].astype(str).str.strip().str.lower().isin(
                {"true", "1", "yes"})
        else:
            valid_mask = dataset["valid"].fillna(False).astype(bool)
    else:
        valid_mask = pd.Series(True, index=dataset.index)
    feature_records = dataset.loc[valid_mask].copy()
    excluded_invalid = len(dataset) - len(feature_records)
    if excluded_invalid:
        print(f"File tidak valid dikecualikan dari CSV fitur: {excluded_invalid}")
    missing_paths = feature_records.loc[
        ~feature_records["path"].map(Path.is_file), "record_id"].tolist()
    if missing_paths:
        raise FileNotFoundError(
            "Audio tidak ditemukan dari path relatif proyek: "
            + ", ".join(missing_paths[:5]))
    if not set(feature_records.split.astype(str).unique()).issuperset(
            {"train", "validation"}):
        raise ValueError("Split train/validation tidak ditemukan.")
    development = feature_records.loc[
        feature_records.split.isin(["train", "validation"])].copy()
    train = development.loc[development.split == "train"].copy()
    validation = development.loc[development.split == "validation"].copy()
    if train.empty or validation.empty:
        raise ValueError("Data train atau validation kosong setelah validasi audio.")
    development_groups = set(development.source_group.astype(str).unique())
    split_counts = feature_records.split.value_counts().to_dict()
    print(f"Ekstraksi CSV mencakup semua split valid: {len(feature_records)} file "
          f"({split_counts}); model hanya memakai {len(train)} train dan "
          f"{len(validation)} validation. Test tidak ikut fit atau tuning.")

    signature_data = {
        "version": FEATURE_VERSION,
        "records": [(r.record_id, str(r.split), int(Path(r.path).stat().st_size),
                     int(Path(r.path).stat().st_mtime_ns))
                    for r in feature_records.itertuples()],
    }
    signature = hashlib.sha256(json.dumps(signature_data, sort_keys=True).encode()).hexdigest()
    cache_path = CACHE / "acoustic_features_all_splits.joblib"
    feature_df = None
    if cache_path.exists():
        try:
            cache = joblib.load(cache_path)
            if cache.get("signature") == signature:
                feature_df = cache["features"]
                print("Cache fitur semua split digunakan.")
        except Exception as exc:
            print("Cache fitur tidak terbaca; ekstraksi ulang:", exc)
    if feature_df is None:
        rows = []
        for number, row in enumerate(feature_records.itertuples(), start=1):
            values = acoustic_features(row.path)
            values["record_id"] = row.record_id
            rows.append(values)
            if number % 10 == 0 or number == len(feature_records):
                print(f"Ekstraksi fitur semua split {number}/{len(feature_records)}")
        feature_df = pd.DataFrame(rows).set_index("record_id")
        if not np.isfinite(feature_df.to_numpy(dtype=float)).all():
            raise ValueError("Fitur mengandung nilai non-finite.")
        joblib.dump({"signature": signature, "features": feature_df}, cache_path, compress=3)

    # CSV satu baris per rekaman: identitas, label, split, lalu fitur akustik.
    feature_columns = list(feature_df.columns)
    feature_export = feature_records[["record_id", "file_name", "label", "split"]].merge(
        feature_df.reset_index(), on="record_id", how="inner", validate="one_to_one")
    feature_export = feature_export[
        ["record_id", "file_name", "label", "split", *feature_columns]
    ]
    if len(feature_export) != len(feature_records):
        raise ValueError("Jumlah baris CSV fitur tidak cocok dengan audio valid.")
    if not np.isfinite(feature_export[feature_columns].to_numpy(dtype=float)).all():
        raise ValueError("CSV fitur berisi nilai non-finite.")
    temporary_features_path = FEATURES_PATH.with_name("dataset_fitur_audio.tmp.csv")
    feature_export.to_csv(temporary_features_path, index=False, float_format="%.10g")
    feature_table_path = FEATURES_PATH
    try:
        temporary_features_path.replace(FEATURES_PATH)
    except PermissionError:
        # Editor/spreadsheet atau sinkronisasi cloud dapat mengunci CSV lama.
        # Simpan hasil baru di file saudara agar ekstraksi dan training tetap selesai.
        feature_table_path = ARTIFACTS / "dataset_fitur_audio_baru.csv"
        temporary_features_path.replace(feature_table_path)
        warnings.warn(
            f"{FEATURES_PATH.name} sedang terkunci; fitur baru disimpan ke "
            f"{feature_table_path.name}. Tutup file lama lalu jalankan ulang skrip "
            "untuk memperbarui nama CSV utama."
        )
    print("Dataset fitur tersimpan:", feature_table_path.relative_to(ROOT).as_posix(),
          "| baris:", len(feature_export), "| jumlah fitur:", len(feature_columns),
          "| MFCC:", N_MFCC, "koefisien (C0-C12).")

    feature_df_development = feature_df.loc[development.record_id.tolist()]
    rich_columns = [c for c in feature_df.columns if c not in RMS_COLUMNS]
    print("Fitur RMS:", len(RMS_COLUMNS), "| fitur tambahan:", len(rich_columns))

    results, searches, frames = {}, {}, {
        "RMS + SVM": feature_df_development[RMS_COLUMNS],
        "RMS + centroid + ZCR + MFCC 13 + SVM":
            feature_df_development[RMS_COLUMNS + rich_columns],
    }
    for name, frame in frames.items():
        train_ids = train.record_id.tolist()
        val_ids = validation.record_id.tolist()
        y_train = train.set_index("record_id").loc[train_ids, "label"].to_numpy()
        g_train = train.set_index("record_id").loc[train_ids, "source_group"].to_numpy()
        y_val = validation.set_index("record_id").loc[val_ids, "label"].to_numpy()
        search = tune_svm(frame.loc[train_ids].to_numpy(dtype=np.float32), y_train, g_train)
        pred = search.best_estimator_.predict(frame.loc[val_ids].to_numpy(dtype=np.float32))
        result = metrics(y_val, pred)
        results[name], searches[name] = result, search
        print(f"\n{name}: params={search.best_params_}; CV train F1 macro="
              f"{search.best_score_:.4f}; validation={result}")
        print(classification_report(y_val, pred, labels=CLASSES,
                                    target_names=CLASSES, zero_division=0))

    comparison = pd.DataFrame([{
        "experiment": name,
        "cv_train_f1_macro": float(searches[name].best_score_),
        **{f"validation_{key}": value for key, value in results[name].items()
           if key != "confusion_matrix"},
        "best_params": str(searches[name].best_params_),
        "validation_confusion_matrix": json.dumps(results[name]["confusion_matrix"]),
    } for name in frames])
    print("\nPerbandingan train-CV dan validation:")
    print(comparison.to_string(index=False))
    selected = max(frames, key=lambda name: (
        results[name]["f1_macro"], results[name]["recall_berisik"],
        searches[name].best_score_, results[name]["accuracy"]))
    print("\nDipilih hanya dari train-CV dan validation:", selected)

    selected_frame = frames[selected]
    final_search = searches[selected]
    all_dev_ids = development.record_id.tolist()
    final_y = development.set_index("record_id").loc[all_dev_ids, "label"].to_numpy()
    final_pipeline = Pipeline([
        ("scaler", StandardScaler()),
        ("svc", SVC(kernel="rbf", probability=True, random_state=SEED,
                    C=final_search.best_params_["svc__C"],
                    gamma=final_search.best_params_["svc__gamma"])),
    ])
    final_pipeline.fit(selected_frame.loc[all_dev_ids].to_numpy(dtype=np.float32), final_y)
    feature_type = "rms" if selected == "RMS + SVM" else "rms_centroid_zcr_mfcc13"
    bundle = {
        "pipeline": final_pipeline,
        "selected_experiment": selected,
        "feature_type": feature_type,
        "feature_columns": list(selected_frame.columns),
        "class_order": CLASSES,
        "positive_label": "berisik",
        "sample_rate": SR,
        "window_seconds": WINDOW_SECONDS,
        "window_hop_seconds": WINDOW_HOP_SECONDS,
        "feature_frame_seconds": FFT_SIZE / SR,
        "feature_hop_seconds": FFT_HOP_SIZE / SR,
        "feature_recipe": "RMS keseluruhan + mean spectral centroid + mean ZCR + "
                          "mean MFCC C0-C12; satu nilai per fitur per rekaman",
    }
    joblib.dump(bundle, MODEL_PATH, compress=3)
    comparison.to_csv(COMPARISON_PATH, index=False)
    meta = {
        "selection_source": "grouped CV on train and validation only; test rows are exported as fixed features but excluded from fitting, tuning, and model selection",
        "selected_experiment": selected,
        "best_params": final_search.best_params_,
        "cv_train_f1_macro": float(final_search.best_score_),
        "validation_metrics": results[selected],
        "train_count": len(train), "validation_count": len(validation),
        "train_group_count": int(train.source_group.nunique()),
        "validation_group_count": int(validation.source_group.nunique()),
        "development_groups": sorted(map(str, development_groups)),
        "feature_columns": bundle["feature_columns"],
        "feature_table_path": feature_table_path.relative_to(ROOT).as_posix(),
        "feature_table_rows": len(feature_export),
        "feature_table_feature_count": len(feature_columns),
        "feature_table_splits": sorted(feature_export["split"].unique().tolist()),
        "mfcc_coefficients": N_MFCC,
        "mfcc_includes_c0": True,
        "feature_frame_seconds": FFT_SIZE / SR,
        "feature_hop_seconds": FFT_HOP_SIZE / SR,
        "feature_aggregation": "centroid, ZCR, dan MFCC dirata-ratakan atas seluruh frame",
        "feature_type": feature_type,
        "test_evaluated": False,
        "test_folder_expected": "../test_baru/",
        "feature_implementation": "NumPy FFT + SciPy DCT; mel filterbank 64 bands; mono 16 kHz",
        "versions": {
            package: package_version(package)
            for package in ["numpy", "pandas", "scipy", "soundfile",
                            "scikit-learn", "joblib"]
        },
    }
    METADATA_PATH.write_text(json.dumps(meta, ensure_ascii=False, indent=2, default=str),
                             encoding="utf-8")
    print("\nModel kandidat tersimpan:", MODEL_PATH.relative_to(ROOT).as_posix())
    print("Metadata:", METADATA_PATH.relative_to(ROOT).as_posix())
    print("Perbandingan:", COMPARISON_PATH.relative_to(ROOT).as_posix())
    print("CSV fitur:", feature_table_path.relative_to(ROOT).as_posix())
    print("Catatan: metrik test belum dihitung; evaluasi hanya berjalan bila test_baru berisi grup baru.")
    evaluate_new_test(bundle, all_existing_groups)


if __name__ == "__main__":
    main()
