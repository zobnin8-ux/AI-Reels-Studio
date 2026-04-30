import type { Metadata } from "next";
import { Inter, JetBrains_Mono, Orbitron } from "next/font/google";
import "./globals.css";
import "./v2026.css";
import "./v2026-app.css";

const inter = Inter({
  subsets: ["latin", "cyrillic"],
  weight: ["300", "400", "500", "600"],
  variable: "--font-inter",
  display: "swap"
});

const jetbrains = JetBrains_Mono({
  subsets: ["latin", "cyrillic"],
  weight: ["300", "400", "500"],
  variable: "--font-jetbrains",
  display: "swap"
});

const orbitron = Orbitron({
  subsets: ["latin"],
  weight: ["500", "600"],
  variable: "--font-orbitron",
  display: "swap"
});

export const metadata: Metadata = {
  title: "AI Reels Studio",
  description: "AI Content Control Center (stateless)"
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ru" className={[inter.variable, jetbrains.variable, orbitron.variable].join(" ")}>
      <body className={["showcase", "antialiased", inter.className].join(" ")}>{children}</body>
    </html>
  );
}
