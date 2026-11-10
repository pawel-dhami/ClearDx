import type { Metadata, Viewport } from "next";
import { JetBrains_Mono, Rajdhani, Space_Grotesk } from "next/font/google";
import { MotionConfig } from "motion/react";
import "./globals.css";

// Design system: Rajdhani (display), Space Grotesk (body), JetBrains Mono (data).
const rajdhani = Rajdhani({ variable: "--font-rajdhani", subsets: ["latin"], weight: ["500", "600", "700"] });
const spaceGrotesk = Space_Grotesk({ variable: "--font-space-grotesk", subsets: ["latin"] });
const jetbrainsMono = JetBrains_Mono({ variable: "--font-jetbrains-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: { default: "ClearDx — See why, not just what", template: "%s · ClearDx" },
  description: "ClearDx is an explainable AI symptom predictor: an educational demo, not medical advice.",
};

export const viewport: Viewport = {
  themeColor: "#030812",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${rajdhani.variable} ${spaceGrotesk.variable} ${jetbrainsMono.variable}`}>
      <body className="min-h-screen font-sans antialiased">
        {/* "user" honours the OS reduced-motion setting for every motion component */}
        <MotionConfig reducedMotion="user">{children}</MotionConfig>
      </body>
    </html>
  );
}
