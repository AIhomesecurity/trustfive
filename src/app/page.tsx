'use client'
import { useState } from 'react'
import { Sidebar } from '@/components/shell/sidebar'
import { TopBar } from '@/components/shell/top-bar'
import { MobileNav } from '@/components/shell/mobile-nav'
import { TradeFinder } from '@/components/sections/trade-finder'
import { Feed } from '@/components/sections/feed'

type Section = 'trade-finder' | 'feed'

export default function Home() {
  const [active, setActive] = useState<Section>('trade-finder')
  return (
    <div className="min-h-screen flex">
      <Sidebar active={active} onNavigate={(k) => setActive(k as Section)} />
      <div className="flex-1 flex flex-col min-w-0">
        <TopBar />
        <main className="flex-1 pb-24 lg:pb-0">
          {active === 'trade-finder' ? <TradeFinder /> : <Feed />}
        </main>
      </div>
      <MobileNav active={active} onNavigate={(k) => setActive(k as Section)} />
    </div>
  )
}
