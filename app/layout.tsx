import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { MotionConfig } from "motion/react";
import { Interactions } from "@/components/site/Interactions";
import { THEME_BOOT_SCRIPT } from "@/lib/theme";
import "./globals.css";

// Design system: Inter throughout, in the spirit of SF Pro / Segoe UI Variable.
const inter = Inter({ variable: "--font-inter", subsets: ["latin"] });

export const metadata: Metadata = {
  title: { default: "ClearDx — See why, not just what", template: "%s · ClearDx" },
  description: "ClearDx is an explainable AI symptom predictor: an educational demo, not medical advice.",
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#0d0e12" },
    { media: "(prefers-color-scheme: light)", color: "#f5f5f7" },
  ],
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    // The boot script sets data-theme / --hue before React hydrates, hence suppressHydrationWarning.
    <html lang="en" data-theme="dark" suppressHydrationWarning className={inter.variable}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOT_SCRIPT }} />
      </head>
      <body className="min-h-screen font-sans antialiased">
        {/* "user" honours the OS reduced-motion setting for every motion component */}
        <MotionConfig reducedMotion="user">{children}</MotionConfig>
        <Interactions />
      </body>
    </html>
  );
}
