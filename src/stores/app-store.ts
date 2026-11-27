'use client'

import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type SectionKey =
  | 'feed'
  | 'network'
  | 'marketplace'
  | 'jobs'
  | 'services'
  | 'groups'
  | 'events'
  | 'pages'
  | 'messages'
  | 'notifications'
  | 'map'
  | 'profile'
  | 'admin'
  | 'learning'
  | 'fundraisers'
  | 'coaching'
  | 'more'
  | 'trade-finder'
  | 'b2b'
  | 'support'

interface AppState {
  section: SectionKey
  setSection: (s: SectionKey) => void
  currentUserId: string | null
  setCurrentUserId: (id: string | null) => void
  activeConversationId: string | null
  setActiveConversationId: (id: string | null) => void
  profileUserId: string | null
  setProfileUserId: (id: string | null) => void
  sidebarOpen: boolean
  setSidebarOpen: (open: boolean) => void
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      section: 'feed',
      setSection: (section) => set({ section }),
      currentUserId: null,
      setCurrentUserId: (currentUserId) => set({ currentUserId }),
      activeConversationId: null,
      setActiveConversationId: (activeConversationId) => set({ activeConversationId }),
      profileUserId: null,
      setProfileUserId: (profileUserId) => set({ profileUserId }),
      sidebarOpen: false,
      setSidebarOpen: (sidebarOpen) => set({ sidebarOpen }),
    }),
    {
      name: 'nexus-app',
      partialize: (s) => ({ section: s.section, currentUserId: s.currentUserId }),
    },
  ),
)