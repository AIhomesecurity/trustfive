'use client'
import { Award, Home, Users, Calendar, ShoppingBag, FileText, Briefcase, Wrench, GraduationCap, LifeBuoy, User, Bell, Settings } from 'lucide-react'

type Icon = React.ComponentType<{ className?: string }>
type NavItem = { key: string; label: string; icon: Icon }
type Group = { title: string; items: NavItem[] }

const groups: Group[] = [
  { title: 'TrustFive', items: [
    { key: 'trade-finder', label: 'Find a Trade', icon: Award },
    { key: 'feed', label: 'Community Feed', icon: Home },
  ]},
  { title: 'Community', items: [
    { key: 'feed', label: 'Groups', icon: Users },
    { key: 'feed', label: 'Events', icon: Calendar },
    { key: 'feed', label: 'Marketplace', icon: ShoppingBag },
    { key: 'feed', label: 'Pages', icon: FileText },
  ]},
  { title: 'Professional', items: [
    { key: 'feed', label: 'B2B Hub', icon: Briefcase },
    { key: 'feed', label: 'Jobs', icon: Wrench },
    { key: 'feed', label: 'Coaching', icon: GraduationCap },
    { key: 'feed', label: 'Support', icon: LifeBuoy },
  ]},
  { title: 'You', items: [
    { key: 'feed', label: 'Profile', icon: User },
    { key: 'feed', label: 'Notifications', icon: Bell },
    { key: 'feed', label: 'Settings', icon: Settings },
  ]},
]

export function Sidebar({ active, onNavigate }: { active: string; onNavigate: (k: string) => void }) {
  return (
    <aside className="hidden lg:flex flex-col w-64 shrink-0 border-r border-slate-200 bg-white h-screen sticky top-0">
      <div className="px-5 py-5 flex items-center gap-3 border-b border-slate-100">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-600 via-teal-500 to-amber-400 flex items-center justify-center text-white font-bold shadow-sm">T5</div>
        <div>
          <div className="font-semibold text-slate-900 leading-tight">TrustFive</div>
          <div className="text-[11px] text-slate-500">5 slots · 5 stars · 5 neighbours</div>
        </div>
      </div>
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-6">
        {groups.map((g) => (
          <div key={g.title}>
            <div className="px-3 mb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-400">{g.title}</div>
            <div className="space-y-1">
              {g.items.map((it) => {
                const Icon = it.icon
                const isActive = g.title === 'TrustFive' && active === it.key
                return (
                  <button
                    key={it.label}
                    onClick={() => onNavigate(it.key)}
                    className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition ${
                      isActive ? 'bg-emerald-50 text-emerald-700 font-medium' : 'text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <Icon className="w-4 h-4" /> {it.label}
                  </button>
                )
              })}
            </div>
          </div>
        ))}
      </nav>
      <div className="px-4 py-3 border-t border-slate-100 text-[11px] text-slate-400">© TrustFive · Preview build</div>
    </aside>
  )
}
