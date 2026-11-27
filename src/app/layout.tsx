import type { Metadata } from "next";
import "./globals.css";
import { Toaster } from "sonner";

export const metadata: Metadata = {
  title: "TrustFive — Trades Marketplace with Five-Slot Network & Community",
  description: "TrustFive unifies a Checkatrade-style trades marketplace with the five-slot network, a B2B platform for tradespeople, and a full community social layer.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="antialiased">
        {children}
        <Toaster position="bottom-right" richColors closeButton />
      </body>
    </html>
  );
}