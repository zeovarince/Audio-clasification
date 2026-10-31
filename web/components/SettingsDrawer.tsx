"use client";

import { useState, useEffect, useCallback } from "react";
import { healthCheck } from "@/lib/api";
import {
  DEFAULT_THRESHOLD_1,
  DEFAULT_THRESHOLD_2,
  DEFAULT_CALM_HOLD_SECONDS,
  DEFAULT_CONFIRM_DELAY_SECONDS,
  DEFAULT_ALARM_REPEAT_SECONDS,
} from "@/lib/config";

interface SettingsDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  threshold1: number;
  threshold2: number;
  calmHoldSeconds: number;
  confirmDelaySeconds: number;
  alarmRepeatSeconds: number;
  micGain: number;
  onThreshold1Change: (v: number) => void;
  onThreshold2Change: (v: number) => void;
  onCalmHoldChange: (v: number) => void;
  onConfirmDelayChange: (v: number) => void;
  onAlarmRepeatChange: (v: number) => void;
  onMicGainChange: (v: number) => void;
  onResetDefaults: () => void;
}

export default function SettingsDrawer({
  isOpen,
  onClose,
  threshold1,
  threshold2,
  calmHoldSeconds,
  confirmDelaySeconds,
  alarmRepeatSeconds,
  micGain,
  onThreshold1Change,
  onThreshold2Change,
  onCalmHoldChange,
  onConfirmDelayChange,
  onAlarmRepeatChange,
  onMicGainChange,
  onResetDefaults,
}: SettingsDrawerProps) {
  const [healthResult, setHealthResult] = useState<string | null>(null);
  const [healthLoading, setHealthLoading] = useState(false);

  const testConnection = useCallback(async () => {
    setHealthLoading(true);
    setHealthResult(null);
    try {
      const result = await healthCheck();
      setHealthResult(
        `Status: ${result.status}\nModel: ${result.model_loaded ? "Terpasang" : "Belum dimuat"}\nscikit-learn: ${result.sklearn_version}`
      );
    } catch (err) {
      setHealthResult(
        `Gagal: ${err instanceof Error ? err.message : "Tidak diketahui"}`
      );
    } finally {
      setHealthLoading(false);
    }
  }, []);

  // Keyboard escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [isOpen, onClose]);

  return (
    <>
      {/* Overlay */}
      <div
        className={`drawer-overlay ${isOpen ? "open" : ""}`}
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Panel */}
      <div
        className={`drawer-panel ${isOpen ? "open" : ""}`}
        role="dialog"
        aria-label="Pengaturan"
        aria-modal="true"
      >
        {/* Header */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "32px",
          }}
        >
          <h2
            style={{
              fontFamily: "var(--font-display)",
              fontSize: "24px",
              fontWeight: 500,
              margin: 0,
              color: "var(--color-ice-highlight)",
            }}
          >
            Pengaturan
          </h2>
          <button
            className="btn-ghost"
            onClick={onClose}
            aria-label="Tutup pengaturan"
            style={{ padding: "8px" }}
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            >
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Ambang Alarm 1 */}
        <div style={{ marginBottom: "24px" }}>
          <label
            style={{
              display: "flex",
              justifyContent: "space-between",
              fontSize: "14px",
              color: "var(--color-moon-mist)",
              marginBottom: "8px",
            }}
          >
            <span>Ambang Alarm 1</span>
            <span
              style={{
                fontFamily: "var(--font-mono)",
                color: "var(--color-frost-glow)",
              }}
            >
              {threshold1}%
            </span>
          </label>
          <input
            type="range"
            min="10"
            max={threshold2 - 1}
            value={threshold1}
            onChange={(e) => onThreshold1Change(Number(e.target.value))}
          />
        </div>

        {/* Ambang Alarm 2 */}
        <div style={{ marginBottom: "24px" }}>
          <label
            style={{
              display: "flex",
              justifyContent: "space-between",
              fontSize: "14px",
              color: "var(--color-moon-mist)",
              marginBottom: "8px",
            }}
          >
            <span>Ambang Alarm 2</span>
            <span
              style={{
                fontFamily: "var(--font-mono)",
                color: "var(--color-frost-glow)",
              }}
            >
              {threshold2}%
            </span>
          </label>
          <input
            type="range"
            min={threshold1 + 1}
            max="100"
            value={threshold2}
            onChange={(e) => onThreshold2Change(Number(e.target.value))}
          />
        </div>

        {/* Waktu Konfirmasi Alarm */}
        <div style={{ marginBottom: "24px" }}>
          <label
            style={{
              display: "flex",
              justifyContent: "space-between",
              fontSize: "14px",
              color: "var(--color-moon-mist)",
              marginBottom: "8px",
            }}
          >
            <span>Tunda konfirmasi alarm (detik)</span>
            <span
              style={{
                fontFamily: "var(--font-mono)",
                color: "var(--color-frost-glow)",
              }}
            >
              {confirmDelaySeconds}s
            </span>
          </label>
          <input
            type="range"
            min="1"
            max="30"
            value={confirmDelaySeconds}
            onChange={(e) => onConfirmDelayChange(Number(e.target.value))}
          />
          <div
            style={{
              fontSize: "11px",
              color: "var(--color-fog-veil)",
              marginTop: "4px",
            }}
          >
            Ketika terdeteksi ramai, alarm menunggu selama ini sebelum berbunyi.
            Jika skor turun kembali sebelum waktunya, alarm tidak jadi berbunyi.
          </div>
        </div>

        {/* Jeda Pengulangan Alarm */}
        <div style={{ marginBottom: "24px" }}>
          <label
            style={{
              display: "flex",
              justifyContent: "space-between",
              fontSize: "14px",
              color: "var(--color-moon-mist)",
              marginBottom: "8px",
            }}
          >
            <span>Jeda ulangi alarm (detik)</span>
            <span
              style={{
                fontFamily: "var(--font-mono)",
                color: "var(--color-frost-glow)",
              }}
            >
              {alarmRepeatSeconds}s
            </span>
          </label>
          <input
            type="range"
            min="5"
            max="60"
            value={alarmRepeatSeconds}
            onChange={(e) => onAlarmRepeatChange(Number(e.target.value))}
          />
          <div
            style={{
              fontSize: "11px",
              color: "var(--color-fog-veil)",
              marginTop: "4px",
            }}
          >
            Jika ruangan masih terus ramai setelah alarm berbunyi, alarm akan
            berbunyi ulang setiap interval detik ini.
          </div>
        </div>

        {/* Tahan Tenang */}
        <div style={{ marginBottom: "32px" }}>
          <label
            style={{
              display: "flex",
              justifyContent: "space-between",
              fontSize: "14px",
              color: "var(--color-moon-mist)",
              marginBottom: "8px",
            }}
          >
            <span>Tahan tenang (detik)</span>
            <span
              style={{
                fontFamily: "var(--font-mono)",
                color: "var(--color-frost-glow)",
              }}
            >
              {calmHoldSeconds}s
            </span>
          </label>
          <input
            type="range"
            min="1"
            max="30"
            value={calmHoldSeconds}
            onChange={(e) => onCalmHoldChange(Number(e.target.value))}
          />
          <div
            style={{
              fontSize: "11px",
              color: "var(--color-fog-veil)",
              marginTop: "4px",
            }}
          >
            Setelah ramai, ruangan harus konsisten tenang selama durasi ini
            sebelum status resmi kembali aman (mencegah alarm hidup-mati berulang
            kali).
          </div>
        </div>

        {/* Sensitivitas Mikrofon (Gain) */}
        <div style={{ marginBottom: "32px" }}>
          <label
            style={{
              display: "flex",
              justifyContent: "space-between",
              fontSize: "14px",
              color: "var(--color-moon-mist)",
              marginBottom: "8px",
            }}
          >
            <span>Sensitivitas Mikrofon</span>
            <span
              style={{
                fontFamily: "var(--font-mono)",
                color: "var(--color-frost-glow)",
              }}
            >
              {micGain.toFixed(1)}x
            </span>
          </label>
          <input
            type="range"
            min="1.0"
            max="4.0"
            step="0.1"
            value={micGain}
            onChange={(e) => onMicGainChange(Number(e.target.value))}
          />
          <div
            style={{
              fontSize: "11px",
              color: "var(--color-fog-veil)",
              marginTop: "4px",
            }}
          >
            Tingkatkan penguatan jika suara ruangan terasa terlalu pelan atau persentase susah naik.
          </div>
        </div>

        {/* Divider */}
        <div
          style={{
            height: "1px",
            background:
              "linear-gradient(90deg, transparent, var(--color-glass-edge), transparent)",
            marginBottom: "24px",
          }}
        />

        {/* Tes Koneksi */}
        <div style={{ marginBottom: "16px" }}>
          <button
            className="btn-ghost"
            onClick={testConnection}
            disabled={healthLoading}
            style={{ width: "100%", justifyContent: "center" }}
          >
            {healthLoading ? "Memeriksa..." : "Tes koneksi backend"}
          </button>
        </div>

        {healthResult && (
          <pre
            style={{
              background: "rgba(199, 211, 234, 0.04)",
              padding: "12px",
              borderRadius: "var(--radius-badge)",
              fontSize: "12px",
              fontFamily: "var(--font-mono)",
              color: "var(--color-frost-glow)",
              whiteSpace: "pre-wrap",
              margin: "0 0 24px",
              boxShadow: "var(--shadow-border)",
            }}
          >
            {healthResult}
          </pre>
        )}

        {/* Kembalikan Default */}
        <button
          className="btn-ghost"
          onClick={onResetDefaults}
          style={{ width: "100%", justifyContent: "center" }}
        >
          Kembalikan default
        </button>
      </div>
    </>
  );
}
