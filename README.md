# SilentGuard Lab – Pemantau Kebisingan Laboratorium Real-time

> **Universitas Trunojoyo Madura &bull; Proyek Sains Data A**  
> **Tim Pengembang:**
> - A. Choiril Anwar EL-Asfihani Risydan
> - M. Hendrik Purwanto
> - Rifqi Fairurrafi

---

## 1. Ikhtisar Sistem

**SilentGuard Lab** adalah sistem pemantauan kebisingan laboratorium cerdas berbasis web. Sistem mendengarkan audio secara terus-menerus melalui browser, mengekstrak fitur audio (MFCC, Spectral, RMS, ZCR, dll.), dan mengklasifikasikan keramaian memakai model machine learning terkalibrasi.

> **Model yang dijalankan aplikasi:** Model 5.0 - SVC RBF + SelectKBest (80 dari 110 fitur), threshold 0.60, akurasi holdout 97.56% (40/41 file).

| Versi Model | Arsitektur | Jumlah Fitur | Akurasi Holdout (n=41) |
|---|---|---|---|
| Model 2.0 (Baseline) | Pipeline SVM RBF Tunggal | 100 fitur | 92.68% (38/41) |
| Model 3.0 | Soft-Voting Ensemble (SVM + LightGBM + ExtraTrees) | 107 fitur | 95.12% (39/41) |
| **Model 5.0 (aktif)** | **Pure SVM RBF** | **110 fitur** | **97.56% (40/41)** |

Ketika kebisingan mencapai ambang batas:
- **Deteksi model (60%)**: Model memberi label berisik mulai probabilitas 0.60 sesuai threshold Model 5.0. Dashboard menampilkan deteksi ini terpisah dari alarm.
- **Ambang 1 (60% default)**: Memutar peringatan pertama setelah konfirmasi.
- **Ambang 2 (80%)**: Memutar audio peringatan kedua dengan prioritas interupsi tinggi dan halo visual merah.

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
├── model3.0/                          # Model 3.0 Ensemble (107 fitur, 95.12%)
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
    |-- model5.0/                     # Model 5.0 aktif (110 fitur, threshold 0.60)
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

### Model 3.0 — Ensemble Voting (aktif di dashboard)

Backend aktif menggunakan `backend/models/MODEL_KLASIFIKASIV3-0.joblib`, salinan byte-identik dari `model3.0/MODEL_KLASIFIKASIV3-0.joblib` dengan threshold 0.50. Docker menyalin artefak backend tersebut ke `/app/models/`.

- **Arsitektur:** Soft-Voting Ensemble (Tuned SVM 50% + LightGBM 30% + ExtraTrees 20%)
- **Fitur:** 107 fitur (100 dasar spektral & MFCC + 7 rasio dinamis volume-invariant)
- **Seleksi Fitur Internal:** SVM (k=70), LightGBM (k=60), ExtraTrees (k=65)
- **Akurasi Holdout:** 95.12% (39 dari 41 file benar) dan 5-fold CV 95.51% ± 2.46%
- **Threshold Keputusan:** 0.50 (50%)

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
  "model_version": "5.0",
  "feature_count": 110,
  "selected_feature_count": 80,
  "decision_threshold": 0.6,
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
- Ukuran holdout test adalah 41 file (20 non-berisik, 21 berisik).
- Karakteristik derau suara latar bersifat subjektif; sebagian rekaman memiliki noise yang sangat halus.
- Aplikasi menggunakan pipeline Model 5.0: 110 fitur masukan, SelectKBest(k=80), threshold 0.60, dan SVC RBF. Notebook terbaru mencatat akurasi holdout 97,56% (40/41) pada threshold ini; probabilitas mikrofon langsung dapat berbeda karena kondisi ruangan, mikrofon, posisi perangkat, dan gain.

---

## 12. Hak Cipta & Lisensi

Hak Cipta &copy; 2026 **Universitas Trunojoyo Madura**  
Program Studi Sains Data &bull; Mata Kuliah Proyek Sains Data A
