import test from "node:test";
import assert from "node:assert/strict";
import { createAlarmMachine, type AlarmSound } from "./alarm-machine.ts";

const defaultConfig = {
  threshold1: 60,
  threshold2: 80,
  calmHoldMs: 3000,
  jumpToAlarm2: true,
};

function runSequence(scores: number[], stepMs = 1000) {
  const machine = createAlarmMachine(defaultConfig);
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

test("Skenario 2: 20, 55, 62, 65, 70 -> alarm 1 satu kali (di 62)", () => {
  const alarms = runSequence([20, 55, 62, 65, 70]);
  assert.equal(alarms.length, 1);
  assert.equal(alarms[0].alarm, "alarm1");
  assert.equal(alarms[0].score, 62);
});

test("Skenario 3: 62, 70, 82 -> alarm 1 (di 62), lalu alarm 2 (di 82)", () => {
  const alarms = runSequence([62, 70, 82]);
  assert.equal(alarms.length, 2);
  assert.equal(alarms[0].alarm, "alarm1");
  assert.equal(alarms[0].score, 62);
  assert.equal(alarms[1].alarm, "alarm2");
  assert.equal(alarms[1].score, 82);
});

test("Skenario 4: 62, 70, 40, 40, 40, 40, 65 -> alarm 1 (di 62), lalu alarm 1 lagi (di 65)", () => {
  const alarms = runSequence([62, 70, 40, 40, 40, 40, 65]);
  assert.equal(alarms.length, 2);
  assert.equal(alarms[0].alarm, "alarm1");
  assert.equal(alarms[0].score, 62);
  assert.equal(alarms[1].alarm, "alarm1");
  assert.equal(alarms[1].score, 65);
});

test("Skenario 5: 20, 85 -> alarm 2 langsung (JUMP_TO_ALARM_2 = true)", () => {
  const alarms = runSequence([20, 85]);
  assert.equal(alarms.length, 1);
  assert.equal(alarms[0].alarm, "alarm2");
  assert.equal(alarms[0].score, 85);
});

test("Skenario 6: 62, 58, 63, 57, 64 -> alarm 1 satu kali (naik turun di sekitar 60, tidak sempat tenang 3 detik)", () => {
  const alarms = runSequence([62, 58, 63, 57, 64]);
  assert.equal(alarms.length, 1);
  assert.equal(alarms[0].alarm, "alarm1");
  assert.equal(alarms[0].score, 62);
});

test("Skenario 7: 62, 85, 72, 70, 71 -> alarm 1, alarm 2, lalu diam", () => {
  const alarms = runSequence([62, 85, 72, 70, 71]);
  assert.equal(alarms.length, 2);
  assert.equal(alarms[0].alarm, "alarm1");
  assert.equal(alarms[0].score, 62);
  assert.equal(alarms[1].alarm, "alarm2");
  assert.equal(alarms[1].score, 85);
});

test("Skenario 8: 85, 40, 40, 40, 40, 62 -> alarm 2, lalu alarm 1 di 62", () => {
  const alarms = runSequence([85, 40, 40, 40, 40, 62]);
  assert.equal(alarms.length, 2);
  assert.equal(alarms[0].alarm, "alarm2");
  assert.equal(alarms[0].score, 85);
  assert.equal(alarms[1].alarm, "alarm1");
  assert.equal(alarms[1].score, 62);
});
