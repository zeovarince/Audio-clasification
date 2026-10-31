"use client";

export interface AlarmHistoryEntry {
  time: string; // HH:MM:SS
  type: "60%" | "80%";
  score: number;
}

interface AlarmHistoryProps {
  entries: AlarmHistoryEntry[];
}

export default function AlarmHistory({ entries }: AlarmHistoryProps) {
  return (
    <div className="glass-card">
      <div className="eyebrow" style={{ marginBottom: "16px" }}>
        Riwayat Alarm
      </div>

      {entries.length === 0 ? (
        <p
          style={{
            color: "var(--color-fog-veil)",
            fontSize: "14px",
            textAlign: "center",
            margin: 0,
            padding: "12px 0",
          }}
        >
          Belum ada alarm pada sesi ini.
        </p>
      ) : (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "8px",
            maxHeight: "240px",
            overflowY: "auto",
          }}
        >
          {entries.map((entry, i) => (
            <div
              key={i}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "12px",
                padding: "8px 12px",
                borderRadius: "var(--radius-badge)",
                background: "rgba(199, 211, 234, 0.04)",
                fontSize: "13px",
              }}
            >
              {/* Waktu */}
              <span
                style={{
                  fontFamily: "var(--font-mono)",
                  color: "var(--color-fog-veil)",
                  fontSize: "12px",
                  flexShrink: 0,
                }}
              >
                {entry.time}
              </span>

              {/* Badge alarm type */}
              <span
                className="badge"
                style={{
                  background:
                    entry.type === "80%"
                      ? "rgba(228, 109, 76, 0.15)"
                      : "rgba(228, 109, 76, 0.08)",
                  color:
                    entry.type === "80%"
                      ? "var(--color-status-alert)"
                      : "var(--color-status-warn)",
                  fontSize: "11px",
                  padding: "2px 8px",
                  flexShrink: 0,
                }}
              >
                Alarm {entry.type}
              </span>

              {/* Skor */}
              <span
                style={{
                  color: "var(--color-moon-mist)",
                  fontSize: "13px",
                }}
              >
                keramaian {entry.score}%
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
