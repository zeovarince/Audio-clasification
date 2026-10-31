/**
 * Pemanggilan API backend /predict dan /health.
 */

import { API_URL, SAMPLE_RATE } from "./config";

export type ApiErrorKind = "network" | "timeout" | "http";

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly kind: ApiErrorKind,
    public readonly status?: number
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export interface PredictResponse {
  noise_probability: number;
  label: string;
  processing_ms: number;
}

export interface HealthResponse {
  status: string;
  model_loaded: boolean;
  model_version?: string | null;
  feature_count?: number;
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
      throw new ApiError(
        `Backend error ${response.status}: ${detail}`,
        "http",
        response.status
      );
    }

    return response.json();
  } catch (error) {
    if (error instanceof ApiError) throw error;
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new ApiError(
        "Server klasifikasi tidak merespons dalam batas waktu.",
        "timeout"
      );
    }
    throw new ApiError(
      `Backend tidak dapat dijangkau di ${API_URL}. Pastikan server FastAPI sudah berjalan.`,
      "network"
    );
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
      throw new ApiError(
        `Health check failed: ${response.status}`,
        "http",
        response.status
      );
    }
    return response.json();
  } catch (error) {
    if (error instanceof ApiError) throw error;
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new ApiError(
        "Pemeriksaan koneksi melewati batas waktu.",
        "timeout"
      );
    }
    throw new ApiError(
      `Backend tidak dapat dijangkau di ${API_URL}. Pastikan server FastAPI sudah berjalan.`,
      "network"
    );
  } finally {
    clearTimeout(timeout);
  }
}
