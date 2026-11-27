'use client'

import { Search, Wrench, MessageSquare, UserCircle, Newspaper } from 'lucide-react'
import { useAppStore, type SectionKey } from '@/stores/app-store'
import { cn } from '@/lib/utils'

const MOBILE_NAV: { key: SectionKey; label: string; icon: any }[] = [
  { key: 'trade-finder', label: 'Find', icon: Search },
  { key: 'services', label: 'Book', icon: Wrench },
  { key: 'feed', label: 'Community', icon: Newspaper },
  { key: 'messages', label: 'Chat', icon: MessageSquare },
  { key: 'profile', label: 'Me', icon: UserCircle },
]

export function MobileNav() {
  const { section, setSection } = useAppStore()
  return (
    <nav className="md:hidden fixed bottom-0 inset-x-0 z-40 border-t bg-background/95 backdrop-blur">
      <div className="grid grid-cols-5">
        {MOBILE_NAV.map((item) => {
          const Icon = item.icon
          const active = section === item.key
          return (
            <button key={item.key} onClick={() => setSection(item.key)}
              className={cn('flex flex-col items-center justify-center gap-0.5 py-2.5 text-[10px] transition-colors min-h-[56px]',
                active ? 'text-primary' : 'text-muted-foreground')}>
              <Icon className="h-5 w-5" /><span>{item.label}</span>
            </button>
          )
        })}
      </div>
    </nav>
  )
}