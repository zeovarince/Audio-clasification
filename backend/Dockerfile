FROM python:3.10-slim

# Build dari root repository: docker build -f backend/Dockerfile .

# Install system dependencies for audio decoding
RUN apt-get update && apt-get install -y --no-install-recommends \
    libsndfile1 \
    ffmpeg \
    && rm -rf /var/lib/apt/lists/*

# Non-root user for security (Hugging Face / Render / Railway compliant)
RUN useradd -m -u 1000 user
USER user
ENV PATH="/home/user/.local/bin:$PATH"
WORKDIR /app

# Install Python requirements
COPY --chown=user backend/requirements.txt ./requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

# Copy backend source and the sole active model artifact.
COPY --chown=user backend/main.py backend/inference.py backend/features.py ./
COPY --chown=user backend/models/modelaudiov5.joblib ./models/modelaudiov5.joblib

ENV PORT=8000 \
    MODEL_DIR=/app/models
EXPOSE 8000

# Support dynamic port binding ($PORT)
CMD ["sh", "-c", "uvicorn main:app --host 0.0.0.0 --port ${PORT:-8000}"]
