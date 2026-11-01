"use client";

import { useEffect, useRef, useState } from "react";

interface AcousticSpectrumProps {
  analyser: AnalyserNode | null;
  isActive: boolean;
}

const BAR_COUNT = 24;

export default function AcousticSpectrum({ analyser, isActive }: AcousticSpectrumProps) {
  const [levels, setLevels] = useState<number[]>(() => Array(BAR_COUNT).fill(0.06));

  useEffect(() => {
    if (!analyser || !isActive) {
      setLevels(Array(BAR_COUNT).fill(0.06));
      return;
    }

    const values = new Uint8Array(analyser.frequencyBinCount);
    let frame = 0;
    let lastUpdate = 0;

    const update = (time: number) => {
      frame = requestAnimationFrame(update);
      if (time - lastUpdate < 70) return;
      lastUpdate = time;
      analyser.getByteFrequencyData(values);

      const nyquist = analyser.context.sampleRate / 2;
      const minHz = 70;
      const maxHz = Math.min(8000, nyquist);
      const next = Array.from({ length: BAR_COUNT }, (_, index) => {
        const startHz = minHz * (maxHz / minHz) ** (index / BAR_COUNT);
        const endHz = minHz * (maxHz / minHz) ** ((index + 1) / BAR_COUNT);
        const startBin = Math.max(1, Math.floor((startHz / nyquist) * values.length));
        const endBin = Math.max(startBin + 1, Math.ceil((endHz / nyquist) * values.length));
        let total = 0;
        for (let bin = startBin; bin < Math.min(endBin, values.length); bin++) total += values[bin];
        const average = total / Math.max(1, Math.min(endBin, values.length) - startBin);
        return Math.max(0.06, Math.min(1, average / 210));
      });
      setLevels(next);
    };

    frame = requestAnimationFrame(update);
    return () => cancelAnimationFrame(frame);
  }, [analyser, isActive]);

  return (
    <section className="spectrum-card" aria-label="Spektrum akustik live">
      <div className="spectrum-heading">
        <h2>Spektrum Akustik</h2>
        <span aria-hidden="true">↗</span>
      </div>
      <div className="spectrum-scale" aria-hidden="true">
        <span>Frekuensi rendah</span><span>Frekuensi tinggi</span>
      </div>
      <div
        className="spectrum-bars"
        role="img"
        aria-label={isActive ? "Spektrum frekuensi audio mikrofon yang diperbarui langsung" : "Spektrum menunggu mikrofon aktif"}
      >
        {levels.map((level, index) => (
          <span
            className={index < 13 ? "spectrum-bar spectrum-bar-low" : "spectrum-bar spectrum-bar-high"}
            key={index}
            style={{ height: `${Math.round(8 + level * 54)}px`, opacity: 0.45 + level * 0.55 }}
          />
        ))}
      </div>
      <div className="spectrum-frequency-labels" aria-hidden="true">
        <span>70 Hz</span><span>{Math.min(8000, Math.round((analyser?.context.sampleRate ?? 22050) / 2))} Hz</span>
      </div>
      <p className="spectrum-legend"><span /> Rendah (bass) <span className="legend-high" /> Tinggi (treble)</p>
    </section>
  );
}
