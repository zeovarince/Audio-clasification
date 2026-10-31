"use client";

import type { AlarmState } from "@/lib/alarm-machine";

interface StatusPillProps {
  alarmState: AlarmState;
  isActive: boolean;
}

export default function StatusPill({ alarmState, isActive }: StatusPillProps) {
  const key = !isActive ? "idle" : alarmState;

  let label = "Live • Lab Tenang";
  let color = "var(--color-frost-glow)";
  let bg = "rgba(38, 150, 132, 0.12)";
  let dotColor = "var(--color-status-safe)";
  let icon = (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 6L9 17l-5-5" />
    </svg>
  );

  if (key === "idle") {
    label = "Menghubungkan Sensor...";
    color = "var(--color-moon-mist)";
    bg = "rgba(186, 215, 247, 0.08)";
    dotColor = "var(--color-blueprint-blue)";
    icon = (
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" />
        <polyline points="12 6 12 12 16 14" />
      </svg>
    );
  } else if (key === "MENUNGGU_1") {
    label = "Mengkonfirmasi (60%)...";
    color = "var(--color-ember-glow)";
    bg = "rgba(228, 176, 76, 0.12)";
    dotColor = "var(--color-ember-glow)";
    icon = (
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" />
        <polyline points="12 6 12 12 16 14" />
      </svg>
    );
  } else if (key === "MENUNGGU_2") {
    label = "Mengkonfirmasi (80%)...";
    color = "#ff8260";
    bg = "rgba(228, 109, 76, 0.15)";
    dotColor = "var(--color-status-alert)";
    icon = (
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" />
        <polyline points="12 6 12 12 16 14" />
      </svg>
    );
  } else if (key === "PERINGATAN_1") {
    label = "Mulai Ramai (60%)";
    color = "var(--color-ember-glow)";
    bg = "rgba(228, 109, 76, 0.12)";
    dotColor = "var(--color-ember-glow)";
    icon = (
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
        <line x1="12" y1="9" x2="12" y2="13" />
        <line x1="12" y1="17" x2="12.01" y2="17" />
      </svg>
    );
  } else if (key === "PERINGATAN_2") {
    label = "Terlalu Berisik (80%)";
    color = "#ff8260";
    bg = "rgba(228, 109, 76, 0.2)";
    dotColor = "var(--color-status-alert)";
    icon = (
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" />
        <line x1="12" y1="8" x2="12" y2="12" />
        <line x1="12" y1="16" x2="12.01" y2="16" />
      </svg>
    );
  }

  return (
    <div
      className="badge"
      style={{
        background: bg,
        color: color,
        border: "1px solid var(--color-glass-edge)",
        transition: "all 300ms ease",
        display: "inline-flex",
        alignItems: "center",
        gap: "8px",
        padding: "6px 14px",
        borderRadius: "var(--radius-full)",
      }}
    >
      <span style={{ display: "flex", alignItems: "center" }}>{icon}</span>
      <span style={{ fontWeight: 500, fontSize: "13px" }}>{label}</span>
      <span
        className={key === "AMAN" ? "live-pulse" : "dot-pulse"}
        style={{
          background: dotColor,
          width: "7px",
          height: "7px",
          borderRadius: "50%",
          display: "inline-block",
        }}
      />
    </div>
  );
}
