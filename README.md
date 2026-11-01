# SilentGuard Lab – Pemantau Kebisingan Laboratorium Real-time

> **Universitas Trunojoyo Madura &bull; Proyek Sains Data A**  
> **Tim Pengembang:**
> - A. Choiril Anwar EL-Asfihani Risydan
> - M. Hendrik Purwanto
> - Rifqi Fairurrafi

---

## 1. Ikhtisar Sistem

**SilentGuard Lab** adalah sistem pemantauan kebisingan laboratorium cerdas berbasis web. Sistem mendengarkan audio secara terus-menerus melalui browser, mengekstrak fitur audio (MFCC, Spectral, RMS, ZCR, dll.), dan mengklasifikasikan keramaian memakai model machine learning terkalibrasi.

> **Model aktif di aplikasi:** Model 3.0. Tabel berikut membandingkan arsitektur, fitur, ambang probabilitas, dan hasil evaluasi yang tercatat untuk tiap generasi.

| Versi / status | Arsitektur dan konfigurasi utama | Fitur masukan -> fitur dipakai | Ambang label berisik | Holdout yang tercatat | Cross-validation yang tercatat |
|---|---|---:|---:|---:|---:|
| Model 2.0 (arsip) | SVM RBF; `StandardScaler` -> `SelectKBest` -> `SVC(C=3, gamma=0.05)` | 100 -> 60 (40 fitur; 40% direduksi) | Tidak ada cutoff probabilitas eksplisit; memakai `SVC.predict()` | 92.68% (38/41)* | 91.60% +/- 0.68 pp* (5 seed x 5-fold) |
| **Model 3.0 (aktif)** | **Soft voting: SVM (50%) + LightGBM (30%) + ExtraTrees (20%)** | **107 -> SVM 70 (37 dibuang) / LightGBM 60 (47) / ExtraTrees 65 (42)** | **0.50** | **97.50% (39/40)** | **95.00% +/- 1.58 pp** (5-fold) |
| Model 4.0 (arsip) | SVM RBF; `StandardScaler` -> `SelectKBest` -> `SVC(C=12, gamma=0.025)` | 112 -> 80 (32 fitur direduksi; 28.6%) | 0.35 | 97.56% (40/41) | 94.23% +/- 0.59 pp (5 seed x 5-fold) |
| Model 5.0 (arsip) | SVM RBF; `StandardScaler` -> `SelectKBest` -> `SVC(C=3, gamma=0.025)` | 110 -> 80 (30 fitur direduksi; 27.3%) | 0.60 | 97.56% (40/41) | 94.03% +/- 1.37 pp (5 seed x 5-fold) |

**Cara membaca tabel:** ambang probabilitas hanya mengubah cara probabilitas dikonversi menjadi label; ambang itu bukan akurasi model. Model 3.0 melakukan seleksi fitur terpisah pada setiap anggota ensemble, jadi angka 70/60/65 bukan satu jumlah fitur gabungan.

**Catatan perbandingan:** ukuran holdout dan data berbeda antar generasi (Model 3.0: 40 file; Model 2.0/4.0/5.0: 41 file pada output yang dicatat). Metode CV Model 3.0 juga satu 5-fold, sementara model lain memakai lima seed x lima fold. Karena split dan prosedurnya tidak seragam, angka antarmodel bukan perbandingan head-to-head yang sepenuhnya setara.

**Catatan Model 2.0:** tanda `*` berarti output notebook tersimpan tidak konsisten. Laporan klasifikasi mencatat holdout 92.68% (38/41), tetapi output cell CV mencetak holdout 91.18%; output pembagian lain menunjukkan 34 file test. Jalankan ulang notebook Model 2.0 sebelum memakai angka tersebut untuk klaim perbandingan.

### Mengapa Model 3.0 dipilih?

Model 3.0 dipakai sebagai model aktif karena menggabungkan tiga algoritma yang menangkap pola audio dengan cara berbeda, lalu menggabungkan probabilitasnya melalui **soft voting**. Pada konfigurasi model yang tersimpan, bobotnya adalah SVM 50%, LightGBM 30%, dan ExtraTrees 20%.

- **SVM RBF** menjadi anggota dengan bobot terbesar. Kernel RBF dapat memisahkan pola yang hubungannya tidak linear; ini berguna ketika kombinasi fitur audio seperti MFCC, energi, dan fitur spektral tidak terpisah dengan batas lurus.
- **LightGBM** membangun pohon boosting secara berurutan: pohon berikutnya memperbaiki kesalahan yang belum ditangani pohon sebelumnya. Pada artefak Model 3.0, LightGBM menggunakan **80 boosting rounds**. Pendekatan ini membantu menangkap interaksi dan ambang antarfitur.
- **ExtraTrees** menggabungkan banyak pohon keputusan dengan pemilihan split yang dirandomisasi, sehingga memberi sudut pandang berbeda dari SVM dan boosting. Artefak Model 3.0 menggunakan **200 pohon keputusan** (`n_estimators=200`); voting dari banyak pohon membantu menstabilkan prediksi dan mengurangi ketergantungan pada satu pohon.

Model 3.0 dipilih berdasarkan hasil evaluasi yang tercatat: **97.50% pada holdout (39 dari 40 file)** dan **95.00% +/- 1.58 poin persentase pada 5-fold CV**. Hasil tersebut menunjukkan performa yang baik pada evaluasi itu, tetapi bukan jaminan akurasi yang sama untuk semua rekaman. Perbandingan dengan versi lain juga perlu mempertimbangkan perbedaan split dan prosedur evaluasi yang dijelaskan di atas.

Ketika kebisingan mencapai ambang batas:
- **Deteksi model (50%)**: Model 3.0 memberi label berisik mulai probabilitas 0.50. Dashboard menampilkan deteksi ini terpisah dari alarm.
- **Ambang 1 (60% default)**: Memutar peringatan pertama setelah konfirmasi.
- **Ambang 2 (75%)**: Memutar audio peringatan kedua dengan prioritas interupsi tinggi dan halo visual merah.

---

## 2. Arsitektur Sistem

```
 Mikrofon
    |
    v
+----------------------------- Browser (Next.js) --------------------------+
|  getUserMedia -> AudioContext                                            |
|        |                                                                 |
|        +--> AnalyserNode -----------> Waveform canvas (60 fps, lokal)    |
|        |                                                                 |
|        +--> AudioWorklet -> buffer PCM (mono, 22050 Hz)                  |
|                                |                                         |
|                                v  tiap 1.0s, kirim 5.0s audio           |
|                    POST /predict (Float32 PCM)                           |
|                                |                                         |
|   skor keramaian <-- rata-rata <-- noise_probability                     |
|        |                                                                 |
|        +--> Meter persentase                                             |
|        +--> Alarm machine -> putar alarm 60% / 80%                       |
+--------------------------------------------------------------------------+
                                 |
                                 v
+---------------------------- Backend (FastAPI) ----------------------------+
|  validasi input -> ekstraksi fitur -> scaler -> model.predict_proba      |
|  -> { noise_probability, label, processing_ms }                          |
+--------------------------------------------------------------------------+
```

---

## 3. Struktur Proyek

```text
Audio-clasification/
├── README.md                          # Dokumentasi utama (file ini)
├── .gitignore                         # Aturan pengecualian Git
├── start_backend.bat                  # Script cepat untuk menjalankan backend di Windows
│
├── berisik/                           # Dataset audio kelas berisik (~101 file .mp3)
├── non-berisik/                       # Dataset audio kelas non-berisik (~100 file .mp3)
├── alrm/                             # Audio alarm sumber
│   ├── alarm60%.mp3                   # Peringatan suara level 60%
│   └── alarm80%.mp3                   # Peringatan suara level 80%
│
├── frontend/                          # Aplikasi Frontend Next.js (App Router, Tailwind v4, GSAP)
│   ├── app/                           # Routing & halaman dashboard utama
│   │   ├── globals.css                # Sistem desain AuthKit (midnight canvas, frosted glass)
│   │   ├── layout.tsx                 # Tipografi Untitled Sans, aeonikPro, dotDigital
│   │   └── page.tsx                   # Dashboard pemantauan otomatis (always-on)
│   ├── components/                    # Komponen UI
│   │   ├── Waveform.tsx               # Visualisasi gelombang audio real-time
│   │   ├── NoiseMeter.tsx             # Meter persentase kebisingan
│   │   ├── StatusCard.tsx             # Kartu informasi status
│   │   ├── StatusPill.tsx             # Indikator status ringkas
│   │   ├── AlarmHistory.tsx           # Riwayat alarm yang dipicu
│   │   ├── StartButton.tsx            # Tombol mulai pemantauan
│   │   ├── SettingsDrawer.tsx         # Panel pengaturan
│   │   ├── SplashScreen.tsx           # Layar pembuka animasi
│   │   └── ShapeGrid.tsx/.css         # Dekorasi grid geometris
│   ├── lib/                           # Logika inti
│   │   ├── audio-capture.ts           # AudioWorklet, mikrofon, buffer PCM
│   │   ├── api.ts                     # Pemanggilan endpoint /predict
│   │   ├── alarm-machine.ts           # State machine logika alarm
│   │   ├── alarm-machine.test.ts      # Unit test alarm (8 skenario)
│   │   ├── alarm-player.ts            # Pemutar audio alarm
│   │   ├── config.ts                  # Konstanta (threshold, window, hop, URL)
│   │   └── smoothing.ts              # Rata-rata bergerak skor
│   └── public/                        # Asset statis (alarm audio, worklet)
│
├── backend/                           # Layanan Backend FastAPI
│   ├── main.py                        # Server FastAPI & CORS middleware
│   ├── inference.py                   # Pipeline inferensi ensemble (load model saat startup)
│   ├── features.py                    # Ekstraksi fitur Model 3.0 (107 fitur akustik & rasio dinamis)
│   ├── models/                         # Salinan aktif model3.0/MODEL_KLASIFIKASIV3-0.joblib
│   ├── requirements.txt               # Dependensi Python
│   ├── Dockerfile                     # Container production-ready
│   ├── vercel.json                    # Konfigurasi legacy; deploy aktif memakai Docker Compose
│   └── tests/                         # Pengujian paritas
│       ├── test_parity.py
│       └── golden.json
│
├── model/                             # Model 1.0 (eksperimen awal)
│   ├── 17_klasifikasi_berisik_audio.ipynb
│   ├── model_klasifikasi_berisik.pkl
│   ├── output_fitur_berisik.csv
│   └── output_fitur_segmen_berisik.csv
│
├── model2.0/                          # Model 2.0 Baseline (SVM RBF, 100 fitur, 92.68%)
│   ├── klasifikasi_berisik_audio.ipynb
│   ├── model_klasifikasi_berisik.joblib
│   ├── model_klasifikasi_berisik.pkl
│   ├── output_fitur_berisik.csv
│   └── output_fitur_segmen_berisik.csv
│
├── model3.0/                          # Model 3.0 Ensemble (holdout 97.50%, CV 95.00%)
│   ├── klasifikasi_berisik_audio.ipynb
│   ├── model_klasifikasi_berisik.joblib
│   ├── model_klasifikasi_berisik.pkl
│   ├── output_fitur_berisik.csv
│   ├── requirements.txt
│   └── README.md
│
    |-- model4.0/                     # Model 4.0 arsip (112 fitur, 97.56%)
    |   |-- klasifikasi-audioV4.ipynb
    |   |-- model_klasifikasiV4.joblib
    |   |-- model_klasifikasiV4.pkl
    |   |-- output_fitur_berisik.csv
    |   `-- README.md
    |
    |-- model5.0/                     # Model 5.0 arsip (110 fitur, threshold 0.60)
    |   |-- klasifikasi-audioV5.ipynb
    |   |-- modelaudiov5.joblib
    |   |-- modelaudiov5.pkl
    |   `-- output_fitur_berisik.csv
    |
├── procesingdata/                     # Eksperimen preprocessing (YAMNet, optimasi)
│   ├── klasifikasi.ipynb
│   ├── optimasi_train_validation.py
│   ├── requirements-yamnet.txt
│   └── artifacts/                     # Hasil evaluasi & artefak model
│
└── docs/                             # Dokumentasi teknis
    ├── ARCHITECTURE.md                # Arsitektur sistem (alur data, tech stack)
    ├── DESIGN.md                      # Desain UI/UX
    ├── DEPLOY.md                      # Panduan deployment
    ├── MODEL_SPEC.md                  # Spesifikasi model ML
    ├── ALARM_LOGIC.md                 # Logika state machine alarm
    ├── UI_SPEC.md                     # Spesifikasi antarmuka pengguna
    ├── PRD.md                         # Product Requirements Document
    └── TASKS.md                       # Daftar tugas pengembangan
```

---

## 4. Evolusi Model

### Model 2.0 — Baseline (Akurasi 92.68%)

- **Arsitektur:** `StandardScaler` → `SelectKBest(k=60)` → `SVC(RBF)`
- **Fitur:** 100 fitur audio (energi RMS-dB, MFCC, noise-floor, spektral, spectral contrast)
- **Confusion Matrix:** `[[20, 0], [3, 18]]` — 3 file berisik salah diklasifikasi sebagai non-berisik

### Model 3.0 - Ensemble Voting (aktif di dashboard)

Backend memuat `backend/models/MODEL_KLASIFIKASIV3-0.joblib`, salinan artefak dari folder Model 3.0. Docker menyalin artefak bernama sama ke `/app/models/`; health check memverifikasi nama berkas, versi, jumlah fitur, dan threshold.

- **Arsitektur:** soft-voting ensemble (SVM 50% + LightGBM 30% + ExtraTrees 20%)
- **Fitur:** 107 fitur audio
- **Seleksi fitur internal:** SVM (k=70), LightGBM (k=60), ExtraTrees (k=65)
- **Hasil notebook terbaru:** holdout 97.50% (39/40); Stratified 5-fold CV 95.00% +/- 1.58 poin persentase
- **Threshold keputusan:** 0.50

### Model 5.0 - Pure SVM RBF (arsip)

### Model 5.0 - Pure SVM RBF

- **Arsitektur:** `StandardScaler` → `SelectKBest(f_classif, k=80)` → `SVC(C=3, gamma=0.025, RBF)`
- **Fitur:** 110 fitur input, disusun sesuai bundle Model 5.0; SelectKBest memilih 80 fitur saat inferensi.
- **5 Fitur Baru Generasi 4:**
  1. `peak_to_p50` — Selisih energi dB antara persentil ke-95 dan median
  2. `crest_factor` — Rentang RMS-dB persentil ke-95 dan ke-5
  3. `std_sum` — Jumlah standar deviasi tiga MFCC pertama
  4. `vocal_ratio` — Rasio spectral contrast pita vokal
  5. `hf_spectral` — Selisih spectral contrast frekuensi tinggi dan rendah
- **Confusion Matrix:** `[[20, 0], [1, 20]]` — hanya 1 file salah dari 41 file uji
- **Precision (berisik):** 1.000 (0 false alarm pada ruangan tenang)
- **Recall (berisik):** 0.952 (hanya 1 file berisik yang terlewat)
- **Ukuran model:** ~91 KB (ultra-ringan, tanpa dependensi LightGBM)

---

## 5. Tech Stack

| Lapisan | Teknologi |
|---|---|
| **Frontend** | Next.js 16.4 (App Router), React 19, TypeScript, Tailwind CSS v4, GSAP |
| **Audio Browser** | Web Audio API: `getUserMedia`, `AnalyserNode`, `AudioWorklet` |
| **Backend** | FastAPI 0.115, Uvicorn 0.34, Python 3.10+ |
| **Machine Learning** | scikit-learn 1.6.1, librosa 0.10.2, numpy 2.2, joblib 1.4 |
| **Containerisasi** | Docker (multi-platform, non-root user) |
| **Deploy** | Docker Compose di server lab, port 8007 |

---

## 6. Cara Menjalankan Secara Lokal

### A. Menjalankan Backend (FastAPI)

Pastikan Python 3.10+ terinstal:
```bash
cd backend
pip install -r requirements.txt
python -m uvicorn main:app --reload --port 8000
```
Uji kesehatan backend:
```bash
curl http://localhost:8000/health
```

> **Catatan (Windows):** Bisa juga jalankan langsung dengan `start_backend.bat` dari root folder proyek.

### B. Menjalankan Frontend (Next.js)

Buka terminal baru:
```bash
cd frontend
npm install
npm run dev
```
Buka browser di **`http://localhost:3000`**.  
Pemantauan audio akan **otomatis aktif** seketika halaman selesai memuat splash screen.

### C. Konfigurasi Environment

**Frontend** (`frontend/.env.local`):
```env
NEXT_PUBLIC_API_URL=http://localhost:8000
```

**Backend** (variabel lingkungan):
```env
ALLOWED_ORIGINS=http://localhost:3000
MODEL_DIR=./backend/models
```
Artefak sumber Model 3.0 berada di `model3.0/MODEL_KLASIFIKASIV3-0.joblib`; salinan aktif backend berada di `backend/models/MODEL_KLASIFIKASIV3-0.joblib`. Keduanya harus tetap identik. Docker menyalin artefak backend tersebut ke `/app/models/`.

---

## 7. API Endpoint

### `POST /predict`

| Parameter | Keterangan |
|---|---|
| **Content-Type** | `application/octet-stream` |
| **X-Audio-Format** | `float32le` |
| **X-Sample-Rate** | `22050` |
| **Body** | Audio mono Float32 little-endian PCM (5.0 detik = 441.000 bytes) |

**Response 200:**
```json
{
  "noise_probability": 0.73,
  "label": "berisik",
  "processing_ms": 42
}
```

### `GET /health`

```json
{
  "status": "ok",
  "model_loaded": true,
  "model_version": "3.0",
  "model_artifact": "MODEL_KLASIFIKASIV3-0.joblib",
  "feature_count": 107,
  "selected_feature_count": 70,
  "selected_features_by_estimator": {"svm": 70, "lgb": 60, "et": 65},
  "decision_threshold": 0.5,
  "sklearn_version": "1.6.1"
}
```

---

## 8. Deploy dengan Docker ke Server Lab

Docker Compose menjalankan dashboard Next.js dan API FastAPI sebagai dua container. Buka `http://localhost:8007` setelah menjalankan:

```bash
docker compose up --build
```

Untuk deploy ke server lab, ikuti [DEPLOY_DOCKER.md](DEPLOY_DOCKER.md). Deploy dilakukan manual dari server setelah perubahan di-push ke GitHub. Untuk akses mikrofon dari komputer lain, server perlu HTTPS.

---

## 9. Dataset

| Kelas | Jumlah File | Deskripsi |
|---|---|---|
| **berisik** | ~101 file .mp3 | Rekaman suara laboratorium saat ramai/gaduh |
| **non-berisik** | ~100 file .mp3 | Rekaman suara laboratorium saat sunyi/tenang |
| **Total** | **201 file** | Dikumpulkan dari berbagai responden mahasiswa |

- Sample rate: 22050 Hz (mono)
- Format: MP3
- Sumber: Rekaman langsung laboratorium Universitas Trunojoyo Madura

---

## 10. Uji Kualitas & Unit Testing

- **Pengujian Logika Mesin Alarm** (8 skenario transisi & anti-flapping):
  ```bash
  cd frontend
  npm test
  ```
- **Pengujian Paritas Model** (memastikan fitur training = inferensi):
  ```bash
  python backend/tests/test_parity.py
  ```

---

## 11. Keterbatasan

- Satu responden menyumbang beberapa file. Evaluasi di atas adalah evaluasi *per file*; untuk mengukur generalisasi ke responden baru, dapat diuji dengan `StratifiedGroupKFold`.
- Ukuran holdout pada output terbaru adalah 40 file (20 non-berisik, 20 berisik).
- Karakteristik derau suara latar bersifat subjektif; sebagian rekaman memiliki noise yang sangat halus.
- Aplikasi menggunakan Model 3.0: 107 fitur masukan, soft-voting SVM + LightGBM + ExtraTrees, dan threshold 0.50. Output notebook terbaru mencatat holdout 97.50% (39/40) dan CV 95.00% +/- 1.58 poin persentase; probabilitas mikrofon langsung dapat berbeda karena kondisi ruangan, mikrofon, posisi perangkat, dan gain.

---

## 12. Hak Cipta & Lisensi

Hak Cipta &copy; 2026 **Universitas Trunojoyo Madura**  
Program Studi Sains Data &bull; Mata Kuliah Proyek Sains Data A
