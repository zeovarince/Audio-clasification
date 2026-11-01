import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "SilentGuard Lab – Pemantau Kebisingan Lab",
  description:
    "Sistem pemantau kebisingan lab berbasis browser dengan Model 3.0 Ensemble Soft-Voting (SVM, LightGBM, ExtraTrees), threshold 50%, dan akurasi holdout 97,50% dan 5-fold CV 95,00%.",
  icons: {
    icon: "/logosilent.png",
    shortcut: "/logosilent.png",
    apple: "/logosilent.png",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="id">
      <body>{children}</body>
    </html>
  );
}
