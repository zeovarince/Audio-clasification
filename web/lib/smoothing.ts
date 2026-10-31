/**
 * Rata-rata bergerak sederhana untuk menghaluskan skor keramaian.
 * Sesuai ALARM_LOGIC.md bagian 3.
 */

export function createSmoother(windowSize: number) {
  const buffer: number[] = [];
  let currentDisplayScore = 0;

  function push(value: number): number {
    buffer.push(value);
    if (buffer.length > windowSize) {
      buffer.shift();
    }
    const sum = buffer.reduce((a, b) => a + b, 0);
    const targetScore = Math.round((sum / buffer.length) * 100);

    // Fast attack (langsung naik jika kebisingan meningkat)
    // Smooth release (turun secara luwes dan halus, maks -12% per detik)
    if (targetScore >= currentDisplayScore) {
      currentDisplayScore = targetScore;
    } else {
      currentDisplayScore = Math.max(targetScore, currentDisplayScore - 12);
    }

    return currentDisplayScore;
  }

  function reset() {
    buffer.length = 0;
    currentDisplayScore = 0;
  }

  function getScore(): number {
    return currentDisplayScore;
  }

  return { push, reset, getScore };
}
