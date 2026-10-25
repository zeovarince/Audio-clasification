"use client";

import type { AlarmState } from "@/lib/alarm-machine";

interface NoiseMeterProps {
  score: number;
  threshold1: number;
  threshold2: number;
  alarmState: AlarmState;
}

export default function NoiseMeter({
  score,
  threshold1,
  threshold2,
  alarmState,
}: NoiseMeterProps) {
  const statusColor =
    alarmState === "PERINGATAN_2"
      ? "var(--color-status-alert)"
      : alarmState === "PERINGATAN_1"
      ? "var(--color-status-warn)"
      : "var(--color-status-safe)";

  const scoreColor =
    alarmState === "PERINGATAN_2"
      ? "#e46d4c"
      : alarmState === "PERINGATAN_1"
      ? "rgba(228, 109, 76, 0.7)"
      : "#269684";

  return (
    <div className="glass-card" style={{ flex: 1 }}>
      <div className="eyebrow" style={{ marginBottom: "16px" }}>
        Keramaian
      </div>

      {/* Angka besar */}
      <div
        className="display-number"
        style={{
          fontSize: "64px",
          textAlign: "center",
          color: scoreColor,
          marginBottom: "24px",
          transition: "color 300ms ease",
        }}
      >
        {score}%
      </div>

      {/* Track bar */}
      <div style={{ position: "relative", padding: "0 4px" }}>
        {/* Track background */}
        <div
          style={{
            height: "12px",
            borderRadius: "999px",
            background: "rgba(199, 211, 234, 0.06)",
            boxShadow: "var(--shadow-border)",
            position: "relative",
            overflow: "hidden",
          }}
        >
          {/* Fill */}
          <div
            style={{
              height: "100%",
              width: `${Math.min(100, Math.max(0, score))}%`,
              borderRadius: "999px",
              background: statusColor,
              transition: "width 300ms ease, background 300ms ease",
            }}
          />
        </div>

        {/* Penanda 60 */}
        <div
          style={{
            position: "absolute",
            left: `${threshold1}%`,
            top: "-4px",
            transform: "translateX(-50%)",
          }}
        >
          <div
            style={{
              width: "2px",
              height: "20px",
              background: "var(--color-moon-mist)",
              opacity: 0.6,
            }}
          />
          <div
            style={{
              fontSize: "11px",
              color: "var(--color-fog-veil)",
              textAlign: "center",
              marginTop: "4px",
              transform: "translateX(-2px)",
            }}
          >
            {threshold1}
          </div>
        </div>

        {/* Penanda 80 */}
        <div
          style={{
            position: "absolute",
            left: `${threshold2}%`,
            top: "-4px",
            transform: "translateX(-50%)",
          }}
        >
          <div
            style={{
              width: "2px",
              height: "20px",
              background: "var(--color-moon-mist)",
              opacity: 0.6,
            }}
          />
          <div
            style={{
              fontSize: "11px",
              color: "var(--color-fog-veil)",
              textAlign: "center",
              marginTop: "4px",
              transform: "translateX(-2px)",
            }}
          >
            {threshold2}
          </div>
        </div>
      </div>
    </div>
  );
}
