# CLAUDE.md: Aturan Kerja untuk SilentGuard Lab

## Tentang proyek

SilentGuard Lab adalah web app pemantau kebisingan lab. Mikrofon di browser menangkap suara, backend Python mengklasifikasikannya (berisik atau tenang) memakai model `.joblib` dan `.pkl` yang sudah dilatih (akurasi sekitar 92%), dan sistem membunyikan alarm "tolong jangan berisik di lab" di ambang keramaian 60% dan 80%. Dashboard menampilkan waveform dan persentase keramaian secara real-time.

## Baca dulu sebelum mengerjakan apa pun

1. `docs/PRD.md`: apa yang dibangun dan batasannya
2. `docs/ALARM_LOGIC.md`: kapan alarm berbunyi (sumber kebenaran)
3. `docs/MODEL_SPEC.md`: cara memproses audio dan membaca model
4. `docs/ARCHITECTURE.md`: struktur kode dan kontrak API
5. `docs/UI_SPEC.md` dan `docs/DESIGN.md`: tampilan dan gaya visual
6. `docs/TASKS.md`: urutan pengerjaan dan status
7. `docs/DEPLOY.md`: hanya saat mengerjakan deploy

Jika kode bertentangan dengan dokumen, dokumen yang benar. Jika dokumen perlu diubah, ubah dokumennya lebih dulu dan beri tahu saya.

## Tech stack

- Frontend: Next.js (App Router), TypeScript, Tailwind CSS v4, di folder `frontend/`
- Backend: FastAPI, Uvicorn, scikit-learn, joblib, numpy, di folder `backend/`
- Audio: Web Audio API (`getUserMedia`, `AnalyserNode`, `AudioWorklet`)

## Perintah

```bash
# Frontend
cd frontend
npm install
npm run dev          # http://localhost:3000
npm run build
npm run lint
npm test             # unit test alarm machine

# Backend
cd backend
python -m venv .venv
source .venv/bin/activate        # Windows: .venv\Scripts\activate
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
pytest               # termasuk uji paritas model
```

## Aturan kode

- TypeScript dengan `strict` aktif. Hindari `any`.
- Komponen React berupa function component dengan hooks. Logika audio dan alarm ditaruh di `frontend/lib/`, bukan di dalam komponen.
- Nilai konfigurasi (ambang, window, hop, sample rate) hanya didefinisikan di `frontend/lib/config.ts`. Jangan menulis angka ajaib di tempat lain.
- Logika alarm harus identik dengan `docs/ALARM_LOGIC.md` dan punya unit test untuk semua skenario di dokumen itu.
- Backend: muat model sekali saat startup. Jangan memuat model di setiap request.
- Backend: jangan menulis audio ke disk dan jangan mencatat isi audio di log.
- Fitur audio di backend harus sama persis dengan saat training. Jangan mengubah `backend/features.py` tanpa menjalankan uji paritas.
- Jangan mengubah versi paket di `backend/requirements.txt` tanpa alasan. Versi scikit-learn harus sama dengan lingkungan training.
- Jangan memakai `localStorage` untuk data yang penting; riwayat alarm hanya hidup selama sesi.

## Aturan UI dan teks

- Ikuti `docs/DESIGN.md`: tema gelap, kaca buram, tombol berbentuk pil, aksen ungu hanya untuk tombol Mulai Pemantauan.
- Teks antarmuka dalam Bahasa Indonesia, kalimat pendek dan sopan.
- Jangan memakai tanda pisah em dash di teks antarmuka maupun di prompt. Hindari frasa klise ala teks otomatis.
- Status tidak boleh hanya dibedakan lewat warna; selalu sertakan ikon dan teks.
- Hormati `prefers-reduced-motion`.

## Cara bekerja

- Kerjakan satu tugas dari `docs/TASKS.md` per sesi. Setelah selesai, centang tugasnya.
- Saat memperbarui file, tampilkan kode file yang lengkap, bukan potongan.
- Jika ada pilihan desain yang belum diputuskan (lihat bagian "Keputusan terbuka" di `docs/ALARM_LOGIC.md` dan `docs/PRD.md`), pakai nilai default dan catat di ringkasan hasil kerja.
- Jika informasi yang dibutuhkan belum ada (misalnya bagian **[ISI]** di `docs/MODEL_SPEC.md`), berhenti dan tanyakan, jangan menebak.
- Sebelum menyatakan tugas selesai, jalankan lint, test, dan build yang relevan.

## Batasan

- Jangan menyimpan atau mengirim audio ke layanan pihak ketiga.
- Jangan menambah dependensi besar tanpa persetujuan, karena ukuran bundle backend dibatasi saat deploy.
- Jangan menyentuh file model di `backend/models/` selain membacanya.
