# DEPLOY: Panduan Deploy SilentGuard Lab

Frontend (Next.js) selalu ke Vercel. Pertanyaannya hanya di mana backend Python (FastAPI + model) dijalankan. Ada dua rencana: coba full Vercel dulu (Rencana A), dan jika gagal atau terlalu lambat pindah ke Hugging Face Spaces (Rencana B).

Batas, harga, dan kuota layanan gratis berubah dari waktu ke waktu. Cek halaman resmi masing-masing sebelum bergantung padanya.

## 1. Prasyarat umum

- Repo di GitHub dengan struktur di `ARCHITECTURE.md`.
- Uji paritas model lulus (`MODEL_SPEC.md` bagian 9).
- `backend/requirements.txt` hanya berisi paket yang dibutuhkan saat inferensi, dengan versi dikunci sama dengan lingkungan training. Jangan menyertakan pytest, jupyter, atau paket training lain.
- File model ada di `backend/models/`.
- Akses mikrofon butuh HTTPS. Vercel dan Hugging Face Spaces memberi HTTPS otomatis.

## 2. Rencana A: Full Vercel (dua project dari satu repo)

Batas yang relevan (diperiksa dari dokumentasi Vercel):
- Fungsi Python punya batas ukuran bundle 500 MB (tidak terkompresi).
- Vercel tidak melakukan tree-shaking untuk Python: semua file yang terjangkau saat build ikut masuk, termasuk data uji dan notebook.
- Ada beta Large Functions sampai 5 GB, tetapi di plan Hobby ada laporan pengguna bahwa batas 500 MB tetap berlaku, jadi jangan diandalkan.

Langkah:

1. Di Vercel, buat project pertama dari repo, atur **Root Directory** ke `frontend`. Framework terdeteksi Next.js.
2. Buat project kedua dari repo yang sama, atur **Root Directory** ke `backend`. Pastikan ada instance FastAPI bernama `app` di `backend/main.py`. Jika tidak terdeteksi, cek halaman dokumentasi FastAPI di Vercel untuk nama file entrypoint yang didukung.
3. Tambahkan `backend/vercel.json` untuk mengecualikan file yang tidak perlu:
   ```json
   {
     "functions": {
       "main.py": {
         "excludeFiles": "{tests/**,notebooks/**,data/**,**/*.ipynb,**/__pycache__/**}"
       }
     }
   }
   ```
   (Sesuaikan pola `functions` dengan struktur yang dikenali Vercel; jika berbeda, ikuti pesan error build.)
4. Di project backend, atur environment variable `ALLOWED_ORIGINS` berisi URL project frontend.
5. Di project frontend, atur `NEXT_PUBLIC_API_URL` berisi URL project backend.
6. Deploy kedua project. Buka `<url-backend>/health` dan pastikan `model_loaded` bernilai true.

Hal yang perlu diwaspadai di Rencana A:
- Jika build gagal dengan pesan ukuran melebihi 500 MB, penyebab biasanya librosa dan dependensinya. Kurangi paket, atau langsung pindah ke Rencana B.
- Fungsi serverless bisa mengalami cold start dan request pertama lebih lambat.
- Ada batas ukuran body request di fungsi serverless (sekitar 4,5 MB). Potongan audio beberapa detik jauh di bawah batas ini.

## 3. Rencana B: Frontend di Vercel, backend di Hugging Face Spaces

Alasan memilih Spaces: CPU gratis yang tersedia lebih longgar untuk model ML (2 vCPU, 16 GB RAM, 50 GB disk tidak permanen menurut dokumentasi publik saat dokumen ini ditulis), dan mendukung Docker sehingga library berat seperti librosa tidak masalah. Kekurangannya, ruang gratis bisa tertidur setelah lama tidak dipakai.

Langkah:

1. Buat Space baru di huggingface.co, pilih SDK **Docker**.
2. Di root Space, buat `README.md` dengan front matter:
   ```yaml
   ---
   title: SilentGuard Lab API
   sdk: docker
   app_port: 7860
   ---
   ```
3. Buat `Dockerfile` (salin isi folder `backend/` ke root Space):
   ```dockerfile
   FROM python:3.11-slim

   RUN apt-get update && apt-get install -y --no-install-recommends libsndfile1 \
       && rm -rf /var/lib/apt/lists/*

   RUN useradd -m -u 1000 user
   USER user
   ENV PATH="/home/user/.local/bin:$PATH"
   WORKDIR /home/user/app

   COPY --chown=user requirements.txt .
   RUN pip install --no-cache-dir -r requirements.txt

   COPY --chown=user . .

   CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "7860"]
   ```
   Samakan versi Python di baris `FROM` dengan versi Python saat training sedekat mungkin.
4. Push ke Space lewat git. Untuk file model yang besar, gunakan Git LFS sesuai petunjuk Hugging Face.
5. Atur variabel `ALLOWED_ORIGINS` di pengaturan Space (Variables and secrets) berisi URL frontend.
6. Setelah build selesai, URL backend berbentuk `https://<username>-<nama-space>.hf.space`. Uji `/health`.
7. Di project Vercel frontend, atur `NEXT_PUBLIC_API_URL` ke URL Space tersebut, lalu deploy ulang.

## 4. Alternatif lain

| Layanan | Catatan |
|---|---|
| Render (web service gratis, Docker) | Mudah untuk FastAPI, tetapi layanan gratis tertidur setelah sekitar 15 menit tanpa trafik dan request pertama bisa butuh sekitar 30 detik |
| Railway | Ada kredit gratis bulanan yang terbatas, cocok untuk sementara |
| VPS | Paling stabil dan fleksibel, tetapi setup manual |
| Jalankan lokal di komputer lab | Tanpa cloud; `localhost` dianggap aman oleh browser. Pilihan paling sederhana jika sistem hanya dipakai di satu komputer |

Gunakan Dockerfile yang sama seperti Rencana B untuk Render.

## 5. Checklist sebelum demo

- [ ] `/health` mengembalikan `model_loaded: true`
- [ ] Versi scikit-learn di server sama dengan `MODEL_SPEC.md`
- [ ] CORS hanya mengizinkan URL frontend
- [ ] Frontend memakai HTTPS dan backend juga HTTPS (tidak boleh campur)
- [ ] Izin mikrofon muncul dan diterima di Chrome
- [ ] Audio alarm terdengar (cek lewat tombol Tes alarm)
- [ ] Backend gratis sudah dibangunkan 5 sampai 10 menit sebelum demo
- [ ] Skenario uji di `TASKS.md` Fase 5 dijalankan dari URL publik

## 6. Pemecahan masalah

| Gejala | Kemungkinan penyebab | Solusi |
|---|---|---|
| Build Vercel gagal, ukuran melebihi 500 MB | Dependensi terlalu besar atau file tidak perlu ikut | Bersihkan `requirements.txt`, tambah `excludeFiles`, atau pindah ke Rencana B |
| Error `ModuleNotFoundError` saat startup | Paket belum ada di `requirements.txt` | Tambahkan dan deploy ulang |
| Error saat memuat model atau hasil aneh | Versi scikit-learn atau Python berbeda dari training | Samakan versi di `requirements.txt` dan Dockerfile |
| Browser menolak memanggil backend | CORS atau mixed content | Cek `ALLOWED_ORIGINS` dan pastikan kedua sisi HTTPS |
| Mikrofon tidak bisa diakses | Halaman bukan HTTPS atau izin ditolak | Gunakan HTTPS dan izinkan mikrofon di pengaturan situs |
| Respons pertama sangat lambat | Backend gratis sedang tidur | Panggil `/health` untuk membangunkan sebelum mulai |
| Alarm tidak berbunyi | Browser memblokir audio otomatis | Pastikan audio diaktifkan lewat klik Mulai Pemantauan |
