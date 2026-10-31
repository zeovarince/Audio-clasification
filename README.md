# SilentGuard Lab – Pemantau Kebisingan Laboratorium Real-time

> **Universitas Trunojoyo Madura &bull; Proyek Sains Data A**  
> **Tim Pengembang:**
> - A. Choiril Anwar EL-Asfihani Risydan
> - M. Hendrik Purwanto
> - Rifqi Fairurrafi

---

## 1. Ikhtisar Sistem

**SilentGuard Lab** adalah sistem pemantauan kebisingan laboratorium cerdas berbasis web. Sistem mendengarkan audio secara terus-menerus melalui browser, mengekstrak fitur audio (MFCC, Spectral, RMS, ZCR, dll.), dan mengklasifikasikan keramaian memakai model machine learning terkalibrasi.

| Versi Model | Arsitektur | Jumlah Fitur | Akurasi Holdout (n=41) |
|---|---|---|---|
| Model 2.0 (Baseline) | Pipeline SVM RBF Tunggal | 100 fitur | 92.68% (38/41) |
| Model 3.0 | Soft-Voting Ensemble (SVM + LightGBM + ExtraTrees) | 107 fitur | 95.12% (39/41) |
| **Model 4.0 (Terbaru)** | **Pure SVM RBF Teroptimasi** | **112 fitur** | **97.56% (40/41)** |

Ketika kebisingan mencapai ambang batas:
- **Ambang 1 (60%)**: Memutar audio peringatan pertama (*"Tolong jangan berisik di lab"*).
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
|                      POST /predict (Int16 PCM)                           |
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
│   ├── inference.py                   # Pipeline inferensi SVC (load model saat startup)
│   ├── features.py                    # Ekstraksi 112 fitur Model 4.0
│   ├── requirements.txt               # Dependensi Python
│   ├── Dockerfile                     # Container production-ready
│   ├── vercel.json                    # Konfigurasi legacy; deploy aktif memakai Docker Compose
│   ├── models/                        # Salinan model untuk deployment
│   │   ├── model_klasifikasi_berisik.joblib
│   │   └── model_klasifikasi_berisik.pkl
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
├── model4.0/                          # Model 4.0 Pure SVM Teroptimasi (112 fitur, 97.56%)
│   ├── klasifikasi-audioV4.ipynb      # Notebook lengkap (76 cell, penjelasan CRISP-DM)
│   ├── model_klasifikasi_berisik.joblib
│   ├── model_klasifikasi_berisik.pkl
│   ├── output_fitur_berisik.csv
│   ├── output_fitur_segmen_berisik.csv
│   └── README.md
│
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

### Model 3.0 — Ensemble Voting (Akurasi 95.12%)

- **Arsitektur:** Soft-Voting Ensemble (SVM 50% + LightGBM 30% + ExtraTrees 20%)
- **Fitur:** 107 fitur (100 dasar + 7 rasio dinamis volume-invariant)
- **Peningkatan:** False negative berkurang dari 3 → 2 file, varians CV turun dari ±6.44% → ±2.46%

### Model 4.0 — Pure SVM Teroptimasi (Akurasi 97.56%) 🚀

- **Arsitektur:** `StandardScaler` → `SelectKBest(f_classif, k=80)` → `SVC(C=12.0, gamma=0.025, RBF)`
- **Fitur:** 112 fitur (107 sebelumnya + 5 fitur dinamika transien Generasi 4)
- **5 Fitur Baru Generasi 4:**
  1. `peak_to_p50` — Selisih energi dB antara persentil ke-95 dan median
  2. `crest_factor` — Rasio amplitudo puncak terhadap RMS sinyal
  3. `std_sum` — Gabungan variabilitas temporal RMS-dB dan spectral centroid
  4. `vocal_ratio` — Proporsi energi pada pita frekuensi vokal manusia (300–3400 Hz)
  5. `hf_spectral` — Proporsi energi frekuensi tinggi di atas 4000 Hz
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
MODEL_DIR=./models
```
Folder `backend/models/` berisi artefak Model 4.0. Jika `MODEL_DIR` tidak disetel, backend otomatis memakai folder itu.

---

## 7. API Endpoint

### `POST /predict`

| Parameter | Keterangan |
|---|---|
| **Content-Type** | `application/octet-stream` |
| **X-Sample-Rate** | `22050` |
| **Body** | Audio mono Int16 little-endian PCM (5.0 detik = 220.500 bytes) |

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
  "model_version": "4.0",
  "feature_count": 112,
  "sklearn_version": "1.6.1"
}
```

---

## 8. Deploy dengan Docker ke Server Lab

Docker Compose menjalankan dashboard Next.js dan API FastAPI sebagai dua container. Buka `http://localhost:8007` setelah menjalankan:

```bash
docker compose up --build
```

Untuk mengaktifkan deploy otomatis setiap push ke branch `main`, siapkan SSH server dan GitHub Secrets sesuai [DEPLOY_DOCKER.md](DEPLOY_DOCKER.md). Untuk akses mikrofon dari komputer lain, server perlu HTTPS.

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
- File model dan `backend/features.py` menggunakan 112 fitur Model 4.0, termasuk rekayasa fitur Gen-3 dan Gen-4. Akurasi 97.56% adalah hasil holdout test 41 file; hasil inferensi mikrofon langsung dapat berbeda karena kondisi ruangan, mikrofon, dan gain perangkat.

---

## 12. Hak Cipta & Lisensi

Hak Cipta &copy; 2026 **Universitas Trunojoyo Madura**  
Program Studi Sains Data &bull; Mata Kuliah Proyek Sains Data A
