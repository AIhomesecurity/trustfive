'use client'
import { Star, ShieldCheck, Clock, MapPin, ArrowRight, BadgeCheck } from 'lucide-react'

const trades = [
  { name: 'Plumbers', seed: 'plumbing', count: 4 },
  { name: 'Electricians', seed: 'electrician', count: 5 },
  { name: 'Carpenters', seed: 'carpentry', count: 3 },
  { name: 'Painters', seed: 'painting', count: 5 },
  { name: 'Roofers', seed: 'roofing', count: 2 },
  { name: 'Gardeners', seed: 'gardening', count: 5 },
  { name: 'Plasterers', seed: 'plastering', count: 1 },
  { name: 'Scaffolders', seed: 'scaffolding', count: 4 },
]

const pros = [
  { name: 'Daniel Reed', trade: 'Plumber', district: 'Harrogate · HG2', rating: 4.9, jobs: 127, response: '1h', seed: 'pro-plumber-reed' },
  { name: 'Aisha Khan', trade: 'Electrician', district: 'Harrogate · HG1', rating: 5.0, jobs: 94, response: '2h', seed: 'pro-electric-khan' },
  { name: 'Mark Sullivan', trade: 'Carpenter', district: 'Knaresborough · HG5', rating: 4.8, jobs: 211, response: '3h', seed: 'pro-carpenter-sullivan' },
]

const stats = [
  { label: 'Max pros per trade per district', value: '5' },
  { label: 'Verified & insured', value: '100%' },
  { label: 'Average rating', value: '4.9★' },
  { label: 'Avg. response time', value: '1.5h' },
]

export function TradeFinder() {
  return (
    <div>
      {/* Hero */}
      <section className="relative">
        <img
          src="https://picsum.photos/seed/trustfive-hero-trades/1600/700"
          alt="Local tradesperson at work"
          className="absolute inset-0 w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-slate-900/85 via-slate-900/70 to-emerald-900/40" />
        <div className="relative px-6 lg:px-10 py-16 lg:py-24 max-w-3xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/20 border border-emerald-400/30 text-emerald-200 text-xs font-medium mb-4">
            <ShieldCheck className="w-3.5 h-3.5" /> Five-Slot Verified Network
          </div>
          <h1 className="text-3xl lg:text-5xl font-bold text-white leading-tight">
            Find your five-star<br />local tradesperson.
          </h1>
          <p className="mt-4 text-slate-200 text-base lg:text-lg max-w-xl">
            Only 5 approved, vetted pros per trade per district — so every one of them gets enough work, and you get a shortlist you can trust.
          </p>
          <div className="mt-6 flex flex-col sm:flex-row gap-3 bg-white/10 backdrop-blur p-2 rounded-xl border border-white/20 max-w-xl">
            <input placeholder="Your postcode (e.g. HG2 7JA)" className="flex-1 h-11 px-4 rounded-lg bg-white text-slate-900 outline-none text-sm" />
            <select className="h-11 px-3 rounded-lg bg-white text-slate-900 text-sm">
              <option>Any trade</option>
              {trades.map((t) => <option key={t.name}>{t.name}</option>)}
            </select>
            <button className="h-11 px-5 rounded-lg bg-gradient-to-r from-emerald-500 to-teal-500 text-white font-medium text-sm flex items-center gap-2 hover:opacity-95">
              Search <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </section>

      {/* Trust stats */}
      <section className="border-b border-slate-200 bg-white">
        <div className="max-w-6xl mx-auto grid grid-cols-2 lg:grid-cols-4 divide-x divide-slate-100">
          {stats.map((s) => (
            <div key={s.label} className="px-6 py-5 text-center">
              <div className="text-2xl font-bold text-emerald-600">{s.value}</div>
              <div className="text-xs text-slate-500 mt-1">{s.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Popular trades */}
      <section className="max-w-6xl mx-auto px-6 lg:px-10 py-12">
        <div className="flex items-end justify-between mb-6">
          <div>
            <h2 className="text-xl font-semibold">Popular trades near you</h2>
            <p className="text-sm text-slate-500">Slots shown = approved pros live in your district</p>
          </div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {trades.map((t) => (
            <button key={t.name} className="group relative rounded-xl overflow-hidden border border-slate-200 bg-white text-left hover:shadow-md transition">
              <div className="relative h-28">
                <img src={`https://picsum.photos/seed/${t.seed}/400/300`} alt={t.name} className="w-full h-full object-cover" />
                <div className="absolute top-2 right-2 px-2 py-0.5 rounded-full bg-black/60 text-white text-[10px] font-medium">{t.count}/5 slots</div>
              </div>
              <div className="p-3">
                <div className="font-medium text-sm">{t.name}</div>
                <div className="text-xs text-slate-500 flex items-center gap-1 mt-0.5"><MapPin className="w-3 h-3" /> Harrogate</div>
              </div>
            </button>
          ))}
        </div>
      </section>

      {/* Top-rated list — Checkatrade-style */}
      <section className="max-w-6xl mx-auto px-6 lg:px-10 pb-16">
        <h2 className="text-xl font-semibold mb-6">Top-rated near you</h2>
        <div className="space-y-4">
          {pros.map((p) => (
            <div key={p.name} className="bg-white rounded-xl border border-slate-200 p-4 flex flex-col sm:flex-row gap-4 hover:shadow-md transition">
              <img src={`https://picsum.photos/seed/${p.seed}/200/200`} alt={p.name} className="w-full sm:w-24 h-24 rounded-lg object-cover" />
              <div className="flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold">{p.name}</span>
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-[11px] font-medium"><BadgeCheck className="w-3 h-3" /> Verified</span>
                  <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 text-[11px]">{p.trade}</span>
                </div>
                <div className="text-sm text-slate-500 mt-1 flex items-center gap-1"><MapPin className="w-3.5 h-3.5" /> {p.district}</div>
                <div className="flex flex-wrap gap-x-5 gap-y-1 mt-3 text-sm">
                  <span className="flex items-center gap-1 text-amber-500 font-medium"><Star className="w-4 h-4 fill-amber-400" /> {p.rating.toFixed(1)}</span>
                  <span className="text-slate-600">{p.jobs} jobs completed</span>
                  <span className="flex items-center gap-1 text-slate-600"><Clock className="w-3.5 h-3.5" /> replies in ~{p.response}</span>
                </div>
              </div>
              <div className="flex sm:flex-col gap-2 sm:justify-center">
                <button className="flex-1 sm:w-32 h-10 rounded-lg bg-gradient-to-r from-emerald-500 to-teal-500 text-white font-medium text-sm">Request quote</button>
                <button className="flex-1 sm:w-32 h-10 rounded-lg border border-slate-200 text-slate-700 text-sm hover:bg-slate-50">View profile</button>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}
