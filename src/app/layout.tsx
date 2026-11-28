import type { Metadata } from 'next'
import './globals.css'
import { Providers } from '@/components/providers'

export const metadata: Metadata = {
  title: 'TrustFive — Trades Marketplace & Neighbourhood Network',
  description: 'Five-slot verified trades network. Only 5 approved pros per trade per district. Community social layer for your neighbourhood.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-slate-50 text-slate-900 antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
