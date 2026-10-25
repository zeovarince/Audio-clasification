/**
 * Pemanggilan API backend /predict dan /health.
 */

import { API_URL, SAMPLE_RATE } from "./config";

export interface PredictResponse {
  noise_probability: number;
  label: string;
  processing_ms: number;
}

export interface HealthResponse {
  status: string;
  model_loaded: boolean;
  sklearn_version: string;
  sample_rate?: number;
  classes?: number[];
}

/**
 * Mengirim potongan audio PCM Int16 ke backend untuk klasifikasi.
 */
export async function predict(
  int16Buffer: ArrayBuffer
): Promise<PredictResponse> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);

  try {
    const response = await fetch(`${API_URL}/predict`, {
      method: "POST",
      headers: {
        "Content-Type": "application/octet-stream",
        "X-Sample-Rate": String(SAMPLE_RATE),
      },
      body: int16Buffer,
      signal: controller.signal,
    });

    if (!response.ok) {
      const detail = await response.text().catch(() => "Unknown error");
      throw new Error(`Backend error ${response.status}: ${detail}`);
    }

    return response.json();
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Memeriksa kesehatan dan kesiapan backend.
 */
export async function healthCheck(): Promise<HealthResponse> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);

  try {
    const response = await fetch(`${API_URL}/health`, {
      signal: controller.signal,
    });
    if (!response.ok) {
      throw new Error(`Health check failed: ${response.status}`);
    }
    return response.json();
  } finally {
    clearTimeout(timeout);
  }
}
