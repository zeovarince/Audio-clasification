# MODEL_SPEC: Spesifikasi Model Klasifikasi Audio

Dokumen ini memastikan backend memproses audio dengan cara yang sama persis seperti saat training. Bagian bertanda **[ISI]** harus dilengkapi dari notebook atau kode training. Jangan menebak: satu parameter yang berbeda (sample rate, jumlah MFCC, urutan fitur) bisa menurunkan akurasi jauh di bawah 92%.

## 1. File model

| File | Lokasi | Isi | Cara memuat |
|---|---|---|---|
| `model.joblib` | `backend/models/` | **[ISI]** jenis model (misalnya RandomForest, SVM, dan sebagainya) | `joblib.load` |
| `*.pkl` | `backend/models/` | **[ISI]** isi file ini (scaler, label encoder, daftar fitur, atau model lain) | **[ISI]** `pickle.load` atau `joblib.load` |

Peringatan keamanan: file `.joblib` dan `.pkl` bisa mengeksekusi kode saat dimuat. Hanya muat file yang kamu buat sendiri.

## 2. Lingkungan training (wajib dicatat)

| Item | Nilai |
|---|---|
| Versi Python | **[ISI]** |
| Versi scikit-learn | **[ISI]** (jalankan `python -c "import sklearn; print(sklearn.__version__)"` di lingkungan training) |
| Versi numpy | **[ISI]** |
| Versi librosa (jika dipakai) | **[ISI]** |
| Versi joblib | **[ISI]** |

Semua versi ini dikunci di `backend/requirements.txt`.

## 3. Parameter audio

| Parameter | Nilai |
|---|---|
| Sample rate | **[ISI]** Hz |
| Jumlah channel | **[ISI]** (umumnya mono) |
| Durasi satu potongan (window) | **[ISI]** detik |
| Hop antar potongan saat training | **[ISI]** detik |
| Normalisasi amplitudo | **[ISI]** (ada atau tidak, dan caranya) |
| Padding atau pemotongan jika audio lebih pendek | **[ISI]** |

Nilai sample rate dan window dipakai langsung oleh frontend saat merekam dan mengirim audio.

## 4. Ekstraksi fitur

**[ISI]** Tempel fungsi ekstraksi fitur dari notebook training apa adanya, lalu salin ke `backend/features.py`.

| Item | Nilai |
|---|---|
| Jenis fitur | **[ISI]** (MFCC, mel-spectrogram, ZCR, RMS, dan sebagainya) |
| Parameter fitur | **[ISI]** (n_mfcc, n_fft, hop_length, n_mels, dan sebagainya) |
| Agregasi | **[ISI]** (mean, std, atau lainnya) |
| Panjang vektor fitur | **[ISI]** |
| Urutan fitur | **[ISI]** |
| Scaler | **[ISI]** (StandardScaler dan sebagainya, dan file mana yang menyimpannya) |

## 5. Output model

| Item | Nilai |
|---|---|
| Kelas | **[ISI]** (misalnya 0 = non-berisik, 1 = berisik) |
| Metode prediksi | `predict_proba` jika tersedia |
| Indeks kelas "berisik" | cari lewat `model.classes_`, jangan di-hardcode |
| Nilai yang dikirim ke frontend | probabilitas kelas "berisik", 0.0 sampai 1.0 |

Jika model tidak punya `predict_proba` (misalnya SVC tanpa `probability=True`), catat di sini dan tentukan penggantinya (misalnya `decision_function` yang dinormalisasi). Ini mempengaruhi arti "persentase keramaian".

## 6. Performa model

| Metrik | Nilai |
|---|---|
| Akurasi | sekitar 92% |
| Precision (berisik) | **[ISI]** |
| Recall (berisik) | **[ISI]** |
| F1 (berisik) | **[ISI]** |
| Data uji | **[ISI]** jumlah sampel dan sumbernya |
| Data latih | **[ISI]** jumlah sampel, sumber, dan kondisi rekaman |

Catatan: recall kelas berisik paling penting untuk sistem ini. Model yang sering melewatkan keramaian akan membuat alarm terlambat.

## 7. Keterbatasan yang diketahui

**[ISI]** Contoh yang perlu dicek: apakah data latih direkam di lab yang sama, apakah suara kipas atau AC terklasifikasi sebagai berisik, apakah bisik-bisik banyak orang terdeteksi.

## 8. Kerangka kode inferensi

```python
# backend/inference.py
import joblib
import numpy as np

from features import extract_features  # salinan dari notebook training

MODEL_PATH = "models/model.joblib"
# EXTRA_PATH = "models/<nama>.pkl"  # [ISI] scaler atau encoder jika ada

model = joblib.load(MODEL_PATH)
# extra = joblib.load(EXTRA_PATH)

NOISY_INDEX = None  # [ISI] atau cari dari model.classes_


def predict_noise_probability(samples: np.ndarray, sample_rate: int) -> float:
    """samples: float32 mono dalam rentang -1.0 sampai 1.0."""
    features = extract_features(samples, sample_rate)  # [ISI] samakan dengan training
    features = np.asarray(features).reshape(1, -1)
    # features = extra.transform(features)  # jika ada scaler
    proba = model.predict_proba(features)[0]
    return float(proba[NOISY_INDEX])
```

## 9. Uji paritas (wajib sebelum integrasi UI)

Tujuan: membuktikan backend menghasilkan angka yang sama dengan notebook training.

1. Pilih 5 sampai 10 file audio: campuran tenang, obrolan biasa, dan ramai.
2. Di notebook training, hitung probabilitas berisik tiap file dan simpan ke `backend/tests/golden.json`.
3. Di backend, hitung probabilitas file yang sama lewat `predict_noise_probability`.
4. Selisih tiap file harus kurang dari 0.01. Jika lebih besar, ada perbedaan di pipeline fitur.
5. Jadikan ini test otomatis: `pytest backend/tests/test_parity.py`.
