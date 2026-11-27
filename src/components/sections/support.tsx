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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { LifeBuoy, Plus, AlertCircle, CheckCircle2, Clock, MessageSquare, Shield } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { formatDistanceToNow } from 'date-fns'

const STATUS_COLOR: Record<string, string> = {
  OPEN: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
  IN_REVIEW: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
  RESOLVED: 'bg-teal-100 text-teal-700 dark:bg-teal-900/40 dark:text-teal-300',
  ESCALATED: 'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300',
}

const PRIORITY_COLOR: Record<string, string> = {
  LOW: 'text-muted-foreground', NORMAL: 'text-foreground', HIGH: 'text-amber-600', URGENT: 'text-rose-600',
}

export function SupportSection() {
  const { currentUserId } = useAppStore()
  const [tab, setTab] = useState('cases')
  const [createOpen, setCreateOpen] = useState(false)

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold tracking-tight flex items-center gap-2">
          <LifeBuoy className="h-5 w-5 text-primary" /> Support
        </h1>
        <p className="text-xs text-muted-foreground">Help with bookings, disputes, refunds and trust concerns. Our team reviews every case — no automatic penalties.</p>
      </div>

      <div className="rounded-lg border border-primary/20 bg-primary/5 p-3 flex items-start gap-3">
        <Shield className="h-5 w-5 text-primary shrink-0 mt-0.5" />
        <div className="text-xs text-muted-foreground">
          <strong className="text-foreground">Fair resolution.</strong> Every support case is human-reviewed and reversible.
          Outcomes never automatically affect marketplace approval or the five-slot network — that requires a separate review.
        </div>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <div className="flex items-center justify-between">
          <TabsList className="h-8">
            <TabsTrigger value="cases" className="text-xs">My cases</TabsTrigger>
            <TabsTrigger value="faq" className="text-xs">Common questions</TabsTrigger>
          </TabsList>
          <Button size="sm" className="text-xs" onClick={() => setCreateOpen(true)}><Plus className="mr-1 h-3 w-3" /> Open a case</Button>
        </div>
        <TabsContent value="cases" className="mt-4"><CasesList userId={currentUserId} /></TabsContent>
        <TabsContent value="faq" className="mt-4"><FAQ /></TabsContent>
      </Tabs>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Open a support case</DialogTitle></DialogHeader>
          <CreateCaseForm userId={currentUserId} onDone={() => setCreateOpen(false)} />
        </DialogContent>
      </Dialog>
    </div>
  )
}

function CasesList({ userId }: { userId: string | null }) {
  const { data } = useQuery({ queryKey: ['support-cases', userId], queryFn: () => api<any>(`/api/support-cases?userId=${userId}`), enabled: !!userId })
  const cases = data?.cases ?? []
  if (cases.length === 0) return <div className="text-center text-sm text-muted-foreground py-12">No support cases yet. Open one if you need help with a booking.</div>
  return (
    <div className="space-y-3">
      {cases.map((c: any) => (
        <Card key={c.id}><CardContent className="p-4">
          <div className="flex items-start gap-3">
            <div className={cn('h-9 w-9 rounded-lg flex items-center justify-center shrink-0', c.status === 'RESOLVED' ? 'bg-teal-100 dark:bg-teal-900/40' : c.status === 'ESCALATED' ? 'bg-rose-100 dark:bg-rose-900/40' : 'bg-amber-100 dark:bg-amber-900/40')}>
              {c.status === 'RESOLVED' ? <CheckCircle2 className="h-4 w-4 text-teal-600" /> : c.status === 'ESCALATED' ? <AlertCircle className="h-4 w-4 text-rose-600" /> : <Clock className="h-4 w-4 text-amber-600" />}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm font-semibold">{c.subject}</span>
                <span className={cn('text-[10px] px-1.5 py-0.5 rounded font-medium', STATUS_COLOR[c.status])}>{c.status.replace('_', ' ')}</span>
                <span className={cn('text-[10px] font-medium uppercase', PRIORITY_COLOR[c.priority])}>{c.priority}</span>
              </div>
              <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{c.description}</p>
              <div className="flex items-center gap-2 mt-2 text-[11px] text-muted-foreground">
                {c.tradesperson && <span>vs {c.tradesperson.name}</span>}
                <span>· {formatDistanceToNow(new Date(c.createdAt), { addSuffix: true })}</span>
                {c.resolution && <span className="text-teal-600">· Resolved</span>}
              </div>
            </div>
            <Button size="sm" variant="ghost" className="text-xs shrink-0" onClick={() => toast.info('Opening case thread (demo)')}><MessageSquare className="h-3 w-3" /></Button>
          </div>
        </CardContent></Card>
      ))}
    </div>
  )
}

function CreateCaseForm({ userId, onDone }: { userId: string | null; onDone: () => void }) {
  const qc = useQueryClient()
  const [form, setForm] = useState({ subject: '', description: '', priority: 'NORMAL' })
  const create = useMutation({
    mutationFn: () => api<any>('/api/support-cases', { method: 'POST', body: JSON.stringify({ customerId: userId, subject: form.subject, description: form.description, priority: form.priority }) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['support-cases'] }); toast.success('Case opened! Our team will review it.'); onDone() },
  })
  return (
    <div className="space-y-3">
      <div><Label className="text-xs">Subject</Label><Input value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} placeholder="Brief summary of the issue" className="mt-1" /></div>
      <div><Label className="text-xs">What happened?</Label><Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Give us the details — what were you expecting, what happened, what would resolve it?" className="mt-1 text-sm" rows={4} /></div>
      <div><Label className="text-xs">Priority</Label><Select value={form.priority} onValueChange={(v) => setForm({ ...form, priority: v })}><SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
        <SelectContent><SelectItem value="LOW">Low — general question</SelectItem><SelectItem value="NORMAL">Normal — booking issue</SelectItem><SelectItem value="HIGH">High — quality concern</SelectItem><SelectItem value="URGENT">Urgent — safety or money at risk</SelectItem></SelectContent></Select></div>
      <DialogFooter><Button onClick={() => create.mutate()} disabled={!form.subject || !form.description || create.isPending}>{create.isPending ? 'Opening…' : 'Open case'}</Button></DialogFooter>
    </div>
  )
}

function FAQ() {
  const faqs = [
    { q: 'How does the five-slot network protect me as a customer?', a: 'Every approved provider has passed vetting (ID, insurance, qualifications) and is one of only 5 in their district. You get quality, not an overwhelming list of strangers.' },
    { q: 'What if I\'m unhappy with the work?', a: 'Open a support case here. Our team reviews every case. If the work is substandard, we can mediate a fix, partial refund, or full refund. The tradesperson\'s approval status is reviewed separately.' },
    { q: 'How are refunds handled?', a: 'Payments are held in escrow until you confirm the job is complete. If there\'s a dispute, the funds stay held until our team resolves the case. Most cases resolve within 48 hours.' },
    { q: 'Can a tradesperson be removed from the five-slot network?', a: 'Only through a separate marketplace review process, not from a single support case. Patterns of poor reviews or unresolved disputes trigger a review. This protects tradespeople from unfair removal.' },
    { q: 'I\'m a tradesperson — how do I join the five-slot network?', a: 'Go to Trade Finder → Apply for a slot. Submit your trade, district and verification documents. If a slot is open, you\'re approved immediately. If all 5 slots are filled, you join the waiting list.' },
    { q: 'What areas does TrustFive cover?', a: 'We launch district by district. Each district has its own five-slot network. If your district isn\'t listed yet, join the waitlist and we\'ll notify you when we launch.' },
  ]
  return (
    <div className="space-y-2">
      {faqs.map((f, i) => (<Card key={i}><CardContent className="p-3"><div className="text-sm font-medium">{f.q}</div><p className="text-xs text-muted-foreground mt-1">{f.a}</p></CardContent></Card>))}
    </div>
  )
}
