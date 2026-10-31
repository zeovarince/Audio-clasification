# PRD: SilentGuard Lab

Versi 0.1 | Status: Draft | Platform: Web app (Next.js + FastAPI)

## 1. Ringkasan

SilentGuard Lab adalah sistem pemantau kebisingan berbasis web untuk laboratorium. Sistem menangkap suara dari mikrofon, mengklasifikasikannya sebagai berisik atau tenang memakai Model 4.0 (akurasi holdout 97.56%), menampilkan gelombang suara dan persentase keramaian secara real-time, lalu membunyikan alarm peringatan ketika keramaian melewati ambang tertentu.

## 2. Latar belakang dan masalah

Lab membutuhkan suasana yang cukup tenang untuk praktikum dan kerja fokus. Teguran manual dari asisten atau penjaga lab tidak konsisten dan sering terlambat. Sistem ini memberi peringatan otomatis, objektif, dan bertahap sebelum kebisingan menjadi masalah.

## 3. Tujuan

1. Mendeteksi keramaian di lab secara real-time memakai model yang sudah ada.
2. Menampilkan kondisi suara secara jelas: waveform dan persentase keramaian.
3. Membunyikan alarm bertahap di ambang 60% dan 80% sesuai aturan di `ALARM_LOGIC.md`.
4. Bisa diakses lewat browser dan di-deploy ke internet.

## 4. Non-tujuan (versi ini)

- Tidak mengidentifikasi siapa yang berbicara dan tidak merekam atau menyimpan audio.
- Tidak ada akun pengguna, login, atau database.
- Tidak ada aplikasi mobile native atau perangkat keras khusus (Raspberry Pi) pada versi ini.
- Tidak melatih ulang model dari dalam aplikasi.

## 5. Pengguna

| Pengguna | Kebutuhan |
|---|---|
| Penghuni lab (mahasiswa) | Mendengar peringatan yang jelas saat terlalu ramai |
| Asisten / pengelola lab | Melihat kondisi kebisingan sekilas lewat dashboard |
| Penguji / dosen (demo) | Melihat sistem berjalan dan mudah dipahami alurnya |

## 6. Kebutuhan fungsional

| ID | Kebutuhan | Prioritas |
|---|---|---|
| FR-01 | Tombol Mulai dan Berhenti Pemantauan; meminta izin mikrofon saat Mulai | Must |
| FR-02 | Menampilkan waveform suara real-time dari mikrofon | Must |
| FR-03 | Menampilkan persentase keramaian (0 sampai 100) yang diperbarui terus-menerus dan sudah dihaluskan | Must |
| FR-04 | Audio dipotong per jendela waktu dan dikirim ke backend; backend mengembalikan probabilitas berisik | Must |
| FR-05 | Alarm 1 berbunyi saat keramaian mencapai 60% | Must |
| FR-06 | Alarm 2 berbunyi saat keramaian bertahan lalu naik mencapai 80% | Must |
| FR-07 | Setelah keramaian turun lalu naik lagi, alarm 60% berbunyi lagi (aturan lengkap di `ALARM_LOGIC.md`) | Must |
| FR-08 | Indikator status: Aman, Peringatan 1, Peringatan 2 | Must |
| FR-09 | Riwayat alarm selama sesi (waktu, jenis alarm, nilai keramaian) | Should |
| FR-10 | Ambang 60 dan 80 dapat diubah lewat konfigurasi | Should |
| FR-11 | Tombol "Tes alarm" untuk memastikan suara alarm dan izin audio browser aktif | Should |
| FR-12 | Pesan error yang jelas: izin mikrofon ditolak, backend tidak terjangkau, model gagal dimuat | Must |
| FR-13 | Tampilan responsif untuk laptop dan layar proyektor; mobile cukup terbaca | Could |

## 7. Kebutuhan non-fungsional

- **Latensi:** dari suara terdengar sampai persentase berubah di layar, target di bawah 2 detik (usulan, dikonfirmasi saat uji).
- **Waveform:** digambar di browser tanpa menunggu server, target 60 fps.
- **Privasi:** audio hanya diproses sementara di memori, tidak ditulis ke disk dan tidak disimpan. Pengguna lab perlu diberi tahu bahwa ada pemantauan suara (papan info di lab).
- **Keamanan:** akses mikrofon hanya lewat HTTPS (atau localhost). CORS dibatasi ke domain frontend.
- **Kompatibilitas:** Chrome dan Edge versi terbaru. Safari dan Firefox diuji belakangan.
- **Aksesibilitas:** status tidak hanya dibedakan lewat warna; selalu ada teks dan ikon.
- **Reproduksibilitas model:** hasil prediksi di backend harus sama dengan hasil di notebook training (lihat uji paritas di `MODEL_SPEC.md`).

## 8. Alur utama

1. Pengguna membuka web dan menekan **Mulai Pemantauan**.
2. Browser meminta izin mikrofon; pengguna mengizinkan.
3. Waveform bergerak; potongan audio dikirim ke backend secara berkala.
4. Backend mengembalikan probabilitas berisik; frontend menghaluskan nilainya menjadi persentase keramaian.
5. State machine alarm mengevaluasi persentase dan memutar alarm bila perlu.
6. Riwayat alarm dan status diperbarui di dashboard.

## 9. Metrik keberhasilan

| Metrik | Target |
|---|---|
| Akurasi model offline | 97.56% pada holdout test 41 file Model 4.0 |
| Alarm 60% berbunyi pada skenario keramaian uji | 100% dari skenario di `TASKS.md` |
| Alarm palsu saat lab tenang | ditetapkan setelah uji lapangan (usulan awal: tidak ada alarm dalam 10 menit lab tenang) |
| Latensi suara ke persentase | di bawah 2 detik |

## 10. Risiko dan asumsi

| Risiko | Dampak | Mitigasi |
|---|---|---|
| Fitur audio di backend berbeda dari saat training | Akurasi turun jauh | Uji paritas dan dokumentasi di `MODEL_SPEC.md` |
| Versi scikit-learn beda dengan saat training | Model gagal dimuat atau salah hitung | Pin versi di `requirements.txt` |
| Backend gratis tertidur (cold start) | Respon pertama lambat | Bangunkan sebelum demo; tombol Tes koneksi |
| Browser memblokir audio otomatis | Alarm tidak berbunyi | Alarm diaktifkan lewat klik tombol Mulai |
| Probabilitas model bukan ukuran volume sebenarnya | "Persentase keramaian" bisa menyesatkan | Lihat pertanyaan terbuka no. 1 |
| Kebisingan latar (kipas, AC lab) dianggap berisik | Alarm palsu | Uji di lab nyata dan kalibrasi ambang |

## 11. Pertanyaan terbuka

1. "Persentase keramaian" diambil dari probabilitas kelas berisik, atau digabung dengan tingkat volume (RMS atau dB)? Default: probabilitas kelas berisik.
2. Saat lonjakan langsung dari tenang ke 80% ke atas, alarm 80% langsung berbunyi? Default: ya.
3. Setelah alarm 80% dan keramaian turun ke rentang 60 sampai 79, status tetap Peringatan 2 atau turun ke Peringatan 1? Default: tetap Peringatan 2.
4. Deploy akhir: Docker Compose pada server lab; lihat `../DEPLOY_DOCKER.md`.

## 12. Dokumen terkait

`ALARM_LOGIC.md`, `MODEL_SPEC.md`, `UI_SPEC.md`, `DESIGN.md`, `ARCHITECTURE.md`, `TASKS.md`, `DEPLOY.md`, `../CLAUDE.md`
