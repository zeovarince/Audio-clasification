/**
 * Pemutar audio alarm.
 * Alarm 2 boleh memotong alarm 1, tetapi alarm 1 tidak pernah memotong alarm 2.
 */

export type AlarmType = "alarm1" | "alarm2";

export function createAlarmPlayer() {
  let audio1: HTMLAudioElement | null = null;
  let audio2: HTMLAudioElement | null = null;
  let currentPlaying: AlarmType | null = null;

  function init() {
    if (typeof window === "undefined") return;
    audio1 = new Audio("/alarms/alarm-60.mp3");
    audio2 = new Audio("/alarms/alarm-80.mp3");
    audio1.preload = "auto";
    audio2.preload = "auto";

    audio1.addEventListener("ended", () => {
      if (currentPlaying === "alarm1") currentPlaying = null;
    });
    audio2.addEventListener("ended", () => {
      if (currentPlaying === "alarm2") currentPlaying = null;
    });
  }

  function play(type: AlarmType) {
    if (!audio1 || !audio2) init();
    if (!audio1 || !audio2) return;

    // Alarm 2 boleh memotong alarm 1
    if (type === "alarm2") {
      if (currentPlaying === "alarm1") {
        audio1.pause();
        audio1.currentTime = 0;
      }
      audio2.currentTime = 0;
      audio2.play().catch(() => {});
      currentPlaying = "alarm2";
    } else if (type === "alarm1") {
      // Alarm 1 tidak pernah memotong alarm 2
      if (currentPlaying === "alarm2") return;
      audio1.currentTime = 0;
      audio1.play().catch(() => {});
      currentPlaying = "alarm1";
    }
  }

  function stop() {
    if (audio1) {
      audio1.pause();
      audio1.currentTime = 0;
    }
    if (audio2) {
      audio2.pause();
      audio2.currentTime = 0;
    }
    currentPlaying = null;
  }

  /** Tes alarm: putar alarm 1 lalu alarm 2 secara berurutan */
  async function testAlarms() {
    if (!audio1 || !audio2) init();
    if (!audio1 || !audio2) return;

    // Putar alarm 1
    audio1.currentTime = 0;
    await audio1.play().catch(() => {});
    await new Promise<void>((resolve) => {
      const onEnd = () => {
        audio1!.removeEventListener("ended", onEnd);
        resolve();
      };
      audio1!.addEventListener("ended", onEnd);
    });

    // Jeda singkat
    await new Promise((r) => setTimeout(r, 500));

    // Putar alarm 2
    audio2.currentTime = 0;
    await audio2.play().catch(() => {});
    await new Promise<void>((resolve) => {
      const onEnd = () => {
        audio2!.removeEventListener("ended", onEnd);
        resolve();
      };
      audio2!.addEventListener("ended", onEnd);
    });
  }

  return { init, play, stop, testAlarms };
}
