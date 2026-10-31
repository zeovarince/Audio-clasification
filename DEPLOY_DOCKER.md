# Docker dan deploy otomatis ke server lab

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

## Menyiapkan server lab sekali saja

Workflow GitHub Actions menggunakan SSH dari runner GitHub ke server lab. Server harus dapat dijangkau melalui SSH dari GitHub Actions, dan user SSH harus dapat menjalankan `git` serta `docker compose` tanpa prompt interaktif.

1. Pasang Git, Docker Engine, dan Docker Compose v2. Pastikan `docker compose version` berhasil.
2. Clone repository ke direktori tetap yang akan dipakai untuk deployment, misalnya `/srv/silentguard`:

   ```bash
   sudo mkdir -p /srv/silentguard
   sudo chown "$USER":"$USER" /srv/silentguard
   git clone https://github.com/zeovarince/Audio-clasification.git /srv/silentguard
   ```

   Jika repository private, siapkan autentikasi Git di server terlebih dahulu. Workflow menjalankan `git pull --ff-only origin main` di direktori ini; pastikan branch aktif adalah `main` dan working tree bersih.
3. Pastikan user SSH masuk ke grup Docker (Ubuntu):

   ```bash
   sudo usermod -aG docker "$USER"
   ```

   Keluar lalu masuk kembali agar keanggotaan grup berlaku.
4. Tambahkan secrets pada **GitHub repository → Settings → Secrets and variables → Actions → New repository secret**:

   | Secret | Isi |
   |---|---|
   | `SERVER_HOST` | IP atau hostname server yang bisa dijangkau dari GitHub Actions |
   | `SERVER_USER` | User SSH untuk deploy |
   | `SERVER_PATH` | Path clone, misalnya `/srv/silentguard` |
   | `SERVER_SSH_KEY` | Private SSH key untuk user deploy (disarankan) |
   | `SERVER_PASSWORD` | Password SSH, isi hanya jika tidak memakai key |
   | `SERVER_PORT` | Port SSH; opsional, default `22` |
| `SERVER_HOST_FINGERPRINT` | Fingerprint kunci host SSH server untuk verifikasi |

   Simpan private key sebagai secret, jangan commit ke repository. Ambil fingerprint host dari server tepercaya dan simpan sebagai secret untuk mencegah koneksi ke host yang salah. Server harus mengizinkan koneksi SSH masuk dari runner GitHub. Jika server hanya dapat diakses dari jaringan privat kampus, workflow `ubuntu-latest` ini tidak dapat menjangkaunya; gunakan self-hosted runner di jaringan server atau siapkan jalur SSH yang dapat dijangkau.
5. Jalankan deployment pertama dari server:

   ```bash
   cd /srv/silentguard
   docker compose up --build --detach
   docker compose ps
   ```

   Pastikan service `backend` dan `frontend` berstatus sehat sebelum mengandalkan workflow.

## Deploy setelah push

Setiap push ke branch `main` memicu `.github/workflows/deploy.yml`. Workflow masuk melalui SSH, menjalankan `git pull --ff-only origin main`, membangun dan memperbarui container dengan `docker compose up --build --detach`, lalu menunggu pemeriksaan kesehatan backend dan frontend. Workflow gagal dan menampilkan log container jika keduanya tidak sehat.

Setelah workflow sukses, dashboard tersedia di `http://<IP-server-lab>:8007`. API dapat diperiksa melalui `http://<IP-server-lab>:8007/api/health`; endpoint FastAPI tidak dipublikasikan sebagai port host tersendiri.

Browser mensyaratkan HTTPS atau `localhost` untuk akses mikrofon. Untuk penggunaan dari komputer lain, pasang reverse proxy HTTPS (misalnya Caddy atau Nginx) di depan port `8007` dan gunakan nama domain lab.
