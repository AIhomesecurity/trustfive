'use client'
import { Heart, MessageCircle, Share2, MapPin, Image as ImageIcon } from 'lucide-react'

const posts = [
  {
    name: 'Sarah M.', district: 'Harrogate · HG2', time: '12m ago',
    text: "Anyone used the new plumber on TrustFive? Daniel Reed sorted our burst pipe in under an hour — spotless job, would recommend.",
    seed: 'feed-plumber-rec', img: 'https://picsum.photos/seed/feed-plumber-rec/800/500',
  },
  {
    name: 'Neighbourhood Watch', district: 'Knaresborough · HG5', time: '2h ago',
    text: 'Lost cat near the castle — ginger tabby called Biscuit, answers to his name. Reward for any sighting. Photo below.',
    seed: 'feed-lost-cat', img: 'https://picsum.photos/seed/feed-lost-cat/800/500',
  },
  {
    name: 'Harrogate Fix-It Club', district: 'Harrogate · HG1', time: '5h ago',
    text: 'Saturday tool-share at the community hall. Bring what you don\'t need, take what you do. Tea & biscuits provided.',
    seed: 'feed-fixit-event', img: 'https://picsum.photos/seed/feed-fixit-event/800/500',
  },
]

export function Feed() {
  return (
    <div className="max-w-2xl mx-auto px-4 lg:px-6 py-6">
      <div className="mb-6">
        <h1 className="text-xl font-semibold">Your neighbourhood</h1>
        <p className="text-sm text-slate-500">Harrogate & nearby districts · 1,204 neighbours</p>
      </div>

      {/* Compose */}
      <div className="bg-white rounded-xl border border-slate-200 p-3 mb-6 flex items-center gap-3">
        <div className="w-9 h-9 rounded-full bg-gradient-to-br from-slate-700 to-slate-900 text-white text-xs font-semibold flex items-center justify-center">JD</div>
        <input placeholder="Share something with your neighbourhood…" className="flex-1 h-10 px-3 rounded-lg bg-slate-100 outline-none text-sm" />
        <button className="w-9 h-9 rounded-lg text-slate-500 hover:bg-slate-100 flex items-center justify-center"><ImageIcon className="w-5 h-5" /></button>
      </div>

      {/* Feed */}
      <div className="space-y-5">
        {posts.map((p) => (
          <article key={p.seed} className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <div className="p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-emerald-500 to-teal-500 text-white text-sm font-semibold flex items-center justify-center">{p.name[0]}</div>
              <div>
                <div className="text-sm font-medium">{p.name}</div>
                <div className="text-xs text-slate-500 flex items-center gap-1"><MapPin className="w-3 h-3" /> {p.district} · {p.time}</div>
              </div>
            </div>
            <p className="px-4 pb-3 text-sm text-slate-700">{p.text}</p>
            <img src={p.img} alt="" className="w-full h-64 object-cover" />
            <div className="flex items-center gap-6 px-4 py-3 text-slate-500 text-sm">
              <button className="flex items-center gap-1.5 hover:text-rose-500"><Heart className="w-4 h-4" /> 24</button>
              <button className="flex items-center gap-1.5 hover:text-emerald-600"><MessageCircle className="w-4 h-4" /> 6</button>
              <button className="flex items-center gap-1.5 hover:text-slate-700"><Share2 className="w-4 h-4" /> Share</button>
            </div>
          </article>
        ))}
      </div>
    </div>
  )
}
