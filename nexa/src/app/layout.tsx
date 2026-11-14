import type { Metadata, Viewport } from "next";
import { Anuphan } from "next/font/google";
import "./globals.css";
import { AppProviders } from "@/providers";
import { PwaRegister } from "@/components/pwa/pwa-register";
import { appBaseUrl } from "@/lib/app-url";

/** The one app-wide typeface (mobile and desktop alike), for body and
 * headings. Anuphan (2026-11, owner's pick) is a modern, softer Thai sans with
 * Thai and Latin cuts, so numerals match the Thai text; it replaced IBM Plex
 * Sans Thai, which read stiff, and before that Prompt, whose small sizes looked
 * thin in tables.
 *
 * The next/font class (which defines `--font-sans-thai`) must sit on <html>, not
 * <body>: globals.css reads the variable from `:root`, and a variable that
 * only exists on a descendant is invalid there, which silently dropped the
 * whole stack to the browser's serif default. */
const sansThai = Anuphan({
  variable: "--font-sans-thai",
  subsets: ["thai", "latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(appBaseUrl()),
  // One name everywhere: the Vercel project is "gv-one", the brand is "GV One".
  title: {
    default: "GV One · ระบบบริหารงานบุคคลและเงินเดือน",
    template: "%s · GV One",
  },
  description: "GV One ระบบบริหารงานบุคคลและเงินเดือนสำหรับองค์กร ลงเวลา ลา OT ประเมินผล และเงินเดือนในที่เดียว",
  applicationName: "GV One",
  openGraph: {
    type: "website",
    siteName: "GV One",
    title: "GV One · ระบบบริหารงานบุคคลและเงินเดือน",
    description: "ลงเวลา ลา OT ประเมินผล และเงินเดือนในที่เดียว",
    locale: "th_TH",
  },
  // Search Console's "HTML tag" verification: paste the token into GOOGLE_SITE_VERIFICATION on Vercel.
  verification: process.env.GOOGLE_SITE_VERIFICATION ? { google: process.env.GOOGLE_SITE_VERIFICATION } : undefined,
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

/** Tells Google the site's name (shown above the result title). Static text only. */
const SITE_NAME_JSON_LD = JSON.stringify({
  "@context": "https://schema.org",
  "@type": "WebSite",
  name: "GV One",
  alternateName: ["gv-one", "GV One HR"],
  url: appBaseUrl(),
  inLanguage: "th",
});

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="th" suppressHydrationWarning className={sansThai.variable}>
      <head>
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: SITE_NAME_JSON_LD }} />
      </head>
      <body className="font-sans">
        <AppProviders>{children}</AppProviders>
        <PwaRegister />
      </body>
    </html>
  );
}
