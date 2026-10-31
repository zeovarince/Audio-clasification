"""Server API FastAPI untuk SilentGuard Lab."""

import os
import time
from contextlib import asynccontextmanager
from typing import List
import numpy as np
from fastapi import FastAPI, Header, HTTPException, Request, Response, status
from fastapi.middleware.cors import CORSMiddleware

import inference

# Konfigurasi CORS dari environment variable
_env_origins = os.environ.get("ALLOWED_ORIGINS", "*")
ALLOWED_ORIGINS: List[str] = [origin.strip() for origin in _env_origins.split(",") if origin.strip()]


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Memuat model ke memori sebelum menerima request pertama."""
    try:
        inference.load_model()
        print("[SilentGuard Lab] Model klasifikasi berhasil dimuat ke memori.")
    except Exception as exc:
        print(f"[SilentGuard Lab] Peringatan: Gagal memuat model saat startup: {exc}")
    yield


app = FastAPI(
    title="SilentGuard Lab API",
    description="Sistem inferensi deteksi kebisingan audio lab berbasis browser.",
    version="0.1.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
def root():
    """Endpoint utama API SilentGuard Lab."""
    return {
        "service": "SilentGuard Lab API",
        "status": "online",
        "port": int(os.environ.get("PORT", 8007)),
        "docs": "/docs",
        "health": "/health",
    }


@app.get("/health")
def health():
    """Endpoint pemeriksaan kesehatan dan kesiapan model."""
    info = inference.get_model_info()
    if not info["model_loaded"]:
        try:
            inference.load_model()
            info = inference.get_model_info()
        except Exception as exc:
            return {
                "status": "error",
                "model_loaded": False,
                "error": str(exc),
                "sklearn_version": info["sklearn_version"],
            }

    return {
        "status": "ok",
        "model_loaded": info["model_loaded"],
        "sklearn_version": info["sklearn_version"],
        "sample_rate": info["sample_rate"],
        "classes": info["classes"],
    }


@app.post("/predict")
async def predict(
    request: Request,
    content_type: str = Header(None, alias="Content-Type"),
    x_sample_rate: str = Header(None, alias="X-Sample-Rate"),
):
    """Mengklasifikasikan potongan audio PCM mono Int16 menjadi probabilitas suara berisik.

    Kontrak API:
    - Header Content-Type: application/octet-stream
    - Header X-Sample-Rate: 22050
    - Body: Byte stream Int16 little-endian PCM
    """
    start_time = time.perf_counter()

    # 1. Validasi header Content-Type
    if not content_type or "application/octet-stream" not in content_type:
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail="Header Content-Type harus berupa application/octet-stream.",
        )

    # 2. Validasi sample rate
    expected_sr = inference.get_model_info()["sample_rate"]
    if not x_sample_rate:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Header X-Sample-Rate wajib disertakan (diharapkan: {expected_sr}).",
        )

    try:
        sr_val = int(x_sample_rate.strip())
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Header X-Sample-Rate harus berupa bilangan bulat (diterima: {x_sample_rate}).",
        )

    if sr_val != expected_sr:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Sample rate {sr_val} tidak sesuai dengan model ({expected_sr} Hz).",
        )

    # 3. Baca body byte stream
    body_bytes = await request.body()
    if not body_bytes:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Body audio kosong.",
        )

    # Panjang sampel Int16 harus genap (2 byte per sampel)
    if len(body_bytes) % 2 != 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Panjang byte stream audio tidak valid untuk format Int16 (harus kelipatan 2).",
        )

    # Minimal durasi audio 0.5 detik untuk ekstraksi STFT yang stabil
    min_bytes = int(sr_val * 0.5 * 2)
    if len(body_bytes) < min_bytes:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Durasi audio terlalu pendek (minimal {min_bytes} byte / 0.5 detik).",
        )

    # 4. Konversi Int16 PCM little-endian ke float32 [-1.0, 1.0]
    int16_samples = np.frombuffer(body_bytes, dtype=np.int16)
    float32_samples = int16_samples.astype(np.float32) / 32768.0

    # 5. Jalankan inferensi (audio tidak pernah disimpan ke disk atau dicatat ke log)
    try:
        noise_prob, label = inference.predict_noise_probability(float32_samples, sample_rate=sr_val)
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Kegagalan inferensi model: {exc}",
        )

    elapsed_ms = int((time.perf_counter() - start_time) * 1000)

    return {
        "noise_probability": round(noise_prob, 4),
        "label": label,
        "processing_ms": elapsed_ms,
    }
