'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { useAppStore } from '@/stores/app-store'
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Handshake, Plus, MapPin, Calendar, Users, MessageSquare, CheckCircle2, ArrowRight } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { formatDistanceToNow, format } from 'date-fns'

const STATUS_COLOR: Record<string, string> = {
  OPEN: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
  INTERESTED: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
  CLOSED: 'bg-muted text-muted-foreground',
}

const TRADES = ['Plumbing', 'Electrical', 'Gas Safe', 'Heating', 'Roofing', 'Carpentry', 'Painting & Decorating', 'Tiling', 'Landscaping', 'Security Systems', 'CCTV Installation']

export function B2BSection() {
  const { currentUserId, setProfileUserId, setSection } = useAppStore()
  const [tab, setTab] = useState('browse')
  const [createOpen, setCreateOpen] = useState(false)

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold tracking-tight flex items-center gap-2">
          <Handshake className="h-5 w-5 text-primary" /> B2B Network
        </h1>
        <p className="text-xs text-muted-foreground">
          Tradespeople helping tradespeople. Post when you need a subcontractor, or browse open requests from other approved pros.
        </p>
      </div>

      <div className="rounded-lg border border-primary/20 bg-primary/5 p-3 flex items-start gap-3">
        <Users className="h-5 w-5 text-primary shrink-0 mt-0.5" />
        <div className="text-xs text-muted-foreground">
          <strong className="text-foreground">B2B only.</strong> These requests are between tradespeople — no customer data
          is stored on B2B rows. Status transitions are server-side only. Only approved five-slot providers can post and respond.
        </div>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <div className="flex items-center justify-between">
          <TabsList className="h-8">
            <TabsTrigger value="browse" className="text-xs">Open requests</TabsTrigger>
            <TabsTrigger value="mine" className="text-xs">My requests</TabsTrigger>
            <TabsTrigger value="interests" className="text-xs">Interests received</TabsTrigger>
          </TabsList>
          <Button size="sm" className="text-xs" onClick={() => setCreateOpen(true)}>
            <Plus className="mr-1 h-3 w-3" /> Post a request
          </Button>
        </div>

        <TabsContent value="browse" className="mt-4">
          <BrowseRequests userId={currentUserId} onOpenProfile={(id) => { setProfileUserId(id); setSection('profile') }} />
        </TabsContent>
        <TabsContent value="mine" className="mt-4"><MyRequests userId={currentUserId} /></TabsContent>
        <TabsContent value="interests" className="mt-4"><InterestsReceived userId={currentUserId} /></TabsContent>
      </Tabs>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Post a B2B collaboration request</DialogTitle></DialogHeader>
          <CreateForm userId={currentUserId} onDone={() => { setCreateOpen(false); setTab('mine') }} />
        </DialogContent>
      </Dialog>
    </div>
  )
}

function BrowseRequests({ userId, onOpenProfile }: { userId: string | null; onOpenProfile: (id: string) => void }) {
  const qc = useQueryClient()
  const { data } = useQuery({ queryKey: ['collab-requests'], queryFn: () => api<any>('/api/collab-requests') })
  const requests = data?.requests ?? []

  const expressInterest = useMutation({
    mutationFn: ({ collabRequestId, note }: any) => api<any>('/api/collab-requests/interest', { method: 'POST', body: JSON.stringify({ collabRequestId, tradeUserId: userId, note }) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['collab-requests'] }); toast.success('Interest expressed! The poster will be notified.') },
  })

  if (requests.length === 0) return <div className="text-center text-sm text-muted-foreground py-12">No open B2B requests yet. Post one to find subcontractors.</div>

  return (
    <div className="space-y-3">
      {requests.map((r: any) => (
        <Card key={r.id}>
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <button onClick={() => onOpenProfile(r.author.id)}><Avatar className="h-10 w-10"><AvatarImage src={r.author.avatarUrl} /><AvatarFallback>{r.author.name?.[0]}</AvatarFallback></Avatar></button>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-semibold">{r.tradeNeeded}</span>
                  <span className={cn('text-[10px] px-1.5 py-0.5 rounded font-medium', STATUS_COLOR[r.status])}>{r.status}</span>
                </div>
                <div className="text-[11px] text-muted-foreground mt-0.5">Posted by <button onClick={() => onOpenProfile(r.author.id)} className="hover:underline">{r.author.name}</button> · {formatDistanceToNow(new Date(r.createdAt), { addSuffix: true })}</div>
                {r.scope && <p className="text-sm text-muted-foreground mt-2">{r.scope}</p>}
                <div className="flex items-center gap-3 mt-2 text-[11px] text-muted-foreground flex-wrap">
                  {r.districtName && <span className="flex items-center gap-1"><MapPin className="h-3 w-3" /> {r.districtName}</span>}
                  {r.startDate && <span className="flex items-center gap-1"><Calendar className="h-3 w-3" /> {format(new Date(r.startDate), 'd MMM')}{r.endDate ? ` – ${format(new Date(r.endDate), 'd MMM')}` : ''}</span>}
                  {r.budgetMin && <span>£{r.budgetMin}{r.budgetMax ? `–${r.budgetMax}` : '+'}</span>}
                  {r.interests?.length > 0 && <span className="flex items-center gap-1"><Users className="h-3 w-3" /> {r.interests.length} interested</span>}
                </div>
              </div>
              <Button size="sm" variant="outline" className="text-xs shrink-0" disabled={r.authorId === userId || r.interests?.some((i: any) => i.tradeUserId === userId)} onClick={() => expressInterest.mutate({ collabRequestId: r.id })}>
                {r.interests?.some((i: any) => i.tradeUserId === userId) ? <><CheckCircle2 className="mr-1 h-3 w-3" /> Interested</> : 'Express interest'}
              </Button>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

function MyRequests({ userId }: { userId: string | null }) {
  const { data } = useQuery({ queryKey: ['collab-requests'], queryFn: () => api<any>('/api/collab-requests') })
  const mine = (data?.requests ?? []).filter((r: any) => r.authorId === userId)
  if (mine.length === 0) return <div className="text-center text-sm text-muted-foreground py-12">You haven&apos;t posted any B2B requests yet.</div>
  return (
    <div className="space-y-3">
      {mine.map((r: any) => (
        <Card key={r.id}>
          <CardHeader className="pb-2"><div className="flex items-center gap-2"><CardTitle className="text-sm">{r.tradeNeeded}</CardTitle><span className={cn('text-[10px] px-1.5 py-0.5 rounded font-medium', STATUS_COLOR[r.status])}>{r.status}</span></div></CardHeader>
          <CardContent>
            {r.scope && <p className="text-sm text-muted-foreground mb-2">{r.scope}</p>}
            <div className="text-[11px] text-muted-foreground mb-2">{r.interests?.length ?? 0} tradespeople interested</div>
            {r.interests?.length > 0 && (<div className="space-y-1.5">{r.interests.map((i: any) => (
              <div key={i.id} className="flex items-center gap-2 p-2 rounded-lg bg-muted/50">
                <Avatar className="h-7 w-7"><AvatarImage src={i.tradeUser.avatarUrl} /><AvatarFallback>{i.tradeUser.name?.[0]}</AvatarFallback></Avatar>
                <div className="flex-1 min-w-0"><div className="text-sm font-medium">{i.tradeUser.name}</div>{i.note && <div className="text-[11px] text-muted-foreground truncate">{i.note}</div>}</div>
                <Badge variant="outline" className="text-[10px] py-0 h-4">{i.status}</Badge>
                <Button size="sm" variant="ghost" className="text-xs" onClick={() => toast.success('Opening chat (demo)')}><MessageSquare className="h-3 w-3" /></Button>
              </div>))}</div>)}
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

function InterestsReceived({ userId }: { userId: string | null }) {
  const { data } = useQuery({ queryKey: ['collab-requests'], queryFn: () => api<any>('/api/collab-requests') })
  const mine = (data?.requests ?? []).filter((r: any) => r.interests?.some((i: any) => i.tradeUserId === userId))
  if (mine.length === 0) return <div className="text-center text-sm text-muted-foreground py-12">No interests received on your requests yet.</div>
  return (<div className="space-y-3">{mine.map((r: any) => (<Card key={r.id}><CardHeader className="pb-2"><CardTitle className="text-sm">{r.tradeNeeded}</CardTitle></CardHeader><CardContent><div className="text-[11px] text-muted-foreground mb-2">{r.interests.filter((i: any) => i.tradeUserId === userId).length} of your interests</div></CardContent></Card>))}</div>)
}

function CreateForm({ userId, onDone }: { userId: string | null; onDone: () => void }) {
  const qc = useQueryClient()
  const [form, setForm] = useState({ tradeNeeded: '', districtName: '', scope: '', budgetMin: '', budgetMax: '', startDate: '', endDate: '' })
  const create = useMutation({
    mutationFn: () => api<any>('/api/collab-requests', { method: 'POST', body: JSON.stringify({ authorId: userId, tradeNeeded: form.tradeNeeded, districtName: form.districtName || null, scope: form.scope || null, budgetMin: form.budgetMin ? Number(form.budgetMin) : null, budgetMax: form.budgetMax ? Number(form.budgetMax) : null, startDate: form.startDate || null, endDate: form.endDate || null }) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['collab-requests'] }); toast.success('B2B request posted!'); onDone() },
  })
  return (
    <div className="space-y-3">
      <div><Label className="text-xs">Trade needed</Label><Select value={form.tradeNeeded} onValueChange={(v) => setForm({ ...form, tradeNeeded: v })}><SelectTrigger className="mt-1"><SelectValue placeholder="e.g. Plumber needed" /></SelectTrigger><SelectContent>{TRADES.map((t) => <SelectItem key={t} value={`${t} subcontractor needed`}>{t} subcontractor needed</SelectItem>)}</SelectContent></Select></div>
      <div><Label className="text-xs">Scope of work</Label><Textarea value={form.scope} onChange={(e) => setForm({ ...form, scope: e.target.value })} placeholder="Describe what you need help with…" className="mt-1 text-sm" rows={3} /></div>
      <div className="grid grid-cols-2 gap-3">
        <div><Label className="text-xs">District</Label><Input value={form.districtName} onChange={(e) => setForm({ ...form, districtName: e.target.value })} placeholder="Manchester" className="mt-1" /></div>
        <div><Label className="text-xs">Budget (£)</Label><div className="flex gap-1 mt-1"><Input type="number" value={form.budgetMin} onChange={(e) => setForm({ ...form, budgetMin: e.target.value })} placeholder="Min" /><Input type="number" value={form.budgetMax} onChange={(e) => setForm({ ...form, budgetMax: e.target.value })} placeholder="Max" /></div></div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div><Label className="text-xs">Start date</Label><Input type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} className="mt-1" /></div>
        <div><Label className="text-xs">End date</Label><Input type="date" value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} className="mt-1" /></div>
      </div>
      <DialogFooter><Button onClick={() => create.mutate()} disabled={!form.tradeNeeded || create.isPending}>{create.isPending ? 'Posting…' : 'Post request'}</Button></DialogFooter>
    </div>
  )
}
