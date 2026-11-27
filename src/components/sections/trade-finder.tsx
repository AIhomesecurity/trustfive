'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { useAppStore } from '@/stores/app-store'
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import {
  Search, MapPin, Star, Shield, Wrench, Zap, ArrowRight, Users, CheckCircle2, Clock, AlertCircle, Award,
} from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

const TRADES = [
  'Plumbing', 'Electrical', 'Gas Safe', 'Heating', 'Roofing', 'Carpentry',
  'Painting & Decorating', 'Tiling', ' plastering', 'Landscaping', 'Cleaning', 'Security Systems',
  'CCTV Installation', 'Burglar Alarms', 'Locksmith', 'Glazing', 'Drywall', 'Flooring',
]

export function TradeFinderSection() {
  const { currentUserId, setProfileUserId, setSection } = useAppStore()
  const [tab, setTab] = useState('search')
  const [selectedTrade, setSelectedTrade] = useState('')
  const [selectedDistrict, setSelectedDistrict] = useState('')

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold tracking-tight flex items-center gap-2">
          <Search className="h-5 w-5 text-primary" /> Trade Finder
        </h1>
        <p className="text-xs text-muted-foreground">
          Find vetted, approved tradespeople. The <strong className="text-amber-600">five-slot network</strong> guarantees
          only 5 approved providers per trade per district — quality over quantity.
        </p>
      </div>

      <div className="rounded-lg border border-amber-200 dark:border-amber-900 bg-amber-50 dark:bg-amber-950/20 p-3 flex items-start gap-3">
        <Shield className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
        <div className="text-xs text-amber-800 dark:text-amber-300">
          <strong>How TrustFive is different:</strong> Unlike open directories (Checkatrade, Bark), TrustFive caps each
          trade at 5 approved providers per district. Every approved pro gets enough work, customers get vetted quality,
          and competition is based on trust — not price wars.
        </div>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="h-8 flex-wrap">
          <TabsTrigger value="search" className="text-xs">Search trades</TabsTrigger>
          <TabsTrigger value="slots" className="text-xs">Five-slot map</TabsTrigger>
          <TabsTrigger value="apply" className="text-xs">Apply for a slot</TabsTrigger>
          <TabsTrigger value="wizard" className="text-xs">Guided questionnaire</TabsTrigger>
        </TabsList>

        <TabsContent value="search" className="mt-4">
          <SearchTrades selectedTrade={selectedTrade} setSelectedTrade={setSelectedTrade}
            selectedDistrict={selectedDistrict} setSelectedDistrict={setSelectedDistrict}
            onOpenProfile={(id: string) => { setProfileUserId(id); setSection('profile') }}
            onQuestionWizard={(trade: string) => { setSelectedTrade(trade); setTab('wizard') }} />
        </TabsContent>
        <TabsContent value="slots" className="mt-4"><SlotsMap /></TabsContent>
        <TabsContent value="apply" className="mt-4"><ApplyForSlot userId={currentUserId} /></TabsContent>
        <TabsContent value="wizard" className="mt-4">
          <QuestionWizard trade={selectedTrade || 'Plumbing'} userId={currentUserId} onDone={() => setTab('search')} />
        </TabsContent>
      </Tabs>
    </div>
  )
}

function SearchTrades({ selectedTrade, setSelectedTrade, selectedDistrict, setSelectedDistrict, onOpenProfile, onQuestionWizard }: any) {
  const { data: slotsData } = useQuery({
    queryKey: ['trade-slots', selectedTrade, selectedDistrict],
    queryFn: () => api<any>(`/api/trade-slots?trade=${selectedTrade}&districtId=${selectedDistrict}`),
    enabled: !!selectedTrade,
  })
  const { data: districtsData } = useQuery({ queryKey: ['districts'], queryFn: () => api<any>('/api/districts') })
  const districts = districtsData?.districts ?? []
  const slots = slotsData?.slots ?? []

  return (
    <div className="space-y-4">
      <Card><CardContent className="p-4">
        <div className="grid sm:grid-cols-2 gap-3">
          <div><Label className="text-xs">Trade</Label>
            <Select value={selectedTrade} onValueChange={setSelectedTrade}>
              <SelectTrigger className="mt-1"><SelectValue placeholder="Select a trade…" /></SelectTrigger>
              <SelectContent>{TRADES.filter((t: string) => t.trim()).map((t: string) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div><Label className="text-xs">District</Label>
            <Select value={selectedDistrict} onValueChange={setSelectedDistrict}>
              <SelectTrigger className="mt-1"><SelectValue placeholder="All districts" /></SelectTrigger>
              <SelectContent>{districts.map((d: any) => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
        </div>
        {selectedTrade && <Button variant="outline" size="sm" className="mt-3 text-xs" onClick={() => onQuestionWizard(selectedTrade)}>
          <Zap className="mr-1 h-3 w-3" /> Not sure? Use the guided questionnaire</Button>}
      </CardContent></Card>

      {!selectedTrade && (
        <div className="grid sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {TRADES.filter((t: string) => t.trim()).map((trade: string) => (
            <Card key={trade} className="hover:shadow-md transition-shadow cursor-pointer" onClick={() => setSelectedTrade(trade)}>
              <CardContent className="p-4 text-center"><Wrench className="h-6 w-6 mx-auto text-primary mb-2" /><div className="text-sm font-medium">{trade}</div></CardContent>
            </Card>
          ))}
        </div>
      )}

      {selectedTrade && slots.length > 0 && (
        <div className="space-y-3">
          {slots.map((slot: any) => (
            <Card key={slot.id}>
              <CardHeader className="pb-2"><div className="flex items-center justify-between">
                <CardTitle className="text-sm flex items-center gap-2"><MapPin className="h-4 w-4 text-muted-foreground" />{slot.district.name}
                  <Badge variant="outline" className="text-[10px] py-0 h-4">{slot.tradeName}</Badge></CardTitle>
                <SlotBadge filled={slot.filledSlots} max={slot.maxSlots} />
              </div></CardHeader>
              <CardContent>
                {slot.approvedProviders.length > 0 ? (
                  <div className="space-y-2">
                    {slot.approvedProviders.map((p: any, i: number) => (
                      <div key={p.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted">
                        <span className="text-xs font-bold text-muted-foreground w-5">#{p.rank}</span>
                        <button onClick={() => onOpenProfile(p.id)}><Avatar className="h-9 w-9"><AvatarImage src={p.avatarUrl} /><AvatarFallback>{p.name?.[0]}</AvatarFallback></Avatar></button>
                        <div className="flex-1 min-w-0"><div className="text-sm font-medium">{p.name}</div>
                          <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                            <span className="flex items-center gap-0.5"><Star className="h-3 w-3 text-amber-500 fill-amber-500" /> 4.{8 + i}</span>
                            <span>·</span><span className="flex items-center gap-0.5"><Shield className="h-3 w-3 text-emerald-500" /> Approved #{p.rank}</span>
                          </div></div>
                        <Button size="sm" variant="outline" className="text-xs" onClick={() => onOpenProfile(p.id)}>View</Button>
                      </div>
                    ))}
                  </div>
                ) : (<div className="text-center py-4 text-sm text-muted-foreground">No approved providers yet in {slot.district.name} for {slot.tradeName}.
                  <Button size="sm" variant="link" className="text-xs">Be the first — apply for a slot</Button></div>)}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
      {selectedTrade && slots.length === 0 && <div className="text-center text-sm text-muted-foreground py-12">No trade slots found for {selectedTrade}. Try a different district or trade.</div>}
    </div>
  )
}

function SlotBadge({ filled, max }: { filled: number; max: number }) {
  const available = max - filled
  if (available === 0) return <Badge className="text-[10px] py-0 h-4 bg-rose-500">Full ({filled}/{max})</Badge>
  if (available <= 1) return <Badge className="text-[10px] py-0 h-4 bg-amber-500">{available} slot left</Badge>
  return <Badge className="text-[10px] py-0 h-4 bg-emerald-500">{available}/{max} slots open</Badge>
}

function SlotsMap() {
  const { data } = useQuery({ queryKey: ['trade-slots-all'], queryFn: () => api<any>('/api/trade-slots') })
  const slots = data?.slots ?? []
  const byDistrict = slots.reduce((acc: any, s: any) => { const d = s.district.name; acc[d] = acc[d] ?? { district: s.district, slots: [] }; acc[d].slots.push(s); return acc }, {})

  return (
    <div className="space-y-3">
      <div className="text-xs text-muted-foreground">Live five-slot availability across all districts and trades.</div>
      {Object.values(byDistrict).map((entry: any) => (
        <Card key={entry.district.id}>
          <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><MapPin className="h-4 w-4 text-primary" /> {entry.district.name}
            <span className="text-[11px] text-muted-foreground font-normal">{entry.district.region}</span></CardTitle></CardHeader>
          <CardContent><div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {entry.slots.map((s: any) => (
              <div key={s.id} className="p-2 rounded-lg border flex items-center gap-2"><Wrench className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-xs flex-1 truncate">{s.tradeName}</span><SlotBadge filled={s.filledSlots} max={s.maxSlots} /></div>
            ))}</div></CardContent>
        </Card>
      ))}
      {slots.length === 0 && <div className="text-center text-sm text-muted-foreground py-12">No slots data yet. Run seed to populate.</div>}
    </div>
  )
}

function ApplyForSlot({ userId }: { userId: string | null }) {
  const qc = useQueryClient()
  const [tradeName, setTradeName] = useState('')
  const [districtId, setDistrictId] = useState('')
  const { data: districtsData } = useQuery({ queryKey: ['districts'], queryFn: () => api<any>('/api/districts') })
  const districts = districtsData?.districts ?? []
  const apply = useMutation({
    mutationFn: () => api<any>('/api/trade-approval/apply', { method: 'POST', body: JSON.stringify({ userId, tradeName, districtId }) }),
    onSuccess: (data) => { qc.invalidateQueries({ queryKey: ['trade-slots'] }); if (data.approval.status === 'APPROVED') toast.success(`Approved! You are provider #${data.approval.rank}.`); else toast.info(`Waitlisted — all slots full. You are position #${data.approval.rank}.`) },
  })

  return (
    <div className="space-y-4">
      <Card className="max-w-xl">
        <CardHeader><CardTitle className="text-base">Apply for a five-slot</CardTitle>
          <p className="text-xs text-muted-foreground">Apply to be one of the 5 approved providers for your trade in a district. If all 5 slots are filled, you join the waiting list.</p></CardHeader>
        <CardContent className="space-y-3">
          <div><Label className="text-xs">Your trade</Label><Select value={tradeName} onValueChange={setTradeName}><SelectTrigger className="mt-1"><SelectValue placeholder="Select your trade…" /></SelectTrigger>
            <SelectContent>{TRADES.filter((t: string) => t.trim()).map((t: string) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent></Select></div>
          <div><Label className="text-xs">District you cover</Label><Select value={districtId} onValueChange={setDistrictId}><SelectTrigger className="mt-1"><SelectValue placeholder="Select a district…" /></SelectTrigger>
            <SelectContent>{districts.map((d: any) => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}</SelectContent></Select></div>
        </CardContent>
        <CardFooter><Button onClick={() => apply.mutate()} disabled={!tradeName || !districtId || apply.isPending}>{apply.isPending ? 'Applying…' : 'Apply for approval'}</Button></CardFooter>
      </Card>
    </div>
  )
}

const WIZARD_STEPS: Record<string, { q: string; key: string; opts: string[] }[]> = {
  Plumbing: [
    { q: 'What do you need?', key: 'jobType', opts: ['Leak repair', 'New installation', 'Boiler service', 'Bathroom fitting', 'Emergency callout'] },
    { q: 'When do you need it?', key: 'timing', opts: ['ASAP — emergency', 'This week', 'Next 2 weeks', 'Within a month', 'Flexible'] },
    { q: 'Property type?', key: 'property', opts: ['House', 'Flat', 'Commercial', 'New build'] },
  ],
  Electrical: [
    { q: 'What do you need?', key: 'jobType', opts: ['Fault repair', 'New wiring', 'Fuse board upgrade', 'Lighting installation', 'EICR inspection'] },
    { q: 'When do you need it?', key: 'timing', opts: ['ASAP — emergency', 'This week', 'Next 2 weeks', 'Within a month', 'Flexible'] },
    { q: 'Property type?', key: 'property', opts: ['House', 'Flat', 'Commercial', 'New build'] },
  ],
  'Gas Safe': [
    { q: 'What do you need?', key: 'jobType', opts: ['Boiler repair', 'Boiler installation', 'Gas safety check (CP12)', 'Carbon monoxide check', 'Emergency'] },
    { q: 'When do you need it?', key: 'timing', opts: ['ASAP — emergency', 'This week', 'Next 2 weeks', 'Within a month', 'Flexible'] },
    { q: 'Boiler type?', key: 'boiler', opts: ['Combi', 'System', 'Heat-only', 'Not sure'] },
  ],
}

function QuestionWizard({ trade, userId, onDone }: { trade: string; userId: string | null; onDone: () => void }) {
  const steps = WIZARD_STEPS[trade] ?? WIZARD_STEPS['Plumbing']
  const [step, setStep] = useState(0)
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const current = steps[step]
  const isLast = step === steps.length - 1
  const createJob = useMutation({
    mutationFn: () => api<any>('/api/service-jobs', { method: 'POST', body: JSON.stringify({ customerId: userId, categoryId: trade, title: `${trade} — ${answers.jobType ?? 'job'}`, description: Object.entries(answers).map(([k, v]) => `${k}: ${v}`).join(', '), timing: answers.timing, location: 'District-level (privacy protected)', status: 'OPEN', answers: JSON.stringify(answers) }) }),
    onSuccess: () => { toast.success('Your request has been posted! Approved providers in your district will be notified.'); onDone() },
  })

  return (
    <Card className="max-w-xl">
      <CardHeader><CardTitle className="text-base flex items-center gap-2"><Zap className="h-4 w-4 text-primary" /> {trade} — guided request</CardTitle>
        <div className="flex items-center gap-1 mt-2">{steps.map((_, i) => (<div key={i} className={cn('h-1.5 flex-1 rounded-full', i <= step ? 'bg-primary' : 'bg-muted')} />))}</div></CardHeader>
      <CardContent className="space-y-3"><div><Label className="text-sm font-medium">{current.q}</Label>
        <div className="grid sm:grid-cols-2 gap-2 mt-2">{current.opts.map((opt) => (
          <button key={opt} onClick={() => setAnswers({ ...answers, [current.key]: opt })} className={cn('text-left text-sm p-3 rounded-lg border transition', answers[current.key] === opt ? 'border-primary bg-primary/5' : 'hover:bg-muted')}>{opt}</button>
        ))}</div></div></CardContent>
      <CardFooter className="justify-between">
        <Button variant="ghost" size="sm" onClick={() => step > 0 ? setStep(step - 1) : onDone()}>{step > 0 ? '← Back' : 'Cancel'}</Button>
        {isLast ? <Button size="sm" disabled={!answers[current.key] || createJob.isPending} onClick={() => createJob.mutate()}>{createJob.isPending ? 'Posting…' : 'Submit request →'}</Button>
          : <Button size="sm" disabled={!answers[current.key]} onClick={() => setStep(step + 1)}>Next →</Button>}
      </CardFooter>
    </Card>
  )
}
