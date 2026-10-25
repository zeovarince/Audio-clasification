# ARCHITECTURE: SilentGuard Lab

## 1. Gambaran umum

Dua bagian terpisah:

- **Frontend (Next.js)**: menangkap mikrofon, menggambar waveform, menghitung skor keramaian, menjalankan logika alarm, dan memutar audio alarm.
- **Backend (FastAPI, Python)**: memuat model `.joblib` dan `.pkl`, mengekstrak fitur audio, dan mengembalikan probabilitas berisik.

Model berformat Python tidak bisa dijalankan di Node.js, karena itu inferensi dipisah ke backend Python.

```
 Mikrofon
    |
    v
+--------------------------- Browser (Next.js) ---------------------------+
|  getUserMedia -> AudioContext                                           |
|        |                                                                |
|        +--> AnalyserNode -----------> Waveform canvas (60 fps, lokal)   |
|        |                                                                |
|        +--> AudioWorklet -> buffer PCM (mono, sample rate model)        |
|                                |                                        |
|                                v  tiap HOP detik, kirim WINDOW detik    |
|                      POST /predict (Int16 PCM)                          |
|                                |                                        |
|   skor keramaian <-- rata-rata <-- noise_probability                    |
|        |                                                                |
|        +--> Meter persentase                                            |
|        +--> Alarm machine (ALARM_LOGIC.md) -> putar alarm1.mp3/alarm2   |
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
| Frontend | Next.js (App Router), TypeScript, Tailwind CSS v4 |
| Audio di browser | Web Audio API: `getUserMedia`, `AnalyserNode`, `AudioWorklet` |
| Backend | FastAPI, Uvicorn |
| ML | scikit-learn, joblib, numpy (dan librosa jika dipakai saat training); versi dikunci sama dengan training |
| Deploy | Lihat `DEPLOY.md` |

## 3. Struktur repo

```
silentguard-lab/
  CLAUDE.md
  README.md
  docs/                      # semua dokumen spesifikasi
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
    models/
      model.joblib
      <nama>.pkl
    tests/
      test_parity.py
      golden.json
```

## 4. Kontrak API

### `POST /predict`

Request:
- Header `Content-Type: application/octet-stream`
- Header `X-Sample-Rate: <angka>` (harus sama dengan sample rate di `MODEL_SPEC.md`)
- Body: audio mono, Int16 little-endian PCM, panjang sesuai `WINDOW_SECONDS`

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
{ "status": "ok", "model_loaded": true, "sklearn_version": "x.y.z" }
```

Dipakai tombol "Tes koneksi" di UI dan untuk membangunkan backend gratis yang sedang tidur.

## 5. Alur data detail

1. Pengguna menekan Mulai. Frontend membuat `AudioContext` dengan sample rate model (jika browser tidak mendukung, lakukan resample di worklet).
2. `AudioWorklet` mengumpulkan sampel mono ke ring buffer.
3. Setiap `HOP_SECONDS` (default 1 detik), frontend mengambil `WINDOW_SECONDS` terakhir, mengonversi Float32 ke Int16, dan mengirim ke `/predict`.
4. Respons masuk ke `smoothing.ts` (rata-rata `SMOOTHING_WINDOW` nilai terakhir) menjadi skor 0 sampai 100.
5. Skor dikirim ke `NoiseMeter` dan `alarm-machine.ts`. Jika mesin mengembalikan `play`, `alarm-player.ts` memutar file audio yang sesuai.
6. Waveform berjalan terpisah di `requestAnimationFrame`, dari `AnalyserNode`, sehingga tetap mulus walau backend lambat.

## 6. Konfigurasi

`frontend/.env.local`:
```
NEXT_PUBLIC_API_URL=http://localhost:8000
```

`backend/.env` (atau variabel lingkungan di host):
```
ALLOWED_ORIGINS=http://localhost:3000
```

`frontend/lib/config.ts` berisi nilai yang berasal dari `MODEL_SPEC.md` dan `ALARM_LOGIC.md`:
`SAMPLE_RATE`, `WINDOW_SECONDS`, `HOP_SECONDS`, `THRESHOLD_1`, `THRESHOLD_2`, `CALM_HOLD_SECONDS`, `SMOOTHING_WINDOW`, `JUMP_TO_ALARM_2`.

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
- Batasi ukuran body request di backend (potongan beberapa detik cukup puluhan KB).
- Muat file model hanya dari folder `backend/models/` milik sendiri.

## 9. Catatan performa

- 1 detik audio mono 16 kHz Int16 kira-kira 32 KB. Satu request per detik ringan untuk jaringan lab biasa.
- Muat model sekali saat startup, bukan per request.
- Jika ekstraksi fitur memakai librosa, panggilan pertama bisa lambat karena inisialisasi; lakukan pemanasan (warm-up) saat startup.
