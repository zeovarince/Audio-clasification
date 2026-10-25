"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import Waveform from "@/components/Waveform";
import NoiseMeter from "@/components/NoiseMeter";
import StatusCard from "@/components/StatusCard";
import AlarmHistory, { type AlarmHistoryEntry } from "@/components/AlarmHistory";
import StartButton from "@/components/StartButton";
import StatusPill from "@/components/StatusPill";
import SettingsDrawer from "@/components/SettingsDrawer";
import { createAudioCapture, type AudioCapture } from "@/lib/audio-capture";
import {
  createAlarmMachine,
  type AlarmState,
} from "@/lib/alarm-machine";
import { createSmoother } from "@/lib/smoothing";
import { createAlarmPlayer } from "@/lib/alarm-player";
import {
  DEFAULT_THRESHOLD_1,
  DEFAULT_THRESHOLD_2,
  DEFAULT_CALM_HOLD_SECONDS,
  JUMP_TO_ALARM_2,
  SMOOTHING_WINDOW,
} from "@/lib/config";

export default function Home() {
  // State aplikasi
  const [isActive, setIsActive] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [alarmState, setAlarmState] = useState<AlarmState>("AMAN");
  const [score, setScore] = useState<number>(0);
  const [analyser, setAnalyser] = useState<AnalyserNode | null>(null);
  const [alarmHistory, setAlarmHistory] = useState<AlarmHistoryEntry[]>([]);
  const [isTabHidden, setIsTabHidden] = useState(false);
  const [isTestingAlarm, setIsTestingAlarm] = useState(false);

  // State pengaturan
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [threshold1, setThreshold1] = useState(DEFAULT_THRESHOLD_1);
  const [threshold2, setThreshold2] = useState(DEFAULT_THRESHOLD_2);
  const [calmHoldSeconds, setCalmHoldSeconds] = useState(
    DEFAULT_CALM_HOLD_SECONDS
  );

  // Referensi modul audio & logika
  const audioCaptureRef = useRef<AudioCapture | null>(null);
  const alarmMachineRef = useRef<ReturnType<typeof createAlarmMachine> | null>(
    null
  );
  const smootherRef = useRef<ReturnType<typeof createSmoother> | null>(null);
  const alarmPlayerRef = useRef<ReturnType<typeof createAlarmPlayer> | null>(
    null
  );

  // Monitor tab visibility
  useEffect(() => {
    const handleVisibilityChange = () => {
      setIsTabHidden(document.hidden);
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, []);

  // Update alarm machine ketika konfigurasi berubah
  useEffect(() => {
    if (alarmMachineRef.current) {
      alarmMachineRef.current = createAlarmMachine({
        threshold1,
        threshold2,
        calmHoldMs: calmHoldSeconds * 1000,
        jumpToAlarm2: JUMP_TO_ALARM_2,
      });
    }
  }, [threshold1, threshold2, calmHoldSeconds]);

  // Hentikan pemantauan
  const handleStop = useCallback(() => {
    if (audioCaptureRef.current) {
      audioCaptureRef.current.stop();
      audioCaptureRef.current = null;
    }
    if (alarmPlayerRef.current) {
      alarmPlayerRef.current.stop();
    }
    if (alarmMachineRef.current) {
      alarmMachineRef.current.reset();
    }
    if (smootherRef.current) {
      smootherRef.current.reset();
    }
    setAnalyser(null);
    setIsActive(false);
    setScore(0);
    setAlarmState("AMAN");
  }, []);

  // Mulai pemantauan
  const handleStart = useCallback(async () => {
    setError(null);
    setIsLoading(true);

    try {
      if (!alarmPlayerRef.current) {
        alarmPlayerRef.current = createAlarmPlayer();
        alarmPlayerRef.current.init();
      }

      alarmMachineRef.current = createAlarmMachine({
        threshold1,
        threshold2,
        calmHoldMs: calmHoldSeconds * 1000,
        jumpToAlarm2: JUMP_TO_ALARM_2,
      });

      smootherRef.current = createSmoother(SMOOTHING_WINDOW);

      const capture = createAudioCapture({
        onAnalyser: (node) => {
          setAnalyser(node);
        },
        onPrediction: (result) => {
          if (!smootherRef.current || !alarmMachineRef.current) return;
          setError(null);

          const newScore = smootherRef.current.push(result.noise_probability);
          const step = alarmMachineRef.current.step(newScore, Date.now());

          setScore(newScore);
          setAlarmState(step.state);

          if (step.play && alarmPlayerRef.current) {
            alarmPlayerRef.current.play(step.play);
            const now = new Date();
            const timeStr = now.toTimeString().slice(0, 8);
            setAlarmHistory((prev) => [
              {
                time: timeStr,
                type: step.play === "alarm1" ? "60%" : "80%",
                score: newScore,
              },
              ...prev.slice(0, 19),
            ]);
          }
        },
        onError: (err) => {
          console.error("Audio capture/predict error:", err);
          setError("Server klasifikasi belum merespons. Memeriksa koneksi lagi...");
        },
      });

      audioCaptureRef.current = capture;
      await capture.start();
      setIsActive(true);
    } catch (err: unknown) {
      console.error("Gagal memulai pemantauan:", err);
      const errObj = err as { name?: string; message?: string };
      if (
        errObj?.name === "NotAllowedError" ||
        errObj?.name === "PermissionDeniedError" ||
        errObj?.message?.includes?.("Permission denied")
      ) {
        setError(
          "Izin mikrofon belum diberikan. Izinkan akses mikrofon di pengaturan browser, lalu coba lagi."
        );
      } else {
        setError(
          err instanceof Error
            ? err.message
            : "Gagal mengakses mikrofon atau memulai sistem."
        );
      }
    } finally {
      setIsLoading(false);
    }
  }, [threshold1, threshold2, calmHoldSeconds]);

  // Tes alarm
  const handleTestAlarms = useCallback(async () => {
    if (isTestingAlarm) return;
    setIsTestingAlarm(true);
    try {
      if (!alarmPlayerRef.current) {
        alarmPlayerRef.current = createAlarmPlayer();
        alarmPlayerRef.current.init();
      }
      await alarmPlayerRef.current.testAlarms();
    } catch (err) {
      console.error("Tes alarm gagal:", err);
    } finally {
      setIsTestingAlarm(false);
    }
  }, [isTestingAlarm]);

  // Kembalikan default pengaturan
  const handleResetDefaults = useCallback(() => {
    setThreshold1(DEFAULT_THRESHOLD_1);
    setThreshold2(DEFAULT_THRESHOLD_2);
    setCalmHoldSeconds(DEFAULT_CALM_HOLD_SECONDS);
  }, []);

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        padding: "32px 24px 64px",
        maxWidth: "var(--page-max-width)",
        margin: "0 auto",
      }}
    >
      {/* 1. HEADER */}
      <header
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "16px",
          marginBottom: "32px",
          paddingBottom: "20px",
          borderBottom: "1px solid var(--color-glass-edge)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
          <h1
            className="skywash-text"
            style={{
              fontFamily: "var(--font-display)",
              fontSize: "28px",
              fontWeight: 500,
              letterSpacing: "-0.02em",
              margin: 0,
            }}
          >
            SilentGuard Lab
          </h1>
          <span
            style={{
              fontSize: "12px",
              fontFamily: "var(--font-mono)",
              color: "var(--color-fog-veil)",
              padding: "2px 8px",
              borderRadius: "var(--radius-badge)",
              background: "rgba(186, 215, 247, 0.05)",
              border: "1px solid var(--color-glass-edge)",
            }}
          >
            v1.0
          </span>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <StatusPill alarmState={alarmState} isActive={isActive} />
          <StartButton
            isActive={isActive}
            isLoading={isLoading}
            onClick={isActive ? handleStop : handleStart}
          />
        </div>
      </header>

      {/* 2. BANNER TAB DISEMBUNYIKAN */}
      {isTabHidden && isActive && (
        <div
          className="badge"
          style={{
            background: "rgba(228, 109, 76, 0.15)",
            color: "var(--color-status-alert)",
            border: "1px solid rgba(228, 109, 76, 0.3)",
            padding: "12px 16px",
            marginBottom: "20px",
            fontSize: "14px",
            borderRadius: "var(--radius-badge)",
            display: "flex",
            alignItems: "center",
            gap: "10px",
          }}
          role="alert"
        >
          <span style={{ fontSize: "16px" }}>⚠️</span>
          <span>
            Biarkan tab ini tetap terbuka agar pemantauan berjalan normal.
          </span>
        </div>
      )}

      {/* 3. BANNER ERROR */}
      {error && (
        <div
          className="error-banner"
          style={{ marginBottom: "24px" }}
          role="alert"
        >
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            style={{ color: "var(--color-status-alert)", flexShrink: 0 }}
          >
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          <div style={{ flex: 1 }}>{error}</div>
          <button
            className="btn-ghost"
            style={{ padding: "4px 12px", fontSize: "12px" }}
            onClick={() => {
              setError(null);
              if (!isActive) handleStart();
            }}
          >
            Coba lagi
          </button>
        </div>
      )}

      {/* 4. MAIN CONTENT */}
      <main style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
        {/* WAVEFORM */}
        <section aria-label="Visualisasi Gelombang Suara">
          <Waveform
            analyser={analyser}
            isActive={isActive}
            alarmState={alarmState}
          />
        </section>

        {/* METER & KARTU STATUS (GRID RESPONSIF) */}
        <section
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
            gap: "24px",
          }}
        >
          <NoiseMeter
            score={score}
            threshold1={threshold1}
            threshold2={threshold2}
            alarmState={alarmState}
          />
          <StatusCard alarmState={alarmState} isActive={isActive} />
        </section>

        {/* BARIS AKSI & RIWAYAT ALARM */}
        <section
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "16px",
          }}
        >
          {/* Tombol Aksi Toolbar */}
          <div
            style={{
              display: "flex",
              justifyContent: "flex-end",
              alignItems: "center",
              gap: "12px",
            }}
          >
            <button
              className="btn-ghost"
              onClick={handleTestAlarms}
              disabled={isTestingAlarm}
              id="btn-test-alarm"
              title="Putar alarm 60% dan 80% untuk menguji suara"
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07" />
              </svg>
              {isTestingAlarm ? "Memutar tes..." : "Tes alarm"}
            </button>

            <button
              className="btn-ghost"
              onClick={() => setSettingsOpen(true)}
              id="btn-settings"
              title="Buka panel pengaturan ambang batas"
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <circle cx="12" cy="12" r="3" />
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
              </svg>
              Atur
            </button>
          </div>

          {/* Tabel / Log Riwayat */}
          <AlarmHistory entries={alarmHistory} />
        </section>
      </main>

      {/* 5. FOOTER */}
      <footer
        style={{
          marginTop: "auto",
          paddingTop: "48px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "12px",
          color: "var(--color-fog-veil)",
          fontSize: "13px",
        }}
      >
        <div>SilentGuard Lab &copy; 2026</div>
        <div style={{ display: "flex", gap: "16px" }}>
          <span>Akurasi Model: 92.68%</span>
          <span>•</span>
          <span>Window: 5s / Hop: 1s</span>
        </div>
      </footer>

      {/* 6. DRAWER PENGATURAN */}
      <SettingsDrawer
        isOpen={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        threshold1={threshold1}
        threshold2={threshold2}
        calmHoldSeconds={calmHoldSeconds}
        onThreshold1Change={setThreshold1}
        onThreshold2Change={setThreshold2}
        onCalmHoldChange={setCalmHoldSeconds}
        onResetDefaults={handleResetDefaults}
      />
    </div>
  );
}
