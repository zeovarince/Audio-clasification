/**
 * State machine alarm sesuai ALARM_LOGIC.md.
 */

export type AlarmState = "AMAN" | "PERINGATAN_1" | "PERINGATAN_2";
export type AlarmSound = "alarm1" | "alarm2" | null;

export interface AlarmConfig {
  threshold1: number;
  threshold2: number;
  calmHoldMs: number;
  jumpToAlarm2: boolean;
}

export interface AlarmStep {
  state: AlarmState;
  play: AlarmSound;
}

export function createAlarmMachine(config: AlarmConfig) {
  let state: AlarmState = "AMAN";
  let calmSince: number | null = null;

  function reset() {
    state = "AMAN";
    calmSince = null;
  }

  function step(score: number, nowMs: number): AlarmStep {
    // 1. Cek apakah sistem sudah kembali tenang
    if (state !== "AMAN") {
      if (score < config.threshold1) {
        if (calmSince === null) calmSince = nowMs;
        if (nowMs - calmSince >= config.calmHoldMs) {
          state = "AMAN";
          calmSince = null;
        }
      } else {
        calmSince = null;
      }
    }

    // 2. Cek pemicu alarm
    if (state === "AMAN") {
      if (score >= config.threshold2 && config.jumpToAlarm2) {
        state = "PERINGATAN_2";
        return { state, play: "alarm2" };
      }
      if (score >= config.threshold1) {
        state = "PERINGATAN_1";
        return { state, play: "alarm1" };
      }
    } else if (state === "PERINGATAN_1" && score >= config.threshold2) {
      state = "PERINGATAN_2";
      return { state, play: "alarm2" };
    }

    return { state, play: null };
  }

  return { step, reset, getState: () => state };
}
