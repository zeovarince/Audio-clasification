# TASKS: Rencana Pengerjaan SilentGuard Lab

Kerjakan berurutan. Centang tugas setelah lolos kriteria selesai. Satu sesi kerja sebaiknya mengerjakan satu fase atau bagian dari satu fase.

## Fase 0: Persiapan

- [x] 0.1 Lengkapi bagian **[ISI]** di `MODEL_SPEC.md` dari notebook training (sample rate, window, fitur, versi library, kelas)
- [x] 0.2 Siapkan dua file audio alarm: `alarm-60.mp3` dan `alarm-80.mp3` (tersedia di `alrm/`)
- [x] 0.3 Buat repo dan struktur folder sesuai `ARCHITECTURE.md`
- [x] 0.4 Putuskan keputusan terbuka di `ALARM_LOGIC.md` bagian 6 (atau pakai default)

Selesai jika: tidak ada **[ISI]** tersisa dan struktur repo sudah ada.

## Fase 1: Backend dan model

- [x] 1.1 Setup FastAPI, `GET /health`, dan CORS lewat `ALLOWED_ORIGINS`
- [x] 1.2 Salin fungsi ekstraksi fitur ke `backend/features.py`
- [x] 1.3 Implementasi `inference.py` (muat model sekali saat startup)
- [x] 1.4 Implementasi `POST /predict` sesuai kontrak di `ARCHITECTURE.md`
- [x] 1.5 Uji paritas: `backend/tests/test_parity.py` dengan `golden.json`
- [x] 1.6 Kunci versi paket di `requirements.txt`

Selesai jika: uji paritas lulus (selisih di bawah 0.01) dan `/predict` merespons dengan benar untuk file WAV uji.

## Fase 2: Frontend dasar dan audio (web/)

- [x] 2.1 Setup Next.js, Tailwind v4, font, dan token dari `DESIGN.md`
- [x] 2.2 Latar grid dan spotlight, layout dashboard kosong
- [x] 2.3 Tangkap mikrofon: tombol Mulai, izin, penanganan penolakan izin
- [x] 2.4 Komponen `Waveform` dari `AnalyserNode`
- [x] 2.5 `AudioWorklet` untuk mengumpulkan PCM dan mengirim potongan tiap `HOP_SECONDS`
- [x] 2.6 `lib/api.ts` memanggil `/predict`, termasuk penanganan error dan timeout

Selesai jika: waveform bergerak mulus dan respons `/predict` terlihat di console saat memantau.

## Fase 3: Skor dan alarm (web/)

- [x] 3.1 `smoothing.ts`: rata-rata bergerak `SMOOTHING_WINDOW`
- [x] 3.2 Komponen `NoiseMeter` dengan penanda 60 dan 80
- [x] 3.3 `alarm-machine.ts` sesuai `ALARM_LOGIC.md`
- [x] 3.4 Unit test untuk 8 skenario di `ALARM_LOGIC.md` bagian 8
- [x] 3.5 `alarm-player.ts`: putar alarm 1 dan 2, alarm 2 boleh memotong alarm 1
- [x] 3.6 Tombol Tes alarm

Selesai jika: semua unit test lulus dan alarm berbunyi di browser setelah menekan Mulai.

## Fase 4: UI lengkap (web/)

- [x] 4.1 `StatusCard` dengan tiga state dan `aria-live`
- [x] 4.2 Status pill di header
- [x] 4.3 `AlarmHistory`
- [x] 4.4 Panel pengaturan: ambang, tahan tenang, tes koneksi, kembalikan default
- [x] 4.5 Banner error dan teks sesuai `UI_SPEC.md` bagian 4
- [x] 4.6 Responsif dan `prefers-reduced-motion`

Selesai jika: semua keadaan di `UI_SPEC.md` bagian 5 bisa ditampilkan dan terbaca di layar proyektor.

## Fase 5: Pengujian di lab

Skenario uji lapangan (isi hasil di kolom kanan):

| # | Skenario | Hasil yang diharapkan | Hasil |
|---|---|---|---|
| 1 | Lab tenang 10 menit | Tidak ada alarm | |
| 2 | Obrolan biasa 2 sampai 3 orang | Tidak ada alarm, atau paling banyak alarm 60% | |
| 3 | Keramaian naik bertahap | Alarm 60%, lalu alarm 80% | |
| 4 | Teriakan sesaat | Tidak langsung alarm 80% (penghalusan bekerja) | |
| 5 | Ramai, tenang, lalu ramai lagi | Alarm 60% berbunyi lagi | |
| 6 | Suara kipas atau AC saja | Tidak dianggap berisik | |
| 7 | Backend dimatikan saat memantau | Banner error, tidak ada alarm palsu | |

- [ ] 5.1 Jalankan semua skenario dan catat hasil
- [ ] 5.2 Sesuaikan ambang, `SMOOTHING_WINDOW`, dan `CALM_HOLD_SECONDS` jika perlu
- [ ] 5.3 Catat keterbatasan yang ditemukan di `MODEL_SPEC.md` bagian 7

## Fase 6: Deploy

- [ ] 6.1 Ikuti `DEPLOY.md` Rencana A (full Vercel); jika ukuran melebihi batas, pindah ke Rencana B
- [ ] 6.2 Atur environment variable dan CORS di produksi
- [ ] 6.3 Uji dari URL publik: izin mikrofon, `/health`, `/predict`, alarm
- [ ] 6.4 Tulis `README.md` (cara menjalankan lokal, URL demo, cara membangunkan backend)

Selesai jika: seluruh alur berjalan dari URL publik di Chrome.

## Fase 7: Opsional

- [ ] 7.1 Gabungkan skor model dengan tingkat volume (RMS atau dB) jika probabilitas saja kurang stabil
- [ ] 7.2 Ekspor riwayat alarm ke CSV
- [ ] 7.3 Mode layar penuh untuk proyektor
- [ ] 7.4 Pengingat berulang saat keramaian bertahan (opsi 3 di `ALARM_LOGIC.md`)
