# ARCHITECTURE: SilentGuard Lab

## 1. Gambaran umum

Dua bagian terpisah:

- **Frontend (Next.js di folder `frontend/`)**: menangkap mikrofon pada 22050 Hz mono, menggambar waveform, mengubah probabilitas menjadi skor 0–100, menjalankan logika alarm, dan memutar audio alarm.
- **Backend (FastAPI, Python di folder `backend/`)**: memuat artefak Model 4.0 dari `backend/models/`, mengekstrak 112 fitur, dan mengembalikan probabilitas berisik.

Model berformat Python tidak bisa dijalankan di Node.js, karena itu inferensi dipisah ke backend Python.

```
 Mikrofon
    |
    v
+----------------------------- Browser (Next.js) --------------------------+
|  getUserMedia -> AudioContext                                           |
|        |                                                                |
|        +--> AnalyserNode -----------> Waveform canvas (60 fps, lokal)   |
|        |                                                                |
|        +--> AudioWorklet -> buffer PCM (mono, 22050 Hz)                 |
|                                |                                        |
|                                v  tiap 1.0s, kirim 5.0s audio           |
|                      POST /predict (Int16 PCM)                          |
|                                |                                        |
|   skor keramaian <-- rata-rata <-- noise_probability                    |
|        |                                                                |
|        +--> Meter persentase                                            |
|        +--> Alarm machine (ALARM_LOGIC.md) -> putar alarm 60% / 80%     |
+-------------------------------------------------------------------------+
                                 |
                                 v
+---------------------------- Backend (FastAPI) --------------------------+
|  validasi input -> ekstraksi fitur -> scaler -> model.predict_proba     |
|  -> { noise_probability, label, processing_ms }                         |
+-------------------------------------------------------------------------+
```

## 2. Tech stack

| Lapisan | Pilihan |
|---|---|
| Frontend | Next.js (App Router), TypeScript, Tailwind CSS v4 di `frontend/` |
| Audio di browser | Web Audio API: `getUserMedia`, `AnalyserNode`, `AudioWorklet` |
| Backend | FastAPI, Uvicorn di `backend/` |
| ML | Model 4.0: SVM RBF, 112 fitur; scikit-learn 1.6.1, joblib, numpy, librosa |
| Deploy | Docker Compose di server lab pada port 8007; lihat `../DEPLOY_DOCKER.md` |

## 3. Struktur repo

```
Audio-clasification/
  CLAUDE.md
  README.md
  docs/                      # semua dokumen spesifikasi
  alrm/                      # audio alarm sumber (alarm60%.mp3, alarm80%.mp3)
  backend/models/            # artefak Model 4.0 (112 fitur)
  frontend/                  # aplikasi Next.js
    app/
      layout.tsx
      page.tsx               # dashboard
    components/
      Waveform.tsx
      NoiseMeter.tsx
      StatusCard.tsx
      AlarmHistory.tsx
      StartButton.tsx
    lib/
      config.ts              # ambang, window, hop, URL backend
      audio-capture.ts       # mikrofon, AudioContext, AudioWorklet
      api.ts                 # pemanggilan /predict
      smoothing.ts           # rata-rata bergerak
      alarm-machine.ts       # state machine dari ALARM_LOGIC.md
      alarm-player.ts        # pemutar audio alarm
    public/
      alarms/
        alarm-60.mp3
        alarm-80.mp3
      worklets/
        pcm-capture.js
  backend/
    main.py                  # FastAPI app
    inference.py             # muat model dan prediksi
    features.py              # ekstraksi fitur (salinan dari training)
    requirements.txt
    tests/
      test_parity.py
      golden.json
```

## 4. Kontrak API

### `POST /predict`

Request:
- Header `Content-Type: application/octet-stream`
- Header `X-Sample-Rate: 22050` (harus sama dengan sample rate model)
- Body: audio mono, Int16 little-endian PCM, panjang sesuai `WINDOW_SECONDS` (default 5.0 detik = 110.250 sampel = 220.500 bytes)

Response 200:
```json
{
  "noise_probability": 0.73,
  "label": "berisik",
  "processing_ms": 42
}
```

Error:
- `400` body kosong atau panjang audio tidak sesuai
- `415` content type salah
- `422` sample rate tidak cocok dengan model
- `500` kegagalan inferensi

### `GET /health`

```json
{
  "status": "ok",
  "model_loaded": true,
  "model_version": "4.0",
  "feature_count": 112,
  "sample_rate": 22050,
  "sklearn_version": "1.6.1"
}
```

Dipakai tombol "Tes koneksi" di UI dan untuk pemantauan ketersediaan backend.

## 5. Alur data detail

1. Pengguna menekan Mulai. Frontend membuat `AudioContext` pada 22050 Hz; browser mengonversi audio device ke sample rate konteks. Jika konteks tidak dapat memakai 22050 Hz, frontend menampilkan error dan tidak mengirim audio dengan sample rate keliru.
2. `AudioWorklet` mengumpulkan sampel mono ke ring buffer.
3. Setiap `HOP_SECONDS` (default 1 detik), frontend mengambil `WINDOW_SECONDS` terakhir (default 5 detik), mengonversi Float32 ke Int16, dan mengirim ke `/predict`.
4. Respons masuk ke `smoothing.ts` (rata-rata `SMOOTHING_WINDOW` nilai terakhir) menjadi skor 0 sampai 100.
5. Skor dikirim ke `NoiseMeter` dan `alarm-machine.ts`. Jika mesin mengembalikan `play`, `alarm-player.ts` memutar file audio yang sesuai (`alarm-60.mp3` atau `alarm-80.mp3`).
6. Waveform berjalan terpisah di `requestAnimationFrame`, dari `AnalyserNode`, sehingga tetap mulus 60 fps walau panggilan jaringan backend memakan waktu.

## 6. Konfigurasi

`frontend/.env.local`:
```
NEXT_PUBLIC_API_URL=http://localhost:8000
```

`backend/.env` (atau variabel lingkungan di host):
```
ALLOWED_ORIGINS=http://localhost:3000
MODEL_DIR=./models
```

`frontend/lib/config.ts` berisi nilai yang berasal dari `MODEL_SPEC.md` dan `ALARM_LOGIC.md`:
`SAMPLE_RATE = 22050`, `WINDOW_SECONDS = 5.0`, `HOP_SECONDS = 1.0`, `THRESHOLD_1 = 60`, `THRESHOLD_2 = 80`, `CALM_HOLD_SECONDS = 3`, `SMOOTHING_WINDOW = 3`, `JUMP_TO_ALARM_2 = true`.

## 7. Penanganan error

| Kondisi | Perilaku |
|---|---|
| Izin mikrofon ditolak | Tampilkan pesan dan petunjuk mengizinkan mikrofon; pemantauan tidak mulai |
| Backend tidak terjangkau | Tampilkan banner error, coba lagi dengan jeda; skor dibekukan dan alarm tidak dipicu dari data lama |
| Respons backend lambat | Lewati potongan yang menumpuk, jangan antre tanpa batas |
| Tab disembunyikan | Browser dapat menurunkan prioritas timer; tampilkan peringatan bahwa tab harus tetap terbuka |

## 8. Privasi dan keamanan

- Audio tidak disimpan di server maupun di browser. Backend memproses di memori dan membuangnya.
- Tidak ada logging isi audio.
- CORS dibatasi ke domain frontend lewat `ALLOWED_ORIGINS`.
- Batasi ukuran body request di backend.
- Muat file model dari direktori `MODEL_DIR`.

## 9. Catatan performa

- 5 detik audio mono 22050 Hz Int16 kira-kira 220 KB. Satu request per detik sangat ringan untuk jaringan lokal lab.
- Model dimuat sekali saat startup backend.
- Ekstraksi fitur menggunakan STFT dan MFCC yang dioptimalkan dengan numpy dan librosa.
