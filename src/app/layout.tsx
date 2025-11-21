import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";
import DeviceGuard from "@/app/components/DeviceGuard";

// Font setup
const geist = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// Metadata
export const metadata: Metadata = {
  title: "Staff - Satu Atap",
  description:
    "Aplikasi KPR BNI untuk memudahkan pengajuan kredit pemilikan rumah",
};

// Root layout
export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="id" suppressHydrationWarning>
      <body
        className={`${geist.variable} ${geistMono.variable} antialiased min-h-screen bg-background text-foreground`}
      >
        {/* 🔥 Theme Provider from next-themes */}
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          {/* Guard perangkat: redirect ke /unsupported-device bila UA mobile atau layar < 1024px */}
          <DeviceGuard />
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
