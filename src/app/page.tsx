'use client'

import { useEffect, useState } from 'react'
import { useAppStore } from '@/stores/app-store'

// TrustFive platform — initial Vercel deployment.
// Full section components (feed, network, groups, events, pages, messages,
// marketplace, jobs, services, map, profile, admin, learning, fundraisers,
// coaching, more, trade-finder, b2b, support) are in the source tree and
// being pushed to GitHub. Each push auto-redeploys on Vercel.

const SECTIONS = [
  { key: 'trade-finder', label: 'Trade Finder', desc: 'Five-slot network — find vetted, approved tradespeople', group: 'TrustFive' },
  { key: 'services', label: 'Book a Service', desc: 'Post a job, get quotes, hire, pay (escrow), review', group: 'TrustFive' },
  { key: 'b2b', label: 'B2B Network', desc: 'Tradespeople helping tradespeople — subcontractor requests', group: 'TrustFive' },
  { key: 'support', label: 'Support', desc: 'Booking disputes, refunds, trust concerns — human reviewed', group: 'TrustFive' },
  { key: 'feed', label: 'Community Feed', desc: 'Posts, reactions, comments, stories, polls, safety alerts', group: 'Community' },
  { key: 'network', label: 'Network', desc: 'Connections, haves & wants, skills with endorsements', group: 'Community' },
  { key: 'groups', label: 'Groups', desc: 'Public/private/hidden groups with admin roles', group: 'Community' },
  { key: 'events', label: 'Events', desc: 'RSVP, recurring, ticketing, calendar export', group: 'Community' },
  { key: 'pages', label: 'Pages', desc: 'Business and tradesperson pages with followers', group: 'Community' },
  { key: 'messages', label: 'Messages', desc: 'Real-time chat (1:1, group, job-linked) via Socket.io', group: 'Community' },
  { key: 'notifications', label: 'Notifications', desc: 'All activity notifications, read/unread', group: 'Community' },
  { key: 'marketplace', label: 'Marketplace', desc: 'Buy and sell locally, neighbourhood-scoped', group: 'Community' },
  { key: 'map', label: 'Neighbourhood Map', desc: 'Boundaries, real-time alerts, help requests', group: 'Community' },
  { key: 'jobs', label: 'Jobs', desc: 'Job board with Easy Apply, alerts, applicant tracking', group: 'Professional' },
  { key: 'learning', label: 'Learning', desc: 'Courses, skill assessments, certificates', group: 'Professional' },
  { key: 'coaching', label: 'Coaching', desc: 'Mentor directory with booking and scheduling', group: 'Professional' },
  { key: 'fundraisers', label: 'Fundraisers', desc: 'Donation campaigns with progress bars', group: 'Community' },
  { key: 'more', label: 'More', desc: 'Ads Manager, Premium, Resume Builder, Salary, 2FA, Safety Check', group: 'Community' },
  { key: 'profile', label: 'Profile', desc: 'Dual-mode (Personal + Pro/Tradesperson) with verification', group: 'You' },
  { key: 'admin', label: 'Admin', desc: 'Moderation queue, reports, verification review', group: 'You' },
] as const

export default function Home() {
  const { section, setSection } = useAppStore()
  const [deployed, setDeployed] = useState(false)

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setDeployed(window.location.hostname.includes('vercel.app'))
    }
  }, [])

  const groups: Record<string, typeof SECTIONS> = {}
  for (const item of SECTIONS) {
    groups[item.group] = groups[item.group] ?? []
    groups[item.group] = (groups[item.group] ?? []) as any
    ;(groups[item.group] as any).push(item)
  }

  const activeSection = SECTIONS.find((s) => s.key === section) ?? SECTIONS[0]

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', fontFamily: 'system-ui, sans-serif', background: '#fafafa', color: '#1a1a1a' }}>
      <header style={{ position: 'sticky', top: 0, zIndex: 40, borderBottom: '1px solid #e5e5e5', background: 'rgba(255,255,255,0.85)', backdropFilter: 'blur(8px)' }}>
        <div style={{ display: 'flex', height: '56px', alignItems: 'center', gap: '8px', padding: '0 16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'linear-gradient(135deg, #0d9488, #14b8a6, #f59e0b)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ color: 'white', fontSize: '16px', fontWeight: 'bold' }}>T5</span>
            </div>
            <span style={{ fontSize: '15px', fontWeight: 600 }}>TrustFive</span>
          </div>
          <span style={{ marginLeft: 'auto', fontSize: '12px', color: '#888' }}>Trades · Community · Trust</span>
        </div>
      </header>

      <div style={{ display: 'flex', flex: 1 }}>
        <aside style={{ width: '260px', borderRight: '1px solid #e5e5e5', padding: '16px 12px', position: 'sticky', top: '56px', height: 'calc(100vh - 56px)', overflowY: 'auto' }}>
          {Object.entries(groups).map(([group, items]) => (
            <div key={group} style={{ marginBottom: '20px' }}>
              <div style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#999', marginBottom: '4px', padding: '0 8px' }}>{group}</div>
              {(items as any).map((item: any) => (
                <button key={item.key} onClick={() => setSection(item.key)}
                  style={{
                    width: '100%', display: 'flex', alignItems: 'center', gap: '12px',
                    padding: '8px 10px', borderRadius: '8px', fontSize: '14px', border: 'none',
                    background: section === item.key ? '#f0fdfa' : 'transparent',
                    color: section === item.key ? '#0d9488' : '#555',
                    fontWeight: section === item.key ? 500 : 400, cursor: 'pointer',
                    textAlign: 'left', marginBottom: '2px', transition: 'background 0.15s',
                  }}>
                  <span style={{ width: '16px', textAlign: 'center' }}>•</span>
                  <span>{item.label}</span>
                </button>
              ))}
            </div>
          ))}
        </aside>

        <main style={{ flex: 1, minWidth: 0, padding: '24px', maxWidth: '900px', margin: '0 auto' }}>
          <div style={{ marginBottom: '16px' }}>
            <h1 style={{ fontSize: '24px', fontWeight: 600, margin: '0 0 4px 0' }}>{activeSection.label}</h1>
            <p style={{ fontSize: '14px', color: '#777', margin: 0 }}>{activeSection.desc}</p>
          </div>

          {deployed ? (
            <div style={{ padding: '32px', borderRadius: '12px', border: '1px solid #e5e5e5', background: 'white', textAlign: 'center' }}>
              <div style={{ fontSize: '48px', marginBottom: '16px' }}>🚀</div>
              <h2 style={{ fontSize: '18px', fontWeight: 600, margin: '0 0 8px 0' }}>TrustFive is live on Vercel</h2>
              <p style={{ fontSize: '14px', color: '#777', maxWidth: '400px', margin: '0 auto 24px' }}>
                The full app with {SECTIONS.length} sections, 60+ API routes, and the five-slot network
                is being deployed. Source files are being pushed to GitHub — each push triggers a new deployment.
              </p>
              <a href="https://github.com/AIhomesecurity/trustfive" target="_blank" rel="noopener"
                style={{ display: 'inline-block', padding: '8px 16px', borderRadius: '8px', background: '#0d9488', color: 'white', fontSize: '14px', textDecoration: 'none', fontWeight: 500 }}>
                View on GitHub →
              </a>
            </div>
          ) : (
            <div style={{ padding: '24px', borderRadius: '12px', border: '1px solid #e5e5e5', background: 'white' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: '12px' }}>
                {SECTIONS.map((s) => (
                  <div key={s.key} style={{ padding: '12px', borderRadius: '8px', border: '1px solid #eee', fontSize: '13px' }}>
                    <div style={{ fontWeight: 500, marginBottom: '4px' }}>{s.label}</div>
                    <div style={{ color: '#999', fontSize: '12px' }}>{s.desc}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div style={{ marginTop: '24px', padding: '20px', borderRadius: '12px', background: 'linear-gradient(135deg, #fffbeb, #fef3c7)', border: '1px solid #fde68a' }}>
            <h3 style={{ fontSize: '16px', fontWeight: 600, margin: '0 0 8px 0' }}>⚡ The Five-Slot Network</h3>
            <p style={{ fontSize: '13px', color: '#92400e', margin: 0, lineHeight: 1.6 }}>
              TrustFive's key differentiator from Checkatrade, Bark, and Rated People:
              only <strong>5 approved providers</strong> per trade per district. Every approved pro gets enough work,
              customers get a vetted shortlist, and competition is based on trust — not price wars.
            </p>
          </div>
        </main>
      </div>

      <footer style={{ marginTop: 'auto', borderTop: '1px solid #e5e5e5', padding: '12px 16px', fontSize: '12px', color: '#999', textAlign: 'center' }}>
        TrustFive — trades marketplace with five-slot network & community social · B2B + B2C · 20 sections · 60+ API routes
      </footer>
    </div>
  )
}
