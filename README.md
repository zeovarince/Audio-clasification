# SilentGuard Lab – Pemantau Kebisingan Laboratorium Real-time

> **Universitas Trunojoyo Madura &bull; Proyek Sains Data A**  
> **Tim Pengembang:**
> - A. Choiril Anwar EL-Asfihani Risydan
> - M. Hendrik Purwanto
> - Rifqi Fairurrafi

---

## 1. Ikhtisar Sistem

**SilentGuard Lab** adalah sistem pemantauan kebisingan laboratorium cerdas berbasis web. Sistem mendengarkan audio secara terus-menerus melalui browser, mengekstrak fitur audio (MFCC, Spectral, RMS, ZCR, dll.), dan mengklasifikasikan keramaian memakai model machine learning terkalibrasi (**Support Vector Classifier RBF**, akurasi **92.68%**).

Ketika kebisingan mencapai ambang batas:
- **Ambang 1 (60%)**: Memutar audio peringatan pertama (*"Tolong jangan berisik di lab"*).
- **Ambang 2 (80%)**: Memutar audio peringatan kedua dengan prioritas interupsi tinggi dan halo visual merah.

---

## 2. Struktur Proyek

```text
├── web/                       # Aplikasi Frontend Next.js (App Router, Tailwind v4, GSAP)
│   ├── app/                   # Routing & halaman dashboard utama
│   │   ├── globals.css        # Sistem desain AuthKit (midnight canvas, frosted glass)
│   │   ├── layout.tsx         # Tipografi Untitled Sans, aeonikPro, dotDigital
│   │   └── page.tsx           # Dashboard pemantauan otomatis (always-on)
│   ├── components/            # Komponen UI: Waveform, NoiseMeter, StatusCard, AlarmHistory, SplashScreen
│   ├── lib/                   # AudioCapture (AudioWorklet), AlarmMachine, Smoother, API client
│   └── public/                # Asset statis: logosilent.png, suara alarm 60% & 80%
│
├── backend/                   # Layanan Backend FastAPI
│   ├── main.py                # Server FastAPI & CORS middleware
│   ├── inference.py           # Pipeline inferensi SVC (load model sekali saat startup)
│   ├── features.py            # Ekstraksi 100 fitur audio (MFCC, Chroma, Spectral, dsb.)
│   ├── requirements.txt       # Kunci dependensi Python
│   ├── Dockerfile             # Container production-ready (HF Spaces, Render, Railway)
│   └── vercel.json            # Konfigurasi deploy serverless Vercel
│
├── model2.0/                  # Sumber model terlatih (joblib & pkl)
└── docs/                      # Dokumentasi teknis: ARCHITECTURE.md, DESIGN.md, DEPLOY.md, TASKS.md
```

---

## 3. Cara Menjalankan Secara Lokal

### A. Menjalankan Backend (FastAPI)
Pastikan Python 3.10+ terinstal:
```bash
cd backend
pip install -r requirements.txt
python -m uvicorn main:app --reload --port 8000
```
Uji kesehatan backend di browser atau terminal:
```bash
curl http://localhost:8000/health
```

### B. Menjalankan Frontend (Next.js)
Buka terminal baru:
```bash
cd web
npm install
npm run dev
```
Buka browser di **`http://localhost:3000`**.  
Pemantauan audio akan **otomatis aktif** seketika halaman selesai memuat splash screen.

---

## 4. Panduan Deploy ke Produksi

### A. Deploy Frontend ke Vercel
1. Hubungkan repository GitHub ke [Vercel](https://vercel.com).
2. Atur **Root Directory** ke folder `web`.
3. Tambahkan Environment Variable:
   - `NEXT_PUBLIC_API_URL`: URL publik backend FastAPI Anda (misal `https://api-silentguard.onrender.com` atau `https://your-space.hf.space`).
4. Klik **Deploy**.

### B. Deploy Backend (Docker / Render / Hugging Face Spaces)
Backend telah dilengkapi dengan `backend/Dockerfile` multi-platform:
1. **Hugging Face Spaces**:
   - Buat Space baru, pilih SDK **Docker**.
   - Push isi folder `backend/`.
   - Atur environment variable `ALLOWED_ORIGINS` ke domain Vercel frontend Anda.
2. **Render**:
   - Buat **Web Service**, pilih **Docker**, arahkan root directory ke `backend`.
   - Atur environment variable `ALLOWED_ORIGINS` ke domain frontend Anda.

---

## 5. Uji Kualitas & Unit Testing

- **Pengujian Logika Mesin Alarm** (8 skenario transisi & anti-flapping):
  ```bash
  cd web
  npm test
  ```
- **Pengujian Paritas Model**:
  ```bash
  python backend/tests/test_parity.py
  ```

---

## 6. Hak Cipta & Lisensi

Hak Cipta &copy; 2026 **Universitas Trunojoyo Madura**  
Program Studi Sains Data &bull; Mata Kuliah Proyek Sains Data A