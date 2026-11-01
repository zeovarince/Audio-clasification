# syntax=docker/dockerfile:1

# FastAPI inference service.
FROM python:3.10-slim AS api

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PORT=8000 \
    MODEL_DIR=/app/models \
    NUMBA_CACHE_DIR=/tmp/numba_cache

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg \
    libsndfile1 \
    libgomp1 \
    && rm -rf /var/lib/apt/lists/* \
    && useradd --create-home --uid 10001 appuser

COPY requirements.txt ./requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

COPY --chown=appuser:appuser backend/main.py backend/inference.py backend/features.py ./
COPY --chown=appuser:appuser backend/models/MODEL_KLASIFIKASIV3-0.joblib ./models/MODEL_KLASIFIKASIV3-0.joblib
COPY --chown=appuser:appuser backend/models/MODEL_KLASIFIKASIV3-0.pkl ./models/MODEL_KLASIFIKASIV3-0.pkl

USER appuser
EXPOSE 8000
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]

# Build and serve the Next.js dashboard.
FROM node:22-alpine AS frontend-deps
WORKDIR /app
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci

FROM node:22-alpine AS frontend-builder
WORKDIR /app
ARG NEXT_PUBLIC_API_URL=/api
ARG API_INTERNAL_URL=http://backend:8000
ENV NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL} \
    API_INTERNAL_URL=${API_INTERNAL_URL} \
    NEXT_TELEMETRY_DISABLED=1
COPY --from=frontend-deps /app/node_modules ./node_modules
COPY frontend/ ./
RUN npm run build

FROM node:22-alpine AS web
WORKDIR /app
ENV NODE_ENV=production \
    HOSTNAME=0.0.0.0 \
    PORT=3000 \
    NEXT_TELEMETRY_DISABLED=1
COPY --from=frontend-builder /app/public ./public
COPY --from=frontend-builder /app/.next/standalone ./
COPY --from=frontend-builder /app/.next/static ./.next/static
EXPOSE 3000
CMD ["node", "server.js"]
