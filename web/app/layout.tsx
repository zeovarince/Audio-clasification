import type { Metadata } from "next";
import { Inter, Space_Grotesk, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-untitled-sans",
  weight: ["400", "500", "600"],
});
const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-aeonikpro",
  weight: ["400", "500"],
});
const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-dotdigital",
  weight: ["400"],
});

export const metadata: Metadata = {
  title: "SilentGuard Lab – Pemantau Kebisingan Lab",
  description:
    "Sistem pemantau kebisingan lab berbasis browser. Deteksi suara berisik secara real-time dengan akurasi 92%.",
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
    <html
      lang="id"
      className={`${inter.variable} ${spaceGrotesk.variable} ${jetbrainsMono.variable}`}
    >
      <body>{children}</body>
    </html>
  );
}
