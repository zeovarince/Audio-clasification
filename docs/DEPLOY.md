# Deploy SilentGuard Lab

Deployment aktif proyek ini menggunakan Docker Compose pada server lab, bukan Vercel.

Ikuti panduan [DEPLOY_DOCKER.md](../DEPLOY_DOCKER.md) untuk menjalankan frontend dan backend pada port 8007 serta menyiapkan deploy otomatis lewat GitHub Actions dan SSH.

Spesifikasi model dan endpoint health tersedia di [MODEL_SPEC.md](MODEL_SPEC.md). Akses mikrofon dari perangkat selain `localhost` memerlukan HTTPS.
