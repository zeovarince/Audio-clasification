/**
 * Rata-rata bergerak sederhana untuk menghaluskan skor keramaian.
 * Sesuai ALARM_LOGIC.md bagian 3.
 */

export function createSmoother(windowSize: number) {
  const buffer: number[] = [];

  function push(value: number): number {
    buffer.push(value);
    if (buffer.length > windowSize) {
      buffer.shift();
    }
    const sum = buffer.reduce((a, b) => a + b, 0);
    return Math.round((sum / buffer.length) * 100);
  }

  function reset() {
    buffer.length = 0;
  }

  function getScore(): number {
    if (buffer.length === 0) return 0;
    const sum = buffer.reduce((a, b) => a + b, 0);
    return Math.round((sum / buffer.length) * 100);
  }

  return { push, reset, getScore };
}
