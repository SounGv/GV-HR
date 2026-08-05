import type { Metadata, Viewport } from "next";
import { Inter, Noto_Sans_Thai, Kanit, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { AppProviders } from "@/providers";
import { PwaRegister } from "@/components/pwa/pwa-register";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

const notoThai = Noto_Sans_Thai({
  variable: "--font-noto-thai",
  subsets: ["thai", "latin"],
  display: "swap",
});

// Heading typeface — geometric Thai/Latin sans with real weight range, so
// titles read as clearly distinct from Noto Sans Thai body copy.
const kanit = Kanit({
  variable: "--font-kanit",
  subsets: ["thai", "latin"],
  weight: ["500", "600", "700", "800"],
  display: "swap",
});

const mono = JetBrains_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
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
    icon: "/nexa-logo.svg",
    apple: "/nexa-logo.svg",
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#0A0A0A" },
  ],
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="th" suppressHydrationWarning>
      <body className={`${inter.variable} ${notoThai.variable} ${kanit.variable} ${mono.variable} font-sans`}>
        <AppProviders>{children}</AppProviders>
        <PwaRegister />
      </body>
    </html>
  );
}
