import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "SilentGuard Lab – Pemantau Kebisingan Lab",
  description:
    "Sistem pemantau kebisingan lab berbasis browser dengan Model 5.0 SVC RBF, threshold 60%, dan akurasi holdout 97,56%.",
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
