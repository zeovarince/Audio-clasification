# Spesifikasi Model SilentGuard Lab

Dokumen ini menjelaskan kontrak inferensi backend yang aktif.

## 1. Artefak model

| Item | Nilai |
|---|---|
| Versi aktif | Model 5.0 |
| Artefak training | `model5.0/modelaudiov5.joblib` |
| Artefak yang dimuat backend | `backend/models/modelaudiov5.joblib` (salinan identik) |
| Fitur input | 110 kolom sesuai urutan `bundle["features"]` |
| Pipeline | `StandardScaler` -> `SelectKBest(f_classif, k=80)` -> `SVC(RBF, C=3, gamma=0.025, probability=True)` |
| Threshold keputusan | 0,50 (`bundle["threshold"]`) |
| Sample rate | 22050 Hz |
| Runtime scikit-learn | 1.6.1 |

Backend mencari hanya `modelaudiov5.joblib` di `MODEL_DIR`. Secara default, backend lokal memakai `backend/models/`; Docker menyalin salinan backend itu ke `/app/models/`. Artefak training resmi tetap berada di `model5.0/`. Kedua file JOBLIB harus identik; backend tidak memuat artefak `.pkl`.

File joblib/pickle dapat menjalankan kode saat dimuat. Gunakan hanya artefak dari repository tepercaya.

## 2. Kontrak audio

| Parameter | Nilai |
|---|---|
| Kanal | Mono |
| Sample rate | 22050 Hz |
| Durasi window frontend | 5 detik (110250 sampel) |
| Jeda kirim frontend | 1 detik |
| Bentuk input API | PCM Float32 little-endian; Int16 tetap diterima untuk klien lama |
| Pemrosesan backend | Float32 dipertahankan lalu dibatasi ke rentang `[-1, 1]` |

Frontend mengirim Float32 mono dengan `X-Audio-Format: float32le` dan `X-Sample-Rate: 22050`. Backend menolak sample rate yang tidak cocok dengan model.

## 3. Fitur inferensi

`backend/features.py` menghasilkan tepat 110 nilai yang digunakan Model 5.0. Backend menyusun vektor dalam urutan `bundle["features"]`, bukan urutan kamus.

Rumus ekstraksi harus tetap cocok dengan training Model 5.0. Nama fitur yang sama dengan rumus berbeda dapat mengubah probabilitas.

## 4. Output API

`POST /predict` mengembalikan:

```json
{
  "noise_probability": 0.73,
  "label": "berisik",
  "processing_ms": 42
}
```

`noise_probability` adalah probabilitas kelas berisik pada rentang 0-1, bukan ukuran desibel langsung. Label backend memakai threshold Model 5.0 sebesar 0,50. Alarm dashboard tetap memakai ambang terpisah: 60% untuk alarm pertama dan 80% untuk alarm kedua.

`GET /health` melaporkan versi model, jumlah fitur, threshold, sample rate, dan versi scikit-learn. Deploy dianggap sehat hanya jika Model 5.0 berhasil dimuat dan warm-up inferensinya berhasil.

## 5. Akurasi dan batas penggunaan

Model 5.0 memperoleh akurasi holdout **97,56% (40 dari 41 file)** pada split evaluasi yang tersimpan di notebook Model 5.0. Angka ini khusus untuk data holdout tersebut; performa mikrofon langsung dapat berbeda karena ruang, perangkat, posisi mikrofon, dan gain.

## 6. Pemeriksaan paritas

`backend/tests/golden.json` menyimpan contoh probabilitas dan label Model 5.0. Jalankan pemeriksaan dari root repository dengan:

```bash
python -m pytest backend/tests/test_parity.py
```
