'use client'

import { useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { useAppStore, type SectionKey } from '@/stores/app-store'
import { Sidebar } from '@/components/shell/sidebar'
import { TopBar } from '@/components/shell/top-bar'
import { MobileNav } from '@/components/shell/mobile-nav'
import { FeedSection } from '@/components/sections/feed'
import { NetworkSection } from '@/components/sections/network'
import { MarketplaceSection } from '@/components/sections/marketplace'
import { JobsSection } from '@/components/sections/jobs'
import { ServicesSection } from '@/components/sections/services'
import { GroupsSection } from '@/components/sections/groups'
import { EventsSection } from '@/components/sections/events'
import { PagesSection } from '@/components/sections/pages'
import { MessagesSection } from '@/components/sections/messages'
import { NotificationsSection } from '@/components/sections/notifications'
import { MapSection } from '@/components/sections/map'
import { ProfileSection } from '@/components/sections/profile'
import { AdminSection } from '@/components/sections/admin'
import { LearningSection } from '@/components/sections/learning'
import { FundraisersSection } from '@/components/sections/fundraisers'
import { CoachingSection } from '@/components/sections/coaching'
import { MoreSection } from '@/components/sections/more'
import { TradeFinderSection } from '@/components/sections/trade-finder'
import { B2BSection } from '@/components/sections/b2b'
import { SupportSection } from '@/components/sections/support'
import { Loader2 } from 'lucide-react'

const SECTIONS: Record<SectionKey, () => React.ReactNode> = {
  feed: () => <FeedSection />, network: () => <NetworkSection />, marketplace: () => <MarketplaceSection />,
  jobs: () => <JobsSection />, services: () => <ServicesSection />, groups: () => <GroupsSection />,
  events: () => <EventsSection />, pages: () => <PagesSection />, messages: () => <MessagesSection />,
  notifications: () => <NotificationsSection />, map: () => <MapSection />, profile: () => <ProfileSection />,
  admin: () => <AdminSection />, learning: () => <LearningSection />, fundraisers: () => <FundraisersSection />,
  coaching: () => <CoachingSection />, more: () => <MoreSection />,
  'trade-finder': () => <TradeFinderSection />, b2b: () => <B2BSection />, support: () => <SupportSection />,
}

export default function Home() {
  const { section, currentUserId, setCurrentUserId } = useAppStore()
  const { data: me, isLoading } = useQuery({ queryKey: ['me'], queryFn: () => api<any>('/api/me'), retry: false })
  useEffect(() => { if (me?.id && !currentUserId) setCurrentUserId(me.id) }, [me?.id, currentUserId, setCurrentUserId])
  const Section = SECTIONS[section]
  return (
    <div className="min-h-screen flex flex-col bg-background">
      <TopBar me={me} />
      <div className="flex flex-1 w-full">
        <aside className="hidden md:flex md:w-64 lg:w-72 border-r bg-sidebar/60 sticky top-[57px] h-[calc(100vh-57px)] flex-col"><Sidebar me={me} /></aside>
        <main className="flex-1 min-w-0 pb-24 md:pb-0">
          {isLoading ? (
            <div className="flex items-center justify-center h-[60vh] text-muted-foreground"><Loader2 className="mr-2 h-5 w-5 animate-spin" /> Loading TrustFive…</div>
          ) : (<div className="mx-auto max-w-6xl px-4 sm:px-6 py-6">{Section()}</div>)}
        </main>
      </div>
      <MobileNav />
      <footer className="mt-auto border-t bg-card/50 hidden md:block">
        <div className="mx-auto max-w-6xl px-4 py-3 flex items-center justify-between text-xs text-muted-foreground">
          <span>TrustFive — trades marketplace with five-slot network & community social. {me?.name ? `Signed in as ${me.name}.` : ''}</span>
          <span>B2B + B2C · 5-slot network · 116 features unified</span>
        </div>
      </footer>
    </div>
  )
}