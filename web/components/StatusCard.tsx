"use client";

import type { AlarmState } from "@/lib/alarm-machine";

interface StatusCardProps {
  alarmState: AlarmState;
  isActive: boolean;
}

export default function StatusCard({ alarmState, isActive }: StatusCardProps) {
  const key = !isActive ? "idle" : alarmState;
  const isPulsing = key === "PERINGATAN_2";

  // Konfigurasi visual berdasar status lab
  let title = "Memantau...";
  let description = "Sensor audio aktif mendengarkan kondisi lab.";
  let colorClass = "status-safe";
  let bgColor = "rgba(186, 215, 247, 0.03)";
  let borderColor = "var(--color-glass-edge)";

  let iconNode = (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="var(--color-blueprint-blue)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2v20M17 5v14M7 5v14M2 9v6M22 9v6" />
    </svg>
  );

  if (key === "AMAN") {
    title = "Lab Tenang";
    description = "Suasana lab terkendali dan kondusif.";
    colorClass = "status-safe";
    bgColor = "rgba(38, 150, 132, 0.08)";
    borderColor = "rgba(38, 150, 132, 0.25)";
    iconNode = (
      <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="var(--color-status-safe)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M20 6L9 17l-5-5" />
      </svg>
    );
  } else if (key === "PERINGATAN_1") {
    title = "Mulai Ramai";
    description = "Ambang kebisingan 60% terlampaui. Alarm peringatan 1 aktif.";
    colorClass = "status-warn";
    bgColor = "rgba(228, 109, 76, 0.08)";
    borderColor = "rgba(228, 109, 76, 0.3)";
    iconNode = (
      <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="var(--color-ember-glow)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
        <line x1="12" y1="9" x2="12" y2="13" />
        <line x1="12" y1="17" x2="12.01" y2="17" />
      </svg>
    );
  } else if (key === "PERINGATAN_2") {
    title = "Terlalu Berisik";
    description = "Kebisingan mencapai ambang 80%! Mohon segera kurangi suara.";
    colorClass = "status-alert";
    bgColor = "rgba(228, 109, 76, 0.16)";
    borderColor = "rgba(228, 109, 76, 0.5)";
    iconNode = (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#ff8260" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" />
        <line x1="12" y1="8" x2="12" y2="12" />
        <line x1="12" y1="16" x2="12.01" y2="16" />
      </svg>
    );
  }

  return (
    <div
      className={`glass-card ${isPulsing ? "animate-pulse-slow" : ""}`}
      style={{
        flex: 1,
        background: bgColor,
        borderColor: borderColor,
        transition: "all 300ms ease",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
      }}
      role="status"
      aria-live="polite"
    >
      <div className="eyebrow" style={{ marginBottom: "16px" }}>
        Status Laboratorium
      </div>

      <div style={{ textAlign: "center", padding: "8px 0 16px" }}>
        {/* Lingkaran Ikon SVG Profesional (No Emojis) */}
        <div
          style={{
            width: "56px",
            height: "56px",
            borderRadius: "50%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            margin: "0 auto 16px",
            background: "rgba(186, 215, 247, 0.05)",
            border: `1px solid ${borderColor}`,
            boxShadow: "var(--shadow-subtle-2)",
          }}
        >
          {iconNode}
        </div>

        {/* Judul Status */}
        <h2
          className={colorClass}
          style={{
            fontFamily: "var(--font-aeonikpro)",
            fontSize: "26px",
            fontWeight: 500,
            textAlign: "center",
            margin: "0 0 8px",
            lineHeight: 1.15,
            transition: "color 300ms ease",
          }}
        >
          {title}
        </h2>

        {/* Keterangan */}
        <p
          style={{
            textAlign: "center",
            fontSize: "14px",
            color: "var(--color-moon-mist)",
            margin: 0,
            maxWidth: "340px",
            marginLeft: "auto",
            marginRight: "auto",
            lineHeight: 1.45,
          }}
        >
          {description}
        </p>
      </div>

      {/* Footer kartu: indikator live real-time */}
      <div
        style={{
          borderTop: "1px solid var(--color-glass-edge)",
          paddingTop: "12px",
          marginTop: "12px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          fontSize: "12px",
          fontFamily: "var(--font-dotdigital)",
          color: "var(--color-fog-veil)",
          letterSpacing: "0.06em",
        }}
      >
        <span>SENSOR: AKTIF</span>
        <span style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          <span
            className="live-pulse"
            style={{
              width: "6px",
              height: "6px",
              borderRadius: "50%",
              background: key === "PERINGATAN_2" ? "var(--color-status-alert)" : key === "PERINGATAN_1" ? "var(--color-status-warn)" : "var(--color-status-safe)",
              display: "inline-block",
            }}
          />
          CONTINUOUS
        </span>
      </div>
    </div>
  );
}
