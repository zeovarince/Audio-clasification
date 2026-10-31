"use client";

import { useEffect, useRef, useState } from "react";

interface SplashScreenProps {
  onFinish?: () => void;
}

export default function SplashScreen({ onFinish }: SplashScreenProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const logoRef = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const subtitleRef = useRef<HTMLParagraphElement>(null);
  const progressLineRef = useRef<HTMLDivElement>(null);
  const statusRef = useRef<HTMLDivElement>(null);
  const [fading, setFading] = useState(false);

  // Stable ref for onFinish so the callback never goes stale
  const onFinishRef = useRef(onFinish);
  useEffect(() => {
    onFinishRef.current = onFinish;
  }, [onFinish]);

  // Guard: only fire onFinish once
  const didFinishRef = useRef(false);
  const finish = () => {
    if (didFinishRef.current) return;
    didFinishRef.current = true;
    // Trigger CSS fade-out, then unmount
    setFading(true);
    setTimeout(() => {
      onFinishRef.current?.();
    }, 420);
  };

  useEffect(() => {
    // ── Safety net: if animations fail or GSAP breaks, we STILL dismiss ──
    const safetyTimer = setTimeout(() => {
      finish();
    }, 4500);

    // ── Reduced-motion shortcut ──
    const prefersReducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;
    if (prefersReducedMotion) {
      finish();
      clearTimeout(safetyTimer);
      return;
    }

    // ── Dynamically import GSAP so a broken import won't block ──
    let cancelled = false;

    (async () => {
      try {
        const gsapModule = await import("gsap");
        const gsap = gsapModule.default || gsapModule;

        if (cancelled || !containerRef.current) return;

        const ctx = gsap.context(() => {
          const tl = gsap.timeline({
            onComplete: () => {
              clearTimeout(safetyTimer);
              finish();
            },
          });

          // 1. Logo entrance
          if (logoRef.current) {
            tl.fromTo(
              logoRef.current,
              { scale: 0.75, opacity: 0, filter: "blur(12px)" },
              {
                scale: 1,
                opacity: 1,
                filter: "blur(0px)",
                duration: 0.7,
                ease: "power3.out",
              }
            );
          }

          // 2. Title & Subtitle
          const targets = [titleRef.current, subtitleRef.current].filter(
            Boolean
          );
          if (targets.length > 0) {
            tl.fromTo(
              targets,
              { y: 16, opacity: 0 },
              {
                y: 0,
                opacity: 1,
                duration: 0.5,
                stagger: 0.12,
                ease: "power2.out",
              },
              "-=0.3"
            );
          }

          // 3. Progress bar + status text
          tl.call(() => {
            if (statusRef.current)
              statusRef.current.textContent = "MEMVERIFIKASI MODEL SUARA ML...";
          }, undefined, "+=0.2");

          if (progressLineRef.current) {
            tl.fromTo(
              progressLineRef.current,
              { scaleX: 0 },
              { scaleX: 0.65, duration: 0.4, ease: "power1.inOut" }
            );
          }

          tl.call(() => {
            if (statusRef.current)
              statusRef.current.textContent =
                "MENGAKTIFKAN SENSOR PEMANTAUAN OTOMATIS...";
          }, undefined, "+=0.2");

          if (progressLineRef.current) {
            tl.to(progressLineRef.current, {
              scaleX: 1,
              duration: 0.4,
              ease: "power2.out",
            });
          }

          tl.call(() => {
            if (statusRef.current)
              statusRef.current.textContent = "SISTEM SIAP & AKTIF";
          }, undefined, "+=0.12");

          // 4. Hold briefly so user reads "SISTEM SIAP"
          tl.to({}, { duration: 0.3 });
        }, containerRef);

        // Cleanup when React unmounts (Strict Mode double-mount)
        return () => {
          ctx.revert();
        };
      } catch {
        // GSAP import failed — just dismiss
        finish();
      }
    })();

    return () => {
      cancelled = true;
      clearTimeout(safetyTimer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      ref={containerRef}
      onClick={finish}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        background: "var(--surface-midnight-canvas, #05060f)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "24px",
        cursor: "pointer",
        opacity: fading ? 0 : 1,
        transform: fading ? "scale(1.03)" : "scale(1)",
        transition: "opacity 0.4s ease, transform 0.4s ease",
      }}
    >
      {/* Background subtle grid */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          backgroundImage:
            "linear-gradient(rgba(186, 215, 247, 0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(186, 215, 247, 0.05) 1px, transparent 1px)",
          backgroundSize: "48px 48px",
          pointerEvents: "none",
          maskImage:
            "radial-gradient(circle at center, black 40%, transparent 80%)",
        }}
      />

      {/* Radial Spotlight glow */}
      <div
        style={{
          position: "absolute",
          width: "500px",
          height: "500px",
          borderRadius: "50%",
          background:
            "radial-gradient(circle, rgba(152, 192, 239, 0.22) 0%, rgba(102, 58, 243, 0.12) 40%, transparent 70%)",
          filter: "blur(40px)",
          pointerEvents: "none",
        }}
      />

      <div
        style={{
          position: "relative",
          zIndex: 1,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          maxWidth: "460px",
          textAlign: "center",
        }}
      >
        {/* Logo */}
        <div
          ref={logoRef}
          style={{
            position: "relative",
            width: "84px",
            height: "84px",
            marginBottom: "20px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            opacity: 0,
          }}
        >
          <img
            src="/logosilent.png"
            alt="SilentGuard Lab Logo"
            width={84}
            height={84}
            style={{
              width: "100%",
              height: "100%",
              objectFit: "contain",
              filter: "drop-shadow(0 4px 20px rgba(186, 215, 247, 0.5))",
            }}
          />
        </div>

        {/* Title */}
        <h1
          ref={titleRef}
          className="gradient-ice-text"
          style={{
            fontFamily: "var(--font-aeonikpro)",
            fontSize: "36px",
            fontWeight: 500,
            letterSpacing: "-0.02em",
            margin: "0 0 8px",
            lineHeight: 1.15,
            opacity: 0,
          }}
        >
          SilentGuard Lab
        </h1>

        {/* Subtitle */}
        <p
          ref={subtitleRef}
          style={{
            fontSize: "14px",
            color: "var(--color-moon-mist)",
            margin: "0 0 32px",
            fontFamily: "var(--font-untitled-sans)",
            letterSpacing: "0.01em",
            opacity: 0,
          }}
        >
          Sistem Pemantauan Kebisingan Laboratorium Real-time
        </p>

        {/* Progress Bar */}
        <div
          style={{
            width: "240px",
            height: "3px",
            borderRadius: "999px",
            background: "rgba(199, 211, 234, 0.12)",
            overflow: "hidden",
            position: "relative",
            marginBottom: "16px",
          }}
        >
          <div
            ref={progressLineRef}
            style={{
              position: "absolute",
              left: 0,
              top: 0,
              bottom: 0,
              width: "100%",
              background: "linear-gradient(90deg, #663af3, #98c0ef)",
              transformOrigin: "left center",
              boxShadow: "0 0 10px rgba(102, 58, 243, 0.6)",
              transform: "scaleX(0)",
            }}
          />
        </div>

        {/* Status Text */}
        <div
          ref={statusRef}
          style={{
            fontSize: "12px",
            fontFamily: "var(--font-dotdigital)",
            letterSpacing: "0.08em",
            color: "var(--color-fog-veil)",
            textTransform: "uppercase",
            minHeight: "18px",
          }}
        >
          MENGINISIALISASI SENSOR AUDIO...
        </div>
      </div>
    </div>
  );
}
