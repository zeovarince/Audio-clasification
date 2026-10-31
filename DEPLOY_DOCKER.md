# Docker dan deploy manual ke server lab

## Menjalankan aplikasi

Pastikan Docker Engine dan Docker Compose v2 tersedia, lalu jalankan dari root repository:

```bash
docker compose up --build
```

Buka `http://localhost:8007`. Untuk menghentikan, tekan `Ctrl+C`; jika Compose berjalan di latar belakang, gunakan `docker compose down`.

Compose membangun dua image dari Dockerfile root. Dashboard Next.js menerima trafik pada port `8007`, lalu meneruskan `/api/health` dan `/api/predict` ke backend FastAPI pada jaringan internal Docker. Backend tidak membuka port langsung ke host.

Perintah operasional:

```bash
docker compose up --build --detach
docker compose ps
docker compose logs -f
docker compose down
```

## Deploy manual ke server lab

Auto-deploy belum dikonfigurasi. Setelah push ke GitHub, jalankan langkah berikut secara manual di server lab. Langkah ini memerlukan akses ke server; hubungi pengelola lab jika kamu tidak memilikinya.

Pastikan Git, Docker Engine, dan Docker Compose v2 tersedia di server:

```bash
git --version
docker compose version
```

Clone repository satu kali jika belum ada:

```bash
git clone https://github.com/zeovarince/Audio-clasification.git
cd Audio-clasification
```

Untuk memperbarui aplikasi setelah perubahan di-push ke GitHub, masuk ke folder repository di server lalu jalankan:

```bash
git pull --ff-only origin main
docker compose up --build --detach --remove-orphans
docker compose ps
```

Untuk melihat log atau menghentikan aplikasi:

```bash
docker compose logs -f
docker compose down
```

Dashboard tersedia di `http://<IP-server-lab>:8007`. API dapat diperiksa melalui `http://<IP-server-lab>:8007/api/health`; endpoint FastAPI tidak dipublikasikan sebagai port host tersendiri.

Browser mensyaratkan HTTPS atau `localhost` untuk akses mikrofon. Untuk penggunaan dari komputer lain, pasang reverse proxy HTTPS (misalnya Caddy atau Nginx) di depan port `8007` dan gunakan nama domain lab.
