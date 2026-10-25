"use client";

import type { AlarmState } from "@/lib/alarm-machine";

interface StatusCardProps {
  alarmState: AlarmState;
  isActive: boolean;
}

const STATUS_CONFIG = {
  idle: {
    title: "Belum aktif",
    description: "Tekan Mulai Pemantauan untuk mulai.",
    icon: "⏸",
    colorClass: "",
    bgColor: "rgba(199, 211, 234, 0.06)",
  },
  AMAN: {
    title: "Lab tenang",
    description: "Suasana lab terkendali.",
    icon: "✓",
    colorClass: "status-safe",
    bgColor: "rgba(38, 150, 132, 0.1)",
  },
  PERINGATAN_1: {
    title: "Mulai ramai",
    description: "Alarm 60% sudah berbunyi.",
    icon: "⚠",
    colorClass: "status-warn",
    bgColor: "rgba(228, 109, 76, 0.08)",
  },
  PERINGATAN_2: {
    title: "Terlalu berisik",
    description: "Alarm 80% sudah berbunyi. Mohon kurangi suara.",
    icon: "❗",
    colorClass: "status-alert",
    bgColor: "rgba(228, 109, 76, 0.12)",
  },
};

export default function StatusCard({ alarmState, isActive }: StatusCardProps) {
  const key = !isActive ? "idle" : alarmState;
  const config = STATUS_CONFIG[key];
  const isPulsing = key === "PERINGATAN_2";

  return (
    <div
      className={`glass-card ${isPulsing ? "animate-pulse-slow" : ""}`}
      style={{
        flex: 1,
        background: config.bgColor,
        transition: "background 300ms ease",
      }}
      role="status"
      aria-live="polite"
    >
      <div className="eyebrow" style={{ marginBottom: "16px" }}>
        Status Lab
      </div>

      {/* Ikon */}
      <div
        style={{
          width: "56px",
          height: "56px",
          borderRadius: "9999px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: "24px",
          margin: "0 auto 16px",
          background: "rgba(199, 211, 234, 0.08)",
          boxShadow: "var(--shadow-border)",
        }}
      >
        {config.icon}
      </div>

      {/* Judul */}
      <h2
        className={config.colorClass}
        style={{
          fontFamily: "var(--font-display)",
          fontSize: "28px",
          fontWeight: 500,
          textAlign: "center",
          margin: "0 0 8px",
          lineHeight: 1.14,
          transition: "color 300ms ease",
        }}
      >
        {config.title}
      </h2>

      {/* Keterangan */}
      <p
        style={{
          textAlign: "center",
          fontSize: "14px",
          color: "var(--color-moon-mist)",
          margin: 0,
        }}
      >
        {config.description}
      </p>
    </div>
  );
}
