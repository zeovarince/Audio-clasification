# SilentGuard Lab frontend

Frontend Next.js untuk dashboard pemantauan suara. Saat dijalankan sendiri untuk development:

```bash
npm install
npm run dev
```

Pastikan backend FastAPI berjalan pada `http://localhost:8000`; atur `NEXT_PUBLIC_API_URL` di `.env.local` jika alamatnya berbeda.

Untuk menjalankan aplikasi lengkap, gunakan Docker Compose dari root repository. Panduan deploy manual ke server lab ada di [`../DEPLOY_DOCKER.md`](../DEPLOY_DOCKER.md).
