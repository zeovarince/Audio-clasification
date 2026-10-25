"use client";

import { useRef, useEffect, useCallback } from "react";
import type { AlarmState } from "@/lib/alarm-machine";

interface WaveformProps {
  analyser: AnalyserNode | null;
  isActive: boolean;
  alarmState: AlarmState;
}

export default function Waveform({ analyser, isActive, alarmState }: WaveformProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animFrameRef = useRef<number>(0);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Sesuaikan ukuran canvas dengan display
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    const w = rect.width;
    const h = rect.height;
    const centerY = h / 2;

    // Bersihkan
    ctx.clearRect(0, 0, w, h);

    // Garis tengah (nol) — hairline Glass Edge
    ctx.beginPath();
    ctx.strokeStyle = "rgba(186, 215, 247, 0.12)";
    ctx.lineWidth = 1;
    ctx.moveTo(0, centerY);
    ctx.lineTo(w, centerY);
    ctx.stroke();

    if (!analyser || !isActive) {
      // Garis datar tipis
      ctx.beginPath();
      ctx.strokeStyle = "rgba(209, 228, 250, 0.3)";
      ctx.lineWidth = 2;
      ctx.moveTo(0, centerY);
      ctx.lineTo(w, centerY);
      ctx.stroke();
      return;
    }

    // Ambil data waveform
    const bufferLength = analyser.fftSize;
    const dataArray = new Uint8Array(bufferLength);
    analyser.getByteTimeDomainData(dataArray);

    // Gradien Skywash untuk garis
    const gradient = ctx.createLinearGradient(0, 0, 0, h);
    gradient.addColorStop(0, "#98c0ef");
    gradient.addColorStop(1, "#d8ecf8");

    // Shadow / glow berdasarkan status
    if (alarmState === "PERINGATAN_2") {
      ctx.shadowColor = "rgba(228, 109, 76, 0.6)";
      ctx.shadowBlur = 20;
    } else if (alarmState === "PERINGATAN_1") {
      ctx.shadowColor = "rgba(228, 109, 76, 0.35)";
      ctx.shadowBlur = 12;
    } else {
      ctx.shadowColor = "rgba(186, 207, 247, 0.2)";
      ctx.shadowBlur = 8;
    }

    ctx.beginPath();
    ctx.strokeStyle = gradient;
    ctx.lineWidth = 2;
    ctx.lineJoin = "round";
    ctx.lineCap = "round";

    const sliceWidth = w / bufferLength;
    let x = 0;

    for (let i = 0; i < bufferLength; i++) {
      const v = dataArray[i] / 128.0;
      const y = (v * h) / 2;

      if (i === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
      x += sliceWidth;
    }

    ctx.stroke();
    ctx.shadowBlur = 0;

    animFrameRef.current = requestAnimationFrame(draw);
  }, [analyser, isActive, alarmState]);

  useEffect(() => {
    animFrameRef.current = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(animFrameRef.current);
    };
  }, [draw]);

  return (
    <div className="glass-card" style={{ padding: 0, overflow: "hidden" }}>
      <canvas
        ref={canvasRef}
        style={{
          width: "100%",
          height: "200px",
          display: "block",
        }}
        aria-label="Visualisasi gelombang suara"
      />
      {!isActive && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "var(--color-fog-veil)",
            fontSize: "14px",
            pointerEvents: "none",
          }}
        >
          Menghubungkan mikrofon secara otomatis...
        </div>
      )}
    </div>
  );
}
