"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import Waveform from "@/components/Waveform";
import NoiseMeter from "@/components/NoiseMeter";
import StatusCard from "@/components/StatusCard";
import AlarmHistory, { type AlarmHistoryEntry } from "@/components/AlarmHistory";
import StatusPill from "@/components/StatusPill";
import SettingsDrawer from "@/components/SettingsDrawer";
import SplashScreen from "@/components/SplashScreen";
import ShapeGrid from "@/components/ShapeGrid";
import { createAudioCapture, type AudioCapture } from "@/lib/audio-capture";
import {
  createAlarmMachine,
  type AlarmState,
} from "@/lib/alarm-machine";
import { createSmoother } from "@/lib/smoothing";
import { createAlarmPlayer } from "@/lib/alarm-player";
import { ApiError } from "@/lib/api";
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
  const [error, setError] = useState<string | null>(null);
  const [showSplash, setShowSplash] = useState(true);
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

  // Mulai pemantauan audio otomatis
  const handleStart = useCallback(async () => {
    if (audioCaptureRef.current?.isActive()) return;

    setError(null);

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
          if (err instanceof ApiError && err.kind === "network") {
            setError(
              "Server klasifikasi belum terjangkau. Jalankan backend FastAPI, lalu coba lagi."
            );
            return;
          }
          if (err instanceof ApiError && err.kind === "timeout") {
            setError(
              "Server klasifikasi terlalu lama merespons. Memeriksa koneksi lagi..."
            );
            return;
          }
          setError("Server klasifikasi belum merespons. Memeriksa koneksi lagi...");
        },
      });

      audioCaptureRef.current = capture;
      await capture.start();
      setIsActive(true);
    } catch (err: unknown) {
      console.warn("Mencoba memulai mikrofon otomatis:", err);
      const errObj = err as { name?: string; message?: string };
      if (
        errObj?.name === "NotAllowedError" ||
        errObj?.name === "PermissionDeniedError" ||
        errObj?.message?.includes?.("Permission denied")
      ) {
        setError(
          "Izin mikrofon belum diberikan. Izinkan akses mikrofon di browser untuk pemantauan otomatis."
        );
      } else {
        setError(
          err instanceof Error
            ? err.message
            : "Memerlukan izin mikrofon browser untuk mengaktifkan pemantauan."
        );
      }
    }
  }, [threshold1, threshold2, calmHoldSeconds]);

  // Otomatis aktif saat halaman dimuat
  useEffect(() => {
    let unmounted = false;

    // Mulai otomatis langsung
    handleStart();

    // Fallback autoplay browser: interaksi pertama (klik/sentuh di mana saja) langsung menyambung audio
    const handleFirstInteraction = () => {
      if (!unmounted && !audioCaptureRef.current?.isActive()) {
        handleStart();
      }
    };

    window.addEventListener("click", handleFirstInteraction, { once: true });
    window.addEventListener("keydown", handleFirstInteraction, { once: true });
    window.addEventListener("touchstart", handleFirstInteraction, { once: true });

    return () => {
      unmounted = true;
      window.removeEventListener("click", handleFirstInteraction);
      window.removeEventListener("keydown", handleFirstInteraction);
      window.removeEventListener("touchstart", handleFirstInteraction);
    };
  }, [handleStart]);

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
    <>
      {/* GSAP SPLASH SCREEN INTERAKTIF (Hanya tampil satu kali) */}
      {showSplash && (
        <SplashScreen
          onFinish={() => {
            setShowSplash(false);
            handleStart();
          }}
        />
      )}

      {/* REACT BITS SHAPEGRID INTERACTIVE BACKGROUND */}
      <div
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 0,
          pointerEvents: "none",
          overflow: "hidden",
        }}
        aria-hidden="true"
      >
        <ShapeGrid
          shape="square"
          direction="diagonal"
          lineColor="rgba(186, 215, 247, 0.07)"
          hoverColor="#98c0ef"
          hoverFillColor="#663af3"
          fillOpacity={0.14}
          cellSize={44}
          speed={0.35}
          glow={0.45}
          trail={0.7}
          twinkle={0.18}
          clickCascade={true}
          fade={0.88}
          backgroundColor="#05060f"
        />
      </div>

      <div
        style={{
          position: "relative",
          zIndex: 1,
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
          padding: "24px 24px 48px",
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
            marginBottom: "28px",
            paddingBottom: "18px",
            borderBottom: "1px solid var(--color-glass-edge)",
          }}
        >
          {/* Logo & Judul */}
          <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
            <div
              style={{
                position: "relative",
                width: "48px",
                height: "48px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
            >
              <div
                style={{
                  position: "absolute",
                  inset: "4px",
                  borderRadius: "50%",
                  background:
                    "radial-gradient(circle, rgba(152, 192, 239, 0.4) 0%, rgba(102, 58, 243, 0.2) 60%, transparent 80%)",
                  filter: "blur(8px)",
                  zIndex: 0,
                }}
              />
              <img
                src="/logosilent.png"
                alt="SilentGuard Lab Logo"
                width={48}
                height={48}
                style={{
                  position: "relative",
                  zIndex: 1,
                  width: "100%",
                  height: "100%",
                  objectFit: "contain",
                  filter: "drop-shadow(0 2px 10px rgba(186, 215, 247, 0.35))",
                }}
              />
            </div>

            <div style={{ display: "flex", flexDirection: "column" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <h1
                  className="gradient-ice-text"
                  style={{
                    fontFamily: "var(--font-aeonikpro)",
                    fontSize: "26px",
                    fontWeight: 500,
                    letterSpacing: "-0.015em",
                    margin: 0,
                    lineHeight: 1.15,
                  }}
                >
                  SilentGuard Lab
                </h1>
                <span
                  className="badge"
                  style={{
                    fontFamily: "var(--font-dotdigital)",
                    fontSize: "11px",
                    letterSpacing: "0.08em",
                    padding: "2px 8px",
                    background: "var(--color-luminous-fill)",
                    color: "var(--color-blueprint-blue)",
                    border: "1px solid var(--color-glass-edge)",
                  }}
                >
                  LIVE
                </span>
              </div>
              <span
                style={{
                  fontSize: "13px",
                  color: "var(--color-fog-veil)",
                  fontFamily: "var(--font-untitled-sans)",
                  marginTop: "2px",
                }}
              >
                Sistem Pemantau Kebisingan Laboratorium Real-time
              </span>
            </div>
          </div>

          {/* Status Pill & Pengaturan */}
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <StatusPill alarmState={alarmState} isActive={isActive} />

            <button
              className="btn-ghost"
              onClick={() => setSettingsOpen(true)}
              id="btn-settings"
              title="Buka pengaturan ambang"
              style={{ padding: "8px 14px" }}
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
              <span>Atur</span>
            </button>
          </div>
        </header>

        {/* 2. BANNER TAB DISEMBUNYIKAN (SVG ICON) */}
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
              borderRadius: "var(--radius-badges)",
              display: "flex",
              alignItems: "center",
              gap: "10px",
            }}
            role="alert"
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{ flexShrink: 0 }}
            >
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
              <line x1="12" y1="9" x2="12" y2="13" />
              <line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
            <span>
              Biarkan tab ini tetap terbuka agar pemantauan kebisingan berjalan normal.
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
                handleStart();
              }}
            >
              Hubungkan ulang
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
              gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
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

          {/* LOG RIWAYAT ALARM & TEST TOOLBAR */}
          <section
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "16px",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                padding: "0 4px",
              }}
            >
              <div
                style={{
                  fontFamily: "var(--font-dotdigital)",
                  fontSize: "13px",
                  letterSpacing: "0.10em",
                  textTransform: "uppercase",
                  color: "var(--color-moon-mist)",
                }}
              >
                LOG PERINGATAN KEBISINGAN
              </div>

              <button
                className="btn-ghost"
                onClick={handleTestAlarms}
                disabled={isTestingAlarm}
                id="btn-test-alarm"
                title="Putar alarm 60% dan 80% untuk menguji suara"
                style={{ padding: "6px 14px", fontSize: "13px" }}
              >
                <svg
                  width="14"
                  height="14"
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
                <span>{isTestingAlarm ? "Memutar tes suara..." : "Tes Audio Alarm"}</span>
              </button>
            </div>

            <AlarmHistory entries={alarmHistory} />
          </section>
        </main>

        {/* 5. FOOTER RESMI UNIVERSITAS TRUNOJOYO MADURA */}
        <footer
          style={{
            marginTop: "auto",
            paddingTop: "40px",
            display: "flex",
            flexDirection: "column",
            gap: "24px",
            borderTop: "1px solid var(--color-glass-edge)",
          }}
        >
          {/* Baris Atas: Hak Cipta & Info Kampus */}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "flex-start",
              flexWrap: "wrap",
              gap: "20px",
            }}
          >
            <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <img
                  src="/logo-utm.png"
                  alt="SilentGuard Lab"
                  width={22}
                  height={22}
                  style={{ opacity: 0.85 }}
                />
                <span
                  style={{
                    fontFamily: "var(--font-aeonikpro)",
                    fontSize: "15px",
                    fontWeight: 500,
                    color: "var(--color-frost-glow)",
                  }}
                >
                  Universitas Trunojoyo Madura
                </span>
              </div>
              <div style={{ fontSize: "13px", color: "var(--color-fog-veil)" }}>
                Proyek Sains Data A &bull; Hak Cipta &copy; 2026 SilentGuard Lab
              </div>
            </div>

            {/* Tim Pengembang */}
            <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
              <div
                style={{
                  fontFamily: "var(--font-dotdigital)",
                  fontSize: "11px",
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                  color: "var(--color-blueprint-blue)",
                }}
              >
                TIM PENGEMBANG
              </div>
              <ul
                style={{
                  listStyle: "none",
                  margin: 0,
                  padding: 0,
                  fontSize: "13px",
                  color: "var(--color-moon-mist)",
                  display: "flex",
                  flexDirection: "column",
                  gap: "3px",
                }}
              >
                <li>&bull; A. Choiril Anwar EL-Asfihani Risydan</li>
                <li>&bull; M. Hendrik Purwanto</li>
                <li>&bull; Rifqi Fairurrafi</li>
              </ul>
            </div>
          </div>

          {/* Baris Bawah: Telemetri Sistem */}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              flexWrap: "wrap",
              gap: "12px",
              fontFamily: "var(--font-dotdigital)",
              fontSize: "11px",
              letterSpacing: "0.06em",
              color: "var(--color-fog-veil)",
              paddingTop: "12px",
              borderTop: "1px dashed rgba(186, 215, 247, 0.08)",
            }}
          >
            <span>AKURASI MODEL: 92.68% (SVC RBF + 60 K-BEST)</span>
            <span>SAMPLE RATE: 22.05 kHz &bull; WINDOW: 5.0S &bull; HOP: 1.0S</span>
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
    </>
  );
}
