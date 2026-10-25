# MODEL_SPEC: Spesifikasi Model Klasifikasi Audio

Dokumen ini memastikan backend memproses audio dengan cara yang sama persis seperti saat training.

## 1. File model

| File | Lokasi | Isi | Cara memuat |
|---|---|---|---|
| `model_klasifikasi_berisik.joblib` | `model2.0/` (diakses via env `MODEL_DIR`) | Dictionary berisi bundle: model `Pipeline` (StandardScaler, SelectKBest k=60, SVC RBF C=3 gamma=0.05 probability=True), list 100 nama fitur, sample rate 22050 | `joblib.load` |
| `model_klasifikasi_berisik.pkl` | `model2.0/` | Bundle identik dalam format pickle | `joblib.load` |

Peringatan keamanan: file `.joblib` dan `.pkl` bisa mengeksekusi kode saat dimuat. Hanya muat file yang dibuat sendiri dari repositori ini.

## 2. Lingkungan training (terekam dari serialisasi model)

| Item | Nilai |
|---|---|
| Versi Python | 3.10 / 3.11 |
| Versi scikit-learn | 1.6.1 |
| Versi numpy | 2.2.x |
| Versi librosa | 0.11.x |
| Versi joblib | 1.5.x |

Versi ini dikunci di `backend/requirements.txt` agar tidak terjadi penyimpangan hasil transformasi fitur atau inferensi SVM.

## 3. Parameter audio

| Parameter | Nilai |
|---|---|
| Sample rate | 22050 Hz |
| Jumlah channel | 1 (mono) |
| Durasi satu potongan (window) | 5.0 detik (110.250 sampel pada 22050 Hz) |
| Hop antar potongan saat streaming | 1.0 detik (22.050 sampel) |
| Normalisasi amplitudo | float32 dalam rentang -1.0 sampai 1.0 (dikonversi dari Int16 PCM: `samples.astype(np.float32) / 32768.0`) |
| Padding atau pemotongan jika audio lebih pendek | Pad nol di akhir jika kurang dari 5 detik |

Nilai sample rate (22050 Hz) dan window (5.0 detik) dipakai langsung oleh frontend saat merekam dan mengirim audio ke backend.

## 4. Ekstraksi fitur

Fungsi ekstraksi fitur disalin langsung dari Cell 14 `model2.0/klasifikasi_berisik_audio.ipynb` ke `backend/features.py`.

| Item | Nilai |
|---|---|
| Jenis fitur | Energi RMS dB, statistik noise floor pada 20% frame tersunyi (flatness, centroid, ZCR, bandwidth, rolloff), 20 koefisien MFCC (mean, std, quiet), 8-band noise floor mel, dan spectral contrast |
| Parameter fitur | STFT n_fft=2048, hop_length=512, n_mels=40, n_mfcc=20 |
| Agregasi | mean, std, dan nilai pada frame tersunyi (quiet = 20% frame terendah RMS dB) |
| Panjang vektor fitur | 100 fitur numerik float64 |
| Urutan fitur | Sesuai kunci kamus `bundle['features']`: `rmsdb_p5`, `rmsdb_p10`, ..., `noise_band8`, `contrast1`..`contrast7` |
| Scaler dan Feature Selector | Terintegrasi langsung dalam objek `Pipeline` di dalam file model (`StandardScaler` -> `SelectKBest(k=60)` -> `SVC`) |

## 5. Output model

| Item | Nilai |
|---|---|
| Kelas | `[0, 1]` (0 = non-berisik, 1 = berisik) |
| Metode prediksi | `predict_proba` (tersedia karena SVC dikonfigurasi dengan `probability=True`) |
| Indeks kelas "berisik" | Cari dinamis lewat `np.where(model.classes_ == 1)[0][0]` |
| Nilai yang dikirim ke frontend | Probabilitas kelas "berisik" (float antara 0.0 sampai 1.0) |

## 6. Performa model

| Metrik | Nilai |
|---|---|
| Akurasi Holdout Test (20%, n=41) | 92.68% (0.927) |
| Precision (berisik) | 1.000 (100%) |
| Recall (berisik) | 0.857 (85.7%) |
| F1-Score (berisik) | 0.923 |
| Data uji | 41 sampel (20 non-berisik, 21 berisik) dari 201 total sampel |
| Data latih | 160 sampel (80 non-berisik, 80 berisik) dari total 201 file audio lab |

Catatan: Model memiliki presisi 1.000 pada kelas berisik dan recall 1.000 pada kelas non-berisik, yang berarti suara tenang tidak pernah salah dituduh berisik.

## 7. Keterbatasan yang diketahui

- Model dilatih pada dataset audio lab bersampel 201 file. Suara derau kipas atau pendingin ruangan yang statis tergolong noise floor dan dikenali dengan baik, namun suara ketukan mendadak yang sangat singkat mungkin memerlukan rata-rata bergerak (smoothing window) agar tidak memicu alarm palsu.
- Rekaman audio harus dikonversi ke sample rate 22050 Hz mono agar ekstraksi fitur menghasilkan koefisien spektral yang presisi.

## 8. Kerangka kode inferensi

```python
# backend/inference.py
import os
from pathlib import Path
import joblib
import numpy as np

from features import extract_features

MODEL_DIR = Path(os.environ.get("MODEL_DIR", "../model2.0")).resolve()
MODEL_PATH = MODEL_DIR / "model_klasifikasi_berisik.joblib"
if not MODEL_PATH.exists():
    MODEL_PATH = MODEL_DIR / "model_klasifikasi_berisik.pkl"

bundle = joblib.load(MODEL_PATH)
model = bundle["model"]
feature_columns = bundle["features"]
SAMPLE_RATE = int(bundle.get("sr", 22050))

# Cari indeks kelas berisik (label 1)
NOISY_INDEX = int(np.where(model.classes_ == 1)[0][0])


def predict_noise_probability(samples: np.ndarray, sample_rate: int) -> float:
    """samples: float32 mono dalam rentang -1.0 sampai 1.0."""
    features_dict = extract_features(samples, sample_rate)
    vector = np.array([[features_dict[col] for col in feature_columns]], dtype=np.float64)
    proba = model.predict_proba(vector)[0]
    return float(proba[NOISY_INDEX])
```

## 9. Uji paritas

1. Referensi nilai golden tersimpan di `backend/tests/golden.json`.
2. Test otomatis dijalankan lewat `pytest backend/tests/test_parity.py`.
3. Toleransi selisih probabilitas maksimal 0.01.
