'use client'

import Link from 'next/link'
import {
  Newspaper, Users, ShoppingBag, Briefcase, Wrench, Group as GroupIcon,
  CalendarDays, Building2, MessageSquare, Bell, Map, UserCircle, Shield,
  GraduationCap, Heart, Compass, LayoutGrid, Search, Handshake, LifeBuoy,
} from 'lucide-react'
import { useAppStore, type SectionKey } from '@/stores/app-store'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'

const NAV: { key: SectionKey; label: string; icon: any; group: string }[] = [
  { key: 'trade-finder', label: 'Trade Finder', icon: Search, group: 'TrustFive' },
  { key: 'services', label: 'Book a Service', icon: Wrench, group: 'TrustFive' },
  { key: 'b2b', label: 'B2B Network', icon: Handshake, group: 'TrustFive' },
  { key: 'support', label: 'Support', icon: LifeBuoy, group: 'TrustFive' },
  { key: 'feed', label: 'Community Feed', icon: Newspaper, group: 'Community' },
  { key: 'network', label: 'Network', icon: Users, group: 'Community' },
  { key: 'groups', label: 'Groups', icon: GroupIcon, group: 'Community' },
  { key: 'events', label: 'Events', icon: CalendarDays, group: 'Community' },
  { key: 'pages', label: 'Pages', icon: Building2, group: 'Community' },
  { key: 'messages', label: 'Messages', icon: MessageSquare, group: 'Community' },
  { key: 'notifications', label: 'Notifications', icon: Bell, group: 'Community' },
  { key: 'marketplace', label: 'Marketplace', icon: ShoppingBag, group: 'Community' },
  { key: 'map', label: 'Neighbourhood Map', icon: Map, group: 'Community' },
  { key: 'jobs', label: 'Jobs', icon: Briefcase, group: 'Professional' },
  { key: 'learning', label: 'Learning', icon: GraduationCap, group: 'Professional' },
  { key: 'coaching', label: 'Coaching', icon: Compass, group: 'Professional' },
  { key: 'fundraisers', label: 'Fundraisers', icon: Heart, group: 'Community' },
  { key: 'more', label: 'More', icon: LayoutGrid, group: 'Community' },
  { key: 'profile', label: 'Profile', icon: UserCircle, group: 'You' },
  { key: 'admin', label: 'Admin', icon: Shield, group: 'You' },
]

export function Sidebar({ me }: { me: any }) {
  const { section, setSection } = useAppStore()
  const groups: Record<string, typeof NAV> = {}
  for (const item of NAV) { groups[item.group] = groups[item.group] ?? []; groups[item.group].push(item) }
  return (
    <nav className="flex-1 overflow-y-auto scroll-thin px-3 py-4 space-y-5">
      <div className="px-2 flex items-center gap-2">
        <div className="h-9 w-9 rounded-xl brand-gradient flex items-center justify-center shadow-sm">
          <Shield className="h-5 w-5 text-white" />
        </div>
        <div className="flex flex-col">
          <span className="text-sm font-semibold tracking-tight">TrustFive</span>
          <span className="text-[10px] text-muted-foreground leading-none">Trades · Community · Trust</span>
        </div>
      </div>
      {Object.entries(groups).map(([group, items]) => (
        <div key={group} className="space-y-1">
          <div className="px-2 text-[10px] uppercase tracking-wider text-muted-foreground/80">{group}</div>
          {items.map((item) => {
            const Icon = item.icon
            const active = section === item.key
            return (
              <button key={item.key} onClick={() => setSection(item.key)}
                className={cn('w-full flex items-center gap-3 px-2.5 py-2 rounded-lg text-sm transition-colors',
                  active ? 'bg-sidebar-accent text-sidebar-accent-foreground font-medium' : 'text-sidebar-foreground hover:bg-sidebar-accent/60')}>
                <Icon className={cn('h-4 w-4 shrink-0', active ? 'text-primary' : 'text-muted-foreground')} />
                <span className="truncate">{item.label}</span>
                {item.key === 'trade-finder' && <Badge variant="secondary" className="ml-auto text-[10px] py-0 px-1.5 h-4 bg-amber-500/15 text-amber-700 dark:text-amber-400">5-slot</Badge>}
                {item.key === 'b2b' && <Badge variant="secondary" className="ml-auto text-[10px] py-0 px-1.5 h-4">B2B</Badge>}
              </button>
            )
          })}
        </div>
      ))}
      {me && (
        <div className="px-2 pt-4 border-t mt-4">
          <div className="flex items-center gap-2">
            <img src={me.avatarUrl} alt={me.name} className="h-8 w-8 rounded-full object-cover" />
            <div className="min-w-0">
              <div className="text-sm font-medium truncate">{me.name}</div>
              <div className="text-[11px] text-muted-foreground truncate">{me.email}</div>
            </div>
          </div>
        </div>
      )}
      <Link href="#" className="block px-2 text-[11px] text-muted-foreground/70 hover:text-muted-foreground">About · Help · Privacy · Terms</Link>
    </nav>
  )
}