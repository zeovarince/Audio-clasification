# Spesifikasi Model SilentGuard Lab

Dokumen ini menjelaskan kontrak inferensi backend yang aktif.

## 1. Artefak model

| Item | Nilai |
|---|---|
| Versi aktif | Model 3.0 |
| Artefak training | `model3.0/MODEL_KLASIFIKASIV3-0.joblib` |
| Artefak yang dimuat backend | `backend/models/MODEL_KLASIFIKASIV3-0.joblib` (salinan identik) |
| Fitur input | 107 kolom sesuai urutan `bundle["features"]` |
| Pipeline | `VotingClassifier` (SVM k=70 bobot 0.50 + LightGBM k=60 bobot 0.30 + ExtraTrees k=65 bobot 0.20) |
| Threshold keputusan | 0,50 (`bundle["threshold"]` default 0.50) |
| Sample rate | 22050 Hz |
| Runtime scikit-learn | 1.6.1 + LightGBM >= 4.0.0 |

Backend mencari `MODEL_KLASIFIKASIV3-0.joblib` (atau `modelaudiov3.joblib`) di `MODEL_DIR`. Secara default, backend lokal memakai `backend/models/`; Docker menyalin salinan backend itu ke `/app/models/`. Artefak training resmi tetap berada di `model3.0/`.

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

`backend/features.py` menghasilkan tepat 107 nilai yang digunakan Model 3.0 (100 spektral/MFCC dasar + 7 rasio dinamis volume-invariant). Backend menyusun vektor dalam urutan `bundle["features"]`, bukan urutan kamus.

Rumus ekstraksi harus tetap cocok dengan training Model 3.0. Nama fitur yang sama dengan rumus berbeda dapat mengubah probabilitas.

## 4. Output API

`POST /predict` mengembalikan:

```json
{
  "noise_probability": 0.73,
  "label": "berisik",
  "processing_ms": 42
}
```

`noise_probability` adalah probabilitas kelas berisik pada rentang 0-1, bukan ukuran desibel langsung. Label backend memakai threshold Model 5.0 sebesar 0,50. Alarm dashboard tetap memakai ambang terpisah: 60% untuk alarm pertama dan 75% untuk alarm kedua.

`GET /health` melaporkan versi model, jumlah fitur, threshold, sample rate, dan versi scikit-learn. Deploy dianggap sehat hanya jika Model 5.0 berhasil dimuat dan warm-up inferensinya berhasil.

## 5. Akurasi dan batas penggunaan

Model 5.0 memperoleh akurasi holdout **97,56% (40 dari 41 file)** pada split evaluasi yang tersimpan di notebook Model 5.0. Angka ini khusus untuk data holdout tersebut; performa mikrofon langsung dapat berbeda karena ruang, perangkat, posisi mikrofon, dan gain.

## 6. Pemeriksaan paritas

`backend/tests/golden.json` menyimpan contoh probabilitas dan label Model 5.0. Jalankan pemeriksaan dari root repository dengan:

```bash
python -m pytest backend/tests/test_parity.py
```
