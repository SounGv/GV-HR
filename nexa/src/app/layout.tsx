import type { Metadata, Viewport } from "next";
import { IBM_Plex_Mono, Prompt } from "next/font/google";
import "./globals.css";
import { AppProviders } from "@/providers";
import { PwaRegister } from "@/components/pwa/pwa-register";

const mono = IBM_Plex_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  display: "swap",
});

/** The one app-wide typeface (mobile and desktop alike), for body and
 * headings. Prompt has Thai and Latin cuts, so numerals match the Thai text.
 *
 * The next/font class (which defines `--font-prompt`) must sit on <html>, not
 * <body>: globals.css reads the variable from `:root`, and a variable that
 * only exists on a descendant is invalid there, which silently dropped the
 * whole stack to the browser's serif default. */
const prompt = Prompt({
  variable: "--font-prompt",
  subsets: ["thai", "latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.APP_URL ?? "http://localhost:3000"),
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
    <html lang="th" suppressHydrationWarning className={`${mono.variable} ${prompt.variable}`}>
      <body className="font-sans">
        <AppProviders>{children}</AppProviders>
        <PwaRegister />
      </body>
    </html>
  );
}
