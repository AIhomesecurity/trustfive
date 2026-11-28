'use client'
import { Award, Home, Plus, MessageSquare, User } from 'lucide-react'

const items = [
  { key: 'trade-finder', label: 'Find', icon: Award },
  { key: 'feed', label: 'Community', icon: Home },
  { key: 'post', label: 'Post', icon: Plus, primary: true },
  { key: 'chat', label: 'Chat', icon: MessageSquare },
  { key: 'me', label: 'Me', icon: User },
]

export function MobileNav({ active, onNavigate }: { active: string; onNavigate: (k: string) => void }) {
  return (
    <nav className="lg:hidden fixed bottom-0 inset-x-0 z-30 bg-white border-t border-slate-200 flex items-center justify-around h-16 px-2">
      {items.map((it) => {
        const Icon = it.icon
        if (it.primary) {
          return (
            <button key={it.label} className="-mt-6 w-12 h-12 rounded-full bg-gradient-to-br from-emerald-600 to-teal-500 text-white flex items-center justify-center shadow-lg shadow-emerald-200">
              <Icon className="w-6 h-6" />
            </button>
          )
        }
        const isActive = active === it.key
        return (
          <button key={it.label} onClick={() => onNavigate(it.key)} className={`flex flex-col items-center gap-0.5 px-2 py-1 ${isActive ? 'text-emerald-600' : 'text-slate-500'}`}>
            <Icon className="w-5 h-5" />
            <span className="text-[10px]">{it.label}</span>
          </button>
        )
      })}
    </nav>
  )
}
