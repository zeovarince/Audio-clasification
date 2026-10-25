"use client";

interface StartButtonProps {
  isActive: boolean;
  isLoading: boolean;
  onClick: () => void;
}

export default function StartButton({
  isActive,
  isLoading,
  onClick,
}: StartButtonProps) {
  if (isLoading) {
    return (
      <button className="btn-primary" disabled>
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          style={{ animation: "spin 1s linear infinite" }}
        >
          <circle
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="3"
            strokeDasharray="47"
            strokeDashoffset="15"
            strokeLinecap="round"
          />
        </svg>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        Meminta izin...
      </button>
    );
  }

  if (isActive) {
    return (
      <button className="btn-ghost" onClick={onClick} id="btn-stop">
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="currentColor"
        >
          <rect x="6" y="6" width="12" height="12" rx="2" />
        </svg>
        Hentikan
      </button>
    );
  }

  return (
    <button className="btn-primary" onClick={onClick} id="btn-start">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
        <path d="M8 5v14l11-7z" />
      </svg>
      Mulai Pemantauan
    </button>
  );
}
