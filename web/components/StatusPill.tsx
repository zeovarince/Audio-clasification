"use client";

import type { AlarmState } from "@/lib/alarm-machine";

interface StatusPillProps {
  alarmState: AlarmState;
  isActive: boolean;
}

const PILL_CONFIG = {
  idle: {
    label: "Tidak aktif",
    icon: "○",
    color: "var(--color-fog-veil)",
    bg: "rgba(199, 211, 234, 0.06)",
    dotColor: "",
  },
  AMAN: {
    label: "Aman",
    icon: "✓",
    color: "var(--color-status-safe)",
    bg: "rgba(38, 150, 132, 0.1)",
    dotColor: "var(--color-status-safe)",
  },
  PERINGATAN_1: {
    label: "Peringatan 1",
    icon: "⚠",
    color: "var(--color-status-warn)",
    bg: "rgba(228, 109, 76, 0.08)",
    dotColor: "var(--color-status-warn)",
  },
  PERINGATAN_2: {
    label: "Peringatan 2",
    icon: "❗",
    color: "var(--color-status-alert)",
    bg: "rgba(228, 109, 76, 0.12)",
    dotColor: "var(--color-status-alert)",
  },
};

export default function StatusPill({ alarmState, isActive }: StatusPillProps) {
  const key = !isActive ? "idle" : alarmState;
  const config = PILL_CONFIG[key];

  return (
    <div
      className="badge"
      style={{
        background: config.bg,
        color: config.color,
        transition: "all 300ms ease",
        gap: "8px",
        padding: "6px 14px",
      }}
    >
      <span style={{ fontSize: "12px" }}>{config.icon}</span>
      <span>{config.label}</span>
      {key === "PERINGATAN_2" && (
        <span className="dot-pulse" style={{ background: config.dotColor }} />
      )}
    </div>
  );
}
