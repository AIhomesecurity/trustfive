import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "sonner";
import { Providers } from "@/components/providers";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "TrustFive — Trades Marketplace with Five-Slot Network & Community",
  description: "TrustFive unifies a Checkatrade-style trades marketplace (with the five-slot network: only 5 approved providers per trade per district), a B2B platform for tradespeople, and a full community social layer into one trusted platform.",
  keywords: ["TrustFive", "trades", "marketplace", "five-slot network", "B2B", "Checkatrade", "community", "tradesperson", "social"],
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}>
        <Providers>{children}</Providers>
        <Toaster position="bottom-right" richColors closeButton />
      </body>
    </html>
  );
}