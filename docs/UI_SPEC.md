# UI_SPEC: Spesifikasi Antarmuka SilentGuard Lab

Gaya visual (warna, font, radius, bayangan) ada di `DESIGN.md`. Dokumen ini mengatur isi halaman, perilaku komponen, dan teks antarmuka.

## 1. Prinsip

1. Kondisi lab harus terbaca dalam sekali lihat dari jarak jauh (cocok untuk layar proyektor atau monitor di dinding).
2. Waveform dan persentase adalah pusat perhatian; elemen lain mendukung.
3. Status tidak hanya dibedakan lewat warna, selalu ada teks dan ikon.
4. Teks antarmuka singkat, sopan, dan tidak menyalahkan.

## 2. Halaman

Satu halaman dashboard di `/`.

```
+--------------------------------------------------------------+
| SilentGuard Lab                  [Status pill]  [Mulai/Berhenti] |
+--------------------------------------------------------------+
|                    LAB TENANG / TERLALU BERISIK              |
|                                                              |
|   +------------------------------------------------------+   |
|   |                 WAVEFORM (canvas)                    |   |
|   +------------------------------------------------------+   |
|                                                              |
|   +----------------------+   +---------------------------+   |
|   |  Persentase          |   |  Status alarm             |   |
|   |  keramaian: 73%      |   |  Peringatan 1             |   |
|   |  [====|====|=====]   |   |  Alarm 60% berbunyi 12:04 |   |
|   |       60   80        |   |                           |   |
|   +----------------------+   +---------------------------+   |
|                                                              |
|   Riwayat alarm                          [Tes alarm] [Atur]  |
|   12:04:10  Alarm 60%  keramaian 62%                         |
|   12:05:31  Alarm 80%  keramaian 84%                         |
+--------------------------------------------------------------+
```

## 3. Komponen

### 3.1 Header
- Wordmark "SilentGuard Lab" di kiri.
- Status pill di kanan: menampilkan Aman, Peringatan 1, atau Peringatan 2 beserta ikon.
- Tombol utama **Mulai Pemantauan** berubah menjadi **Hentikan** saat aktif. Tombol ini juga membuka izin mikrofon dan mengaktifkan audio alarm (syarat browser).

### 3.2 Waveform (`Waveform.tsx`)
- Canvas lebar penuh, tinggi 160 sampai 240 px.
- Data dari `AnalyserNode` (`fftSize` 2048, `getByteTimeDomainData`), digambar di `requestAnimationFrame`.
- Garis gelombang memakai gradien Skywash dari `DESIGN.md`. Saat Peringatan 1 dan 2, garis mendapat halo (glow) sesuai warna status.
- Saat belum memantau: garis datar tipis dengan teks "Tekan Mulai Pemantauan untuk mulai mendengarkan."
- Gelombang digambar di browser dan tidak bergantung pada respons backend.

### 3.3 Meter persentase (`NoiseMeter.tsx`)
- Angka besar di atas, misalnya `73%`, memakai font display.
- Bar horizontal 0 sampai 100 dengan dua penanda tetap di 60 dan 80 yang diberi label kecil.
- Isi bar berubah mengikuti skor dengan transisi 300 ms.
- Warna isi bar mengikuti status (lihat `DESIGN.md`, bagian status).
- Nilai diambil dari skor yang sudah dihaluskan (`ALARM_LOGIC.md` bagian 3).

### 3.4 Kartu status (`StatusCard.tsx`)

| State | Judul | Keterangan |
|---|---|---|
| Belum memantau | Belum aktif | Tekan Mulai Pemantauan untuk mulai. |
| `AMAN` | Lab tenang | Suasana lab terkendali. |
| `PERINGATAN_1` | Mulai ramai | Alarm 60% sudah berbunyi. |
| `PERINGATAN_2` | Terlalu berisik | Alarm 80% sudah berbunyi. Mohon kurangi suara. |

- Area ini memakai `aria-live="polite"` agar perubahan status dibacakan pembaca layar.
- Saat `PERINGATAN_2`, kartu berdenyut pelan (pulse) dan menghormati `prefers-reduced-motion`.

### 3.5 Riwayat alarm (`AlarmHistory.tsx`)
- Daftar terbaru di atas, maksimal 20 entri, hanya selama sesi (tidak disimpan permanen).
- Tiap entri: jam (HH:MM:SS), jenis alarm (60% atau 80%), nilai keramaian saat alarm.
- Kosong: "Belum ada alarm pada sesi ini."

### 3.6 Tombol Tes alarm
- Memutar alarm 60% lalu alarm 80% satu per satu agar pengguna bisa memastikan volume dan izin audio.
- Tidak mengubah state mesin alarm dan tidak masuk riwayat.

### 3.7 Panel pengaturan (drawer)
- Slider ambang alarm 1 (default 60) dan alarm 2 (default 80); alarm 2 harus selalu lebih besar dari alarm 1.
- Pilihan tahan tenang (`CALM_HOLD_SECONDS`).
- Tombol "Tes koneksi" yang memanggil `GET /health` dan menampilkan hasilnya.
- Tombol "Kembalikan default".

## 4. Teks antarmuka (Bahasa Indonesia)

| Konteks | Teks |
|---|---|
| Tombol mulai | Mulai Pemantauan |
| Tombol berhenti | Hentikan |
| Izin mikrofon ditolak | Izin mikrofon belum diberikan. Izinkan akses mikrofon di pengaturan browser, lalu coba lagi. |
| Backend tidak terjangkau | Server klasifikasi belum merespons. Memeriksa koneksi lagi... |
| Backend sedang bangun | Server sedang menyala, mohon tunggu sekitar setengah menit. |
| Alarm 60% (teks bantu) | Mulai ramai |
| Alarm 80% (teks bantu) | Terlalu berisik |
| Tab disembunyikan | Biarkan tab ini tetap terbuka agar pemantauan berjalan normal. |
| Audio alarm | Tolong jangan berisik di lab. |

Aturan teks: tanpa tanda pisah em dash, kalimat pendek, tidak memakai kata promosi berlebihan.

## 5. Keadaan layar

| Keadaan | Tampilan |
|---|---|
| Awal | Waveform datar, meter 0%, status "Belum aktif" |
| Memuat izin | Tombol berubah menjadi "Meminta izin..." dan dinonaktifkan |
| Aktif | Waveform bergerak, meter dan status hidup |
| Error | Banner di atas dashboard dengan tombol "Coba lagi" |
| Dihentikan | Kembali ke keadaan awal, riwayat tetap terlihat sampai halaman dimuat ulang |

## 6. Responsif

- Desktop (1024 px ke atas): susunan seperti diagram di atas.
- Tablet dan mobile: meter dan kartu status bertumpuk vertikal, waveform tetap lebar penuh.
- Maksimal lebar konten 1200 px.

## 7. Aksesibilitas

- Kontras teks minimal 4.5:1 terhadap latar.
- Semua tombol bisa dioperasikan dengan keyboard dan punya fokus yang terlihat.
- Animasi denyut dan transisi dimatikan saat `prefers-reduced-motion: reduce`.
- Status selalu punya label teks dan ikon, tidak hanya warna.
