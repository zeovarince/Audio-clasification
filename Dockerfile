FROM python:3.10-slim

# Install system dependencies for audio decoding (libsndfile & ffmpeg)
RUN apt-get update && apt-get install -y --no-install-recommends \
    libsndfile1 \
    ffmpeg \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy backend source code, models, and assets
COPY backend/ /app/
COPY backend/models/ /app/models/
COPY alrm/ /app/alrm/
COPY alrm/ /app/audio_alarm/

# Create volume mount points
RUN mkdir -p /app/data /app/samples /app/audio_alarm

# Environment configurations
ENV PORT=8007
ENV LOG_LEVEL=INFO
ENV ALLOWED_ORIGINS=*

EXPOSE 8007

# Run FastAPI backend with uvicorn
CMD ["sh", "-c", "uvicorn main:app --host 0.0.0.0 --port ${PORT:-8007}"]
