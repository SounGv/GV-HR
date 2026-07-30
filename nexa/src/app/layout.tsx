import type { Metadata } from "next";
import { Inter, Noto_Sans_Thai, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { AppProviders } from "@/providers";

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

const mono = JetBrains_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "NEXA People Platform",
    template: "%s · NEXA",
  },
  description: "NEXA HR & Payroll Platform — ระบบบริหารงานบุคคลและเงินเดือนสำหรับองค์กร",
  applicationName: "NEXA",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="th" suppressHydrationWarning>
      <body className={`${inter.variable} ${notoThai.variable} ${mono.variable} font-sans`}>
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
