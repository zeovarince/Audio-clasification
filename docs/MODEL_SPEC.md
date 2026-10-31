# Spesifikasi Model SilentGuard Lab

Dokumen ini menjelaskan kontrak inferensi yang digunakan backend dan frontend.

## 1. Artefak model yang dijalankan

| Item | Nilai |
|---|---|
| Versi | Model 4.0 |
| File default | `backend/models/model_klasifikasi_berisik.joblib` |
| Fitur | 112, sesuai urutan `bundle["features"]` |
| Pipeline | `StandardScaler` → `SelectKBest(f_classif, k=80)` → `SVC(RBF, C=12.0, gamma=0.025, probability=True)` |
| Sample rate bundle | 22050 Hz |
| Runtime scikit-learn | 1.6.1 |

`backend/inference.py` memilih artefak di `backend/models/` secara default dan menolak bundle yang tidak memiliki 112 fitur. Set `MODEL_DIR` hanya jika ingin memilih direktori model secara eksplisit.

File joblib/pickle dapat menjalankan kode saat dimuat. Gunakan hanya artefak dari repository tepercaya.

## 2. Kontrak audio

| Parameter | Nilai |
|---|---|
| Kanal | Mono |
| Sample rate | 22050 Hz |
| Durasi window frontend | 5 detik (110250 sampel) |
| Jeda kirim frontend | 1 detik |
| Bentuk input API | PCM Int16 little-endian |
| Konversi backend | `int16.astype(float32) / 32768.0` |

Frontend meminta `AudioContext` pada 22050 Hz, merata-ratakan kanal ke mono, dan mengirim `X-Sample-Rate: 22050`. Backend menolak sample rate yang tidak cocok dengan sample rate model.

## 3. Fitur inferensi

`backend/features.py` mengikuti fungsi ekstraksi di `model4.0/klasifikasi-audioV4.ipynb`:

- 100 fitur dasar RMS-dB, statistik spektral, MFCC, mel noise-floor, dan spectral contrast.
- 7 fitur rekayasa Model 3.0: `dyn_ratio`, `snr_dyn_ratio`, `hf_energy_ratio`, `cent_bw_ratio`, `roll_cent_ratio`, `flat_cent_prod`, `snr_ratio_p95_p5`.
- 5 fitur transien Model 4.0: `peak_to_p50`, `crest_factor`, `std_sum`, `vocal_ratio`, `hf_spectral`.

Backend menyusun matriks dengan urutan fitur yang tersimpan di bundle, bukan urutan kamus lokal.

## 4. Output API

`POST /predict` mengembalikan:

```json
{
  "noise_probability": 0.73,
  "label": "berisik",
  "processing_ms": 42
}
```

`noise_probability` adalah probabilitas kelas berisik pada rentang 0–1. Frontend mengubahnya menjadi persentase sebelum smoothing dan membandingkannya dengan ambang 60% dan 80%.

`GET /health` melaporkan `model_loaded`, `model_version`, `feature_count`, `sample_rate`, dan `sklearn_version`. Deploy dianggap sehat hanya jika Model 4.0 berhasil dimuat dan warm-up inferensinya berhasil.

## 5. Akurasi dan batas penggunaan

Model 4.0 mencapai akurasi holdout **97.56% (40 dari 41 file)** pada evaluasi yang tercatat di `model4.0/README.md`. Angka ini mengukur holdout dataset tersebut; akurasi pada mikrofon langsung dapat berbeda karena karakteristik ruang, perangkat, posisi mikrofon, dan gain.

## 6. Pemeriksaan paritas

`backend/tests/golden.json` berasal dari sebelum artefak backend diperbarui ke Model 4.0; nilainya belum membuktikan paritas Model 4.0. Regenerasi reference tersebut dengan Model 4.0 dan scikit-learn 1.6.1 sebelum menganggap uji golden lulus. Jalankan pemeriksaan dari root repository dengan:

```bash
python -m pytest backend/tests/test_parity.py
```
