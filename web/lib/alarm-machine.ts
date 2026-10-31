/**
 * State machine alarm sesuai ALARM_LOGIC.md.
 *
 * Fitur:
 * 1. Logika konfirmasi: ketika skor melewati threshold, alarm TIDAK
 *    langsung berbunyi. Sistem menunggu selama `confirmDelayMs`.
 * 2. Pengulangan alarm: jika ruangan masih terus ramai setelah alarm
 *    berbunyi (atau naik lagi sebelum status aman), sistem akan
 *    membunyikan alarm lagi setiap `repeatIntervalMs`.
 * 3. Tahan tenang: saat skor turun di bawah threshold 1, status menahan
 *    selama `calmHoldMs` sebelum resmi kembali AMAN.
 */

export type AlarmState =
  | "AMAN"
  | "MENUNGGU_1"
  | "PERINGATAN_1"
  | "MENUNGGU_2"
  | "PERINGATAN_2";

export type AlarmSound = "alarm1" | "alarm2" | null;

export interface AlarmConfig {
  threshold1: number;
  threshold2: number;
  calmHoldMs: number;
  jumpToAlarm2: boolean;
  /** Waktu konfirmasi sebelum alarm berbunyi (ms). */
  confirmDelayMs: number;
  /** Jeda waktu sebelum alarm diulang jika ruangan masih ramai (ms). Misal 10000ms. */
  repeatIntervalMs: number;
}

export interface AlarmStep {
  state: AlarmState;
  play: AlarmSound;
  calmRemainingSeconds?: number;
  /** Sisa waktu konfirmasi sebelum alarm berbunyi (detik) */
  confirmRemainingSeconds?: number;
  /** Sisa waktu sebelum alarm berbunyi ulang jika masih ramai (detik) */
  repeatRemainingSeconds?: number;
}

export function createAlarmMachine(config: AlarmConfig) {
  let state: AlarmState = "AMAN";
  let calmSince: number | null = null;
  /** Waktu pertama kali skor melewati threshold (untuk konfirmasi delay) */
  let confirmSince1: number | null = null;
  let confirmSince2: number | null = null;
  /** Waktu terakhir alarm dibunyikan (untuk pengulangan alarm) */
  let lastAlarmTime: number | null = null;

  function reset() {
    state = "AMAN";
    calmSince = null;
    confirmSince1 = null;
    confirmSince2 = null;
    lastAlarmTime = null;
  }

  function step(score: number, nowMs: number): AlarmStep {
    let calmRemainingSeconds: number | undefined = undefined;
    let confirmRemainingSeconds: number | undefined = undefined;
    let repeatRemainingSeconds: number | undefined = undefined;

    // ─── KASUS 1: Status saat ini PERINGATAN_1 atau PERINGATAN_2 (Alarm sudah pernah bunyi) ───
    if (state === "PERINGATAN_1" || state === "PERINGATAN_2") {
      if (score < config.threshold1) {
        // Suara turun di bawah threshold 1 -> mulai proses tenang (calm-down)
        confirmSince2 = null;
        if (calmSince === null) calmSince = nowMs;
        const elapsedMs = nowMs - calmSince;
        if (elapsedMs >= config.calmHoldMs) {
          state = "AMAN";
          calmSince = null;
          confirmSince1 = null;
          confirmSince2 = null;
          lastAlarmTime = null;
          return { state, play: null };
        } else {
          calmRemainingSeconds = Math.max(
            1,
            Math.ceil((config.calmHoldMs - elapsedMs) / 1000)
          );
          return { state, play: null, calmRemainingSeconds };
        }
      }

      // Skor masih di atas atau sama dengan threshold 1 -> reset calm timer
      calmSince = null;

      // Cek eskalasi dari PERINGATAN_1 ke PERINGATAN_2
      if (state === "PERINGATAN_1") {
        if (score >= config.threshold2) {
          if (confirmSince2 === null) confirmSince2 = nowMs;
          const elapsed = nowMs - confirmSince2;
          if (elapsed >= config.confirmDelayMs) {
            state = "PERINGATAN_2";
            confirmSince2 = null;
            lastAlarmTime = nowMs;
            return { state, play: "alarm2" };
          } else {
            confirmRemainingSeconds = Math.max(
              1,
              Math.ceil((config.confirmDelayMs - elapsed) / 1000)
            );
            return { state, play: null, confirmRemainingSeconds };
          }
        } else {
          confirmSince2 = null;
        }

        // Skor masih di rentang 60% - 79% (tetap ramai di level 1)
        // Cek apakah sudah waktunya alarm diulang
        if (config.repeatIntervalMs > 0 && lastAlarmTime !== null) {
          const elapsedSinceAlarm = nowMs - lastAlarmTime;
          if (elapsedSinceAlarm >= config.repeatIntervalMs) {
            lastAlarmTime = nowMs;
            return { state, play: "alarm1" };
          } else {
            repeatRemainingSeconds = Math.max(
              1,
              Math.ceil((config.repeatIntervalMs - elapsedSinceAlarm) / 1000)
            );
            return { state, play: null, repeatRemainingSeconds };
          }
        }

        return { state, play: null };
      }

      // State === PERINGATAN_2 (tetap ramai di level 2)
      if (state === "PERINGATAN_2") {
        // Cek apakah sudah waktunya alarm diulang
        if (config.repeatIntervalMs > 0 && lastAlarmTime !== null) {
          const elapsedSinceAlarm = nowMs - lastAlarmTime;
          if (elapsedSinceAlarm >= config.repeatIntervalMs) {
            lastAlarmTime = nowMs;
            const soundToPlay: AlarmSound =
              score >= config.threshold2 ? "alarm2" : "alarm1";
            return { state, play: soundToPlay };
          } else {
            repeatRemainingSeconds = Math.max(
              1,
              Math.ceil((config.repeatIntervalMs - elapsedSinceAlarm) / 1000)
            );
            return { state, play: null, repeatRemainingSeconds };
          }
        }

        return { state, play: null };
      }

      return { state, play: null };
    }

    // ─── KASUS 2: Status saat ini MENUNGGU_1 atau MENUNGGU_2 (Belum bunyi, sedang observasi) ───
    if (state === "MENUNGGU_1" || state === "MENUNGGU_2") {
      // Jika suara sudah reda di bawah threshold1, langsung batalkan tunggu dan kembali AMAN
      if (score < config.threshold1) {
        state = "AMAN";
        confirmSince1 = null;
        confirmSince2 = null;
        calmSince = null;
        lastAlarmTime = null;
        return { state, play: null };
      }

      // Jika skor mencapai threshold2
      if (score >= config.threshold2 && config.jumpToAlarm2) {
        if (confirmSince2 === null) confirmSince2 = nowMs;
        const elapsed = nowMs - confirmSince2;
        if (elapsed >= config.confirmDelayMs) {
          state = "PERINGATAN_2";
          confirmSince1 = null;
          confirmSince2 = null;
          lastAlarmTime = nowMs;
          return { state, play: "alarm2" };
        } else {
          state = "MENUNGGU_2";
          confirmRemainingSeconds = Math.max(
            1,
            Math.ceil((config.confirmDelayMs - elapsed) / 1000)
          );
          return { state, play: null, confirmRemainingSeconds };
        }
      }

      // Jika skor berada di antara threshold1 dan threshold2
      confirmSince2 = null; // reset timer alarm 2
      state = "MENUNGGU_1";
      if (confirmSince1 === null) confirmSince1 = nowMs;
      const elapsed = nowMs - confirmSince1;
      if (elapsed >= config.confirmDelayMs) {
        state = "PERINGATAN_1";
        confirmSince1 = null;
        lastAlarmTime = nowMs;
        return { state, play: "alarm1" };
      } else {
        confirmRemainingSeconds = Math.max(
          1,
          Math.ceil((config.confirmDelayMs - elapsed) / 1000)
        );
        return { state, play: null, confirmRemainingSeconds };
      }
    }

    // ─── KASUS 3: Status saat ini AMAN ───
    if (state === "AMAN") {
      if (score >= config.threshold2 && config.jumpToAlarm2) {
        confirmSince2 = nowMs;
        if (config.confirmDelayMs <= 0) {
          state = "PERINGATAN_2";
          confirmSince2 = null;
          lastAlarmTime = nowMs;
          return { state, play: "alarm2" };
        }
        state = "MENUNGGU_2";
        confirmRemainingSeconds = Math.max(
          1,
          Math.ceil(config.confirmDelayMs / 1000)
        );
        return { state, play: null, confirmRemainingSeconds };
      }

      if (score >= config.threshold1) {
        confirmSince1 = nowMs;
        if (config.confirmDelayMs <= 0) {
          state = "PERINGATAN_1";
          confirmSince1 = null;
          lastAlarmTime = nowMs;
          return { state, play: "alarm1" };
        }
        state = "MENUNGGU_1";
        confirmRemainingSeconds = Math.max(
          1,
          Math.ceil(config.confirmDelayMs / 1000)
        );
        return { state, play: null, confirmRemainingSeconds };
      }

      // Suara tetap aman
      confirmSince1 = null;
      confirmSince2 = null;
      lastAlarmTime = null;
      return { state, play: null };
    }

    return { state, play: null };
  }

  return { step, reset, getState: () => state };
}
