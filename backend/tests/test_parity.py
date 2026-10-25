"""Uji paritas model dan endpoint FastAPI untuk SilentGuard Lab."""

import json
from pathlib import Path
import pytest
import numpy as np
import librosa
from fastapi.testclient import TestClient

import sys
# Pastikan folder backend masuk ke sys.path
backend_dir = Path(__file__).resolve().parent.parent
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

import inference
from main import app

client = TestClient(app)
ROOT_DIR = backend_dir.parent


def test_health_endpoint():
    """Memastikan GET /health mengembalikan status ok dan model_loaded=True."""
    response = client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ok"
    assert data["model_loaded"] is True
    assert data["sample_rate"] == 22050


def test_golden_parity():
    """Uji paritas: memastikan hasil inferensi backend identik dengan golden reference (< 0.01)."""
    golden_path = Path(__file__).resolve().parent / "golden.json"
    assert golden_path.exists(), "File golden.json harus ada"

    with open(golden_path, "r", encoding="utf-8") as f:
        cases = json.load(f)

    sr = 22050
    for case in cases:
        file_path = ROOT_DIR / case["file"]
        if not file_path.exists():
            pytest.skip(f"File audio {file_path} tidak ditemukan di workspace.")

        y, _ = librosa.load(str(file_path), sr=sr, mono=True)
        # Ambil 5 detik pertama
        dur_samples = int(case.get("duration_sec", 5.0) * sr)
        clip = y[:dur_samples]

        noise_prob, label = inference.predict_noise_probability(clip, sample_rate=sr)

        expected_prob = case["expected_noise_probability"]
        diff = abs(noise_prob - expected_prob)
        assert diff < 0.01, f"Paritas gagal untuk {case['file']}: hasil={noise_prob}, target={expected_prob}, selisih={diff}"
        assert label == case["expected_label"], f"Label tidak cocok untuk {case['file']}"


def test_predict_endpoint_pcm_stream():
    """Memastikan POST /predict berhasil menerima Int16 PCM dan mengembalikan probabilitas."""
    sr = 22050
    duration_s = 5.0
    num_samples = int(sr * duration_s)

    # Buat sinyal audio sintesis sinus (suara nada)
    t = np.linspace(0, duration_s, num_samples, dtype=np.float32)
    sine_wave = 0.5 * np.sin(2 * np.pi * 440.0 * t)
    pcm_int16 = (sine_wave * 32767.0).astype(np.int16)
    pcm_bytes = pcm_int16.tobytes()

    response = client.post(
        "/predict",
        headers={
            "Content-Type": "application/octet-stream",
            "X-Sample-Rate": "22050",
        },
        content=pcm_bytes,
    )

    assert response.status_code == 200
    data = response.json()
    assert "noise_probability" in data
    assert "label" in data
    assert "processing_ms" in data
    assert 0.0 <= data["noise_probability"] <= 1.0
    assert data["label"] in ["berisik", "non-berisik"]


def test_predict_validation_errors():
    """Memastikan validasi header dan body error mengembalikan kode status yang tepat."""
    # 1. Content-Type salah -> 415
    res1 = client.post("/predict", headers={"Content-Type": "application/json"}, content=b"1234")
    assert res1.status_code == 415

    # 2. X-Sample-Rate salah -> 422
    res2 = client.post(
        "/predict",
        headers={"Content-Type": "application/octet-stream", "X-Sample-Rate": "44100"},
        content=b"1234" * 1000,
    )
    assert res2.status_code == 422

    # 3. Body kosong -> 400
    res3 = client.post(
        "/predict",
        headers={"Content-Type": "application/octet-stream", "X-Sample-Rate": "22050"},
        content=b"",
    )
    assert res3.status_code == 400

    # 4. Durasi terlalu pendek -> 400
    res4 = client.post(
        "/predict",
        headers={"Content-Type": "application/octet-stream", "X-Sample-Rate": "22050"},
        content=b"\x00\x00" * 10,
    )
    assert res4.status_code == 400
