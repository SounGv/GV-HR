import type { Metadata, Viewport } from "next";
import { JetBrains_Mono, Noto_Sans_Thai } from "next/font/google";
import "./globals.css";
import { AppProviders } from "@/providers";
import { PwaRegister } from "@/components/pwa/pwa-register";

const mono = JetBrains_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  display: "swap",
});

/** Design-system spec's primary typeface, used app-wide (mobile and desktop
 * alike) — see `--font-sans`/`--font-noto-sans-thai` in globals.css. */
const notoSansThai = Noto_Sans_Thai({
  variable: "--font-noto-sans-thai",
  subsets: ["thai", "latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "GV One People Platform",
    template: "%s · GV One",
  },
  description: "GV One HR & Payroll Platform — ระบบบริหารงานบุคคลและเงินเดือนสำหรับองค์กร",
  applicationName: "GV One",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "GV One",
  },
  icons: {
    // Home-screen/tab icons — PNG, not SVG: iOS Safari's apple-touch-icon
    // link doesn't support SVG at all, so it was silently falling back to
    // a screenshot of the page (the "square plate" look). These PNGs are
    // full-bleed with no baked-in corner rounding — iOS/Android apply
    // their own mask on top, which is why nexa-logo.svg (rx=112 baked in)
    // left a transparent margin showing through as a square backing plate.
    icon: [
      { url: "/nexa-logo.svg", type: "image/svg+xml" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
};

export const viewport: Viewport = {
  // A single unconditional tag — MobileDefaultDarkTheme keeps its `content`
  // in sync with the actual resolved app theme client-side, which can differ
  // from OS-level prefers-color-scheme (e.g. mobile forced into dark by
  // default). Two media-scoped tags here would fight that override.
  themeColor: "#84CC16",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="th" suppressHydrationWarning>
      <body className={`${mono.variable} ${notoSansThai.variable} font-sans`}>
        <AppProviders>{children}</AppProviders>
        <PwaRegister />
      </body>
    </html>
  );
}
