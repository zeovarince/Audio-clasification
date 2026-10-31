/**
 * Konfigurasi SilentGuard Lab.
 * Nilai berasal dari MODEL_SPEC.md dan ALARM_LOGIC.md.
 */

/** URL backend FastAPI */
export const API_URL =
  (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000").replace(
    /\/+$/,
    ""
  );

/** Sample rate model (Hz) */
export const SAMPLE_RATE = 22050;

/** Panjang potongan audio yang dikirim ke backend (detik) */
export const WINDOW_SECONDS = 5.0;

/** Jeda antar pengiriman potongan audio (detik) */
export const HOP_SECONDS = 1.0;

/** Ambang alarm 1 (persen) */
export const DEFAULT_THRESHOLD_1 = 60;

/** Ambang alarm 2 (persen) */
export const DEFAULT_THRESHOLD_2 = 80;

/** Durasi skor harus di bawah THRESHOLD_1 sebelum kembali tenang (detik) */
export const DEFAULT_CALM_HOLD_SECONDS = 3;

/** Durasi konfirmasi: skor harus tetap di atas threshold selama X detik
 *  sebelum alarm benar-benar berbunyi (detik) */
export const DEFAULT_CONFIRM_DELAY_SECONDS = 5;

/** Jeda pengulangan alarm: jika ruangan masih terus ramai,
 *  alarm akan berbunyi lagi setiap X detik */
export const DEFAULT_ALARM_REPEAT_SECONDS = 10;

/** Jika true, lonjakan langsung >= THRESHOLD_2 dari AMAN langsung memicu alarm 2 */
export const JUMP_TO_ALARM_2 = true;

/** Jumlah hasil prediksi terakhir yang dirata-ratakan */
export const SMOOTHING_WINDOW = 3;

/** Sensitivitas / penguatan gain mikrofon default (pengali) */
export const DEFAULT_MIC_GAIN = 1.0;
