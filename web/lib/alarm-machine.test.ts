import test from "node:test";
import assert from "node:assert/strict";
import { createAlarmMachine, type AlarmSound } from "./alarm-machine.ts";

const defaultConfig = {
  threshold1: 60,
  threshold2: 80,
  calmHoldMs: 3000,
  jumpToAlarm2: true,
  confirmDelayMs: 5000,
  repeatIntervalMs: 10000, // 10 detik ulang jika masih ramai
};

/** Helper: Jalankan skor dengan jeda antar step (default 1000ms). */
function runSequence(scores: number[], stepMs = 1000, config = defaultConfig) {
  const machine = createAlarmMachine(config);
  let time = 1000;
  const alarmsPlayed: { score: number; alarm: AlarmSound; time: number }[] = [];

  for (const score of scores) {
    const step = machine.step(score, time);
    if (step.play) {
      alarmsPlayed.push({ score, alarm: step.play, time });
    }
    time += stepMs;
  }

  return alarmsPlayed;
}

test("Skenario 1: 20, 30, 40, 35 -> tidak ada alarm", () => {
  const alarms = runSequence([20, 30, 40, 35]);
  assert.equal(alarms.length, 0);
});

test("Skenario 2: skor di atas 60% selama < 5 detik -> TIDAK ada alarm (konfirmasi belum cukup)", () => {
  // 4 step × 1 detik = 3 detik total delay (pertama langsung, +1s, +2s, +3s) -> belum 5 detik
  const alarms = runSequence([62, 65, 63, 64]);
  assert.equal(alarms.length, 0);
});

test("Skenario 3: skor di atas 60% selama >= 5 detik -> alarm 1 berbunyi", () => {
  // 6 step × 1 detik = step ke-6 berada di 5000ms setelah step pertama
  const alarms = runSequence([62, 65, 63, 64, 66, 68]);
  assert.equal(alarms.length, 1);
  assert.equal(alarms[0].alarm, "alarm1");
});

test("Skenario 4: skor sempat turun di bawah 60 sebelum 5 detik -> tidak jadi alarm", () => {
  // Naik, lalu turun di bawah threshold, lalu naik lagi: timer harus reset
  const alarms = runSequence([62, 65, 50, 62, 65, 66]);
  assert.equal(alarms.length, 0); // Timer reset ketika turun, belum 5 detik lagi
});

test("Skenario 5: skor >= 80% selama >= 5 detik dari AMAN -> alarm 2 langsung (JUMP)", () => {
  // 6 steps, skor >= 80 selama 5 detik
  const alarms = runSequence([85, 87, 82, 84, 86, 88]);
  assert.equal(alarms.length, 1);
  assert.equal(alarms[0].alarm, "alarm2");
});

test("Skenario 6: skor >= 80% tapi turun sebelum 5 detik -> tidak jadi alarm 2", () => {
  // 3 step di atas 80, lalu turun
  const alarms = runSequence([85, 87, 82, 50, 30, 20]);
  assert.equal(alarms.length, 0);
});

test("Skenario 7: alarm 1 lalu eskalasi ke alarm 2 (masing-masing butuh konfirmasi)", () => {
  // 6 step di atas 60 → alarm1 di step 6
  // Lalu 6 step di atas 80 → alarm2 di step 12
  const scores = [62, 65, 63, 64, 66, 68, 85, 87, 82, 84, 86, 88];
  const alarms = runSequence(scores);
  assert.equal(alarms.length, 2);
  assert.equal(alarms[0].alarm, "alarm1");
  assert.equal(alarms[1].alarm, "alarm2");
});

test("Skenario 8: alarm 2 lalu tenang, lalu alarm 1 lagi", () => {
  // 6 step >= 80 → alarm2
  // 4 step < 60 → tenang (calmHold = 3s)
  // 6 step >= 60 → alarm1
  const scores = [85, 87, 82, 84, 86, 88, 30, 30, 30, 30, 62, 64, 66, 63, 65, 67];
  const alarms = runSequence(scores);
  assert.equal(alarms.length, 2);
  assert.equal(alarms[0].alarm, "alarm2");
  assert.equal(alarms[1].alarm, "alarm1");
});

test("Skenario 9: confirmDelay = 0 -> alarm langsung (backward compat)", () => {
  const instantConfig = { ...defaultConfig, confirmDelayMs: 0 };
  const machine = createAlarmMachine(instantConfig);
  const step1 = machine.step(62, 1000);
  assert.equal(step1.play, "alarm1");
});

test("Skenario 10: Pengulangan alarm jika tetap ramai (repeatIntervalMs = 10s)", () => {
  // 6 step (0..5s) -> alarm1 bunyi di detik 5
  // Lalu tetap ramai selama 10 detik lagi (step 6..15) -> alarm1 bunyi ulang di detik 15!
  const scores = [
    62, 65, 63, 64, 66, 68, // detik 0-5 (step 6: alarm1 bunyi)
    67, 65, 66, 68, 64, 63, 65, 66, 67, 68, // detik 6-15 (10 detik berlalu)
  ];
  const alarms = runSequence(scores);
  assert.equal(alarms.length, 2);
  assert.equal(alarms[0].alarm, "alarm1");
  assert.equal(alarms[1].alarm, "alarm1");
});

test("Skenario 11: Pengulangan alarm di 80%+ jika tetap ramai", () => {
  // 6 step >= 80 -> alarm2 di detik 5
  // Lalu 10 step >= 80 -> alarm2 bunyi ulang di detik 15
  const scores = [
    85, 84, 86, 87, 85, 88, // detik 0-5
    85, 86, 84, 88, 85, 86, 87, 85, 86, 88, // detik 6-15
  ];
  const alarms = runSequence(scores);
  assert.equal(alarms.length, 2);
  assert.equal(alarms[0].alarm, "alarm2");
  assert.equal(alarms[1].alarm, "alarm2");
});
