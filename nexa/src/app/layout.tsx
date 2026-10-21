import type { Metadata, Viewport } from "next";
import { IBM_Plex_Mono, IBM_Plex_Sans_Thai } from "next/font/google";
import "./globals.css";
import { AppProviders } from "@/providers";
import { PwaRegister } from "@/components/pwa/pwa-register";
import { appBaseUrl } from "@/lib/app-url";

const mono = IBM_Plex_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  display: "swap",
});

/** The one app-wide typeface (mobile and desktop alike), for body and
 * headings. IBM Plex Sans Thai is drawn for data-heavy screens and has Thai and
 * Latin cuts, so numerals match the Thai text (it replaced Prompt, whose small
 * sizes looked thin and uneven in tables).
 *
 * The next/font class (which defines `--font-sans-thai`) must sit on <html>, not
 * <body>: globals.css reads the variable from `:root`, and a variable that
 * only exists on a descendant is invalid there, which silently dropped the
 * whole stack to the browser's serif default. */
const sansThai = IBM_Plex_Sans_Thai({
  variable: "--font-sans-thai",
  subsets: ["thai", "latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(appBaseUrl()),
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
    // Browser-tab favicon comes from src/app/icon.png (Next's file
    // convention — auto-injected, no manual entry needed here). iOS's
    // apple-touch-icon link doesn't support SVG at all and needs its own
    // static PNG, hence the explicit entry below.
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
};

export const viewport: Viewport = {
  // A single unconditional tag — MobileDefaultDarkTheme keeps its `content`
  // in sync with the actual resolved app theme client-side, which can differ
  // from OS-level prefers-color-scheme (e.g. mobile forced into dark by
  // default). Two media-scoped tags here would fight that override.
  themeColor: "#0D9488",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="th" suppressHydrationWarning className={`${mono.variable} ${sansThai.variable}`}>
      <body className="font-sans">
        <AppProviders>{children}</AppProviders>
        <PwaRegister />
      </body>
    </html>
  );
}
