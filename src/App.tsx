import React, { useEffect, useMemo, useRef, useState } from 'react'
import type { AppSettings, CardKind, CardRecord, Profile, RenewalProvider } from './lib/types'
import { daysUntil, isExpired } from './lib/expiry'
import { scanCardImage } from './lib/ocr'
import { Auth } from './components/Auth'
import type { User } from '@supabase/supabase-js'
import html2canvas from 'html2canvas'
import {
  createCardKind,
  createProfile,
  createRenewalProvider,
  deleteCardKind,
  deleteCard,
  deleteProfile,
  deleteRenewalProvider,
  getCard,
  getDb,
  getSettings,
  listCardKinds,
  listCards,
  listProfiles,
  listRenewalProviders,
  resetDatabase,
  saveSettings,
  upsertCard
} from './lib/db-unified'

type FilterMode = 'All' | 'Expiring' | 'Expired'

function newId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID()
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`
}

function normalizeUrl(url: string): string {
  const trimmed = url.trim()
  if (!trimmed) return ''
  if (/^https?:\/\//i.test(trimmed)) return trimmed
  return `https://${trimmed}`
}

function formatDaysLabel(d: number): string {
  if (d < 0) return `${Math.abs(d)} day(s) overdue`
  if (d === 0) return 'Expires today'
  if (d === 1) return '1 day left'
  return `${d} days left`
}

function pseudoCardNumber(seed: string | null | undefined): string {
  const s = seed ?? ''
  let h = 2166136261
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  const digits = Array.from({ length: 16 }, (_, i) => {
    h ^= (h >>> 13)
    h = Math.imul(h, 2246822507)
    const d = Math.abs(h + i) % 10
    return String(d)
  }).join('')
  return `${digits.slice(0, 4)} ${digits.slice(4, 8)} ${digits.slice(8, 12)} ${digits.slice(12, 16)}`
}

export default function App() {
  const [user, setUser] = useState<User | null>(null)
  const [cards, setCards] = useState<CardRecord[]>([])
  const [filter, setFilter] = useState<FilterMode>('All')
  const [settings, setSettings] = useState<AppSettings | null>(null)
  const [busy, setBusy] = useState(false)

  const [dbError, setDbError] = useState<string | null>(null)

  const [cardKinds, setCardKinds] = useState<CardKind[]>([])
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [providers, setProviders] = useState<RenewalProvider[]>([])

  const [manageOpen, setManageOpen] = useState(false)
  const [newKindName, setNewKindName] = useState('')
  const [newProfileName, setNewProfileName] = useState('')
  const [newProviderName, setNewProviderName] = useState('')
  const [newProviderUrl, setNewProviderUrl] = useState('')

  const [viewingId, setViewingId] = useState<string | null>(null)
  const [viewingTitle, setViewingTitle] = useState<string>('')
  const [viewingUrl, setViewingUrl] = useState<string | null>(null)
  const [viewingMissing, setViewingMissing] = useState(false)
  const [shareBusy, setShareBusy] = useState(false)
  const ecardRef = useRef<HTMLDivElement | null>(null)

  const [formOpen, setFormOpen] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)

  const [kind, setKind] = useState<CardKind>('Credit')
  const [title, setTitle] = useState('')
  const [issuer, setIssuer] = useState('')
  const [expiryDate, setExpiryDate] = useState('')
  const [profileId, setProfileId] = useState<string>('')
  const [renewalProviderId, setRenewalProviderId] = useState<string>('')
  const [renewUrl, setRenewUrl] = useState('')
  const [notes, setNotes] = useState('')
  const fileRef = useRef<HTMLInputElement | null>(null)

  const [scanBusy, setScanBusy] = useState(false)
  const [scanMsg, setScanMsg] = useState<string | null>(null)

  async function refresh() {
    const all = await listCards()
    all.sort((a, b) => a.expiryDate.localeCompare(b.expiryDate))
    setCards(all)
  }

  async function refreshMeta() {
    const [kinds, p, prov] = await Promise.all([
      listCardKinds(),
      listProfiles(),
      listRenewalProviders()
    ])
    setCardKinds(kinds)
    setProfiles(p)
    setProviders(prov)
    // Set default card kind if none selected and form is open
    if (!kind && kinds.length > 0 && formOpen) {
      setKind(kinds[0])
    }
  }

  useEffect(() => {
    ;(async () => {
      try {
        const s = await getSettings()
        setSettings(s)
        await Promise.all([refresh(), refreshMeta()])
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        setDbError(msg)
      }
    })()
  }, [])

  async function onResetLocalData() {
    const ok = window.confirm(
      'Reset local CardGuard storage? This will delete all cards, images, profiles, and custom types on this device.'
    )
    if (!ok) return
    setBusy(true)
    try {
      await resetDatabase()
      // Clear all state
      setCards([])
      setCardKinds([])
      setProfiles([])
      setProviders([])
      setSettings(null)
    } finally {
      setBusy(false)
    }
  }

  const derived = useMemo(() => {
    const reminderDays = settings?.reminderDays ?? 30
    const by = cards.map((c) => ({
      card: c,
      days: daysUntil(c.expiryDate),
      expired: isExpired(c.expiryDate),
      expiringSoon: daysUntil(c.expiryDate) <= reminderDays && !isExpired(c.expiryDate)
    }))

    const filtered = by.filter((x) => {
      if (filter === 'All') return true
      if (filter === 'Expired') return x.expired
      if (filter === 'Expiring') return x.expiringSoon
      return true
    })

    const expiringSoonCount = by.filter((x) => x.expiringSoon).length
    const expiredCount = by.filter((x) => x.expired).length

    return { filtered, expiringSoonCount, expiredCount }
  }, [cards, filter, settings])

  const viewingCard = useMemo(() => {
    if (!viewingId) return null
    return cards.find((x) => x.id === viewingId) ?? null
  }, [cards, viewingId])

  useEffect(() => {
    if (!settings?.notificationsEnabled) return
    if (Notification.permission !== 'granted') return

    const reminderDays = settings.reminderDays
    const expiring = cards
      .filter((c) => {
        const d = daysUntil(c.expiryDate)
        return d >= 0 && d <= reminderDays
      })
      .sort((a, b) => a.expiryDate.localeCompare(b.expiryDate))

    if (expiring.length === 0) return

    const soonest = expiring[0]
    const d = daysUntil(soonest.expiryDate)

    // Show at most once per day (very lightweight local throttle).
    const key = 'cardguard:lastNotifyDay'
    const today = new Date()
    const dayToken = `${today.getFullYear()}-${today.getMonth() + 1}-${today.getDate()}`
    const prev = localStorage.getItem(key)
    if (prev === dayToken) return
    localStorage.setItem(key, dayToken)

    new Notification('CardGuard reminder', {
      body: `${soonest.title} (${soonest.kind}) — ${formatDaysLabel(d)}`
    })
  }, [cards, settings?.notificationsEnabled, settings?.reminderDays])

  useEffect(() => {
    return () => {
      if (viewingUrl) URL.revokeObjectURL(viewingUrl)
    }
  }, [viewingUrl])

  function openAdd() {
    setEditingId(null)
    // If no card kinds exist, don't open the form yet
    if (cardKinds.length === 0) {
      alert('Please wait while card types are being loaded...')
      return
    }
    // Set the first available card kind
    setKind(cardKinds[0])
    setTitle('')
    setIssuer('')
    setExpiryDate('')
    setProfileId('')
    setRenewalProviderId('')
    setRenewUrl('')
    setNotes('')
    setScanMsg(null)
    if (fileRef.current) fileRef.current.value = ''
    setFormOpen(true)
  }

  async function openView(cardId: string) {
    const c = cards.find((x) => x.id === cardId)
    setViewingTitle(c?.title ?? 'Card image')
    setViewingId(cardId)
    setViewingMissing(false)

    if (viewingUrl) {
      URL.revokeObjectURL(viewingUrl)
      setViewingUrl(null)
    }

    const full = await getCard(cardId)
    const blob = full?.imageBlob
    if (!blob) {
      setViewingMissing(true)
      return
    }

    const url = URL.createObjectURL(blob)
    setViewingUrl(url)
  }

  function closeView() {
    setViewingId(null)
    setViewingTitle('')
    setViewingMissing(false)
    if (viewingUrl) {
      URL.revokeObjectURL(viewingUrl)
      setViewingUrl(null)
    }
  }

  async function renderEcardBlob(): Promise<Blob> {
    const el = ecardRef.current
    if (!el) throw new Error('Preview not ready')

    const canvas = await html2canvas(el, {
      backgroundColor: null,
      scale: Math.min(2, window.devicePixelRatio || 1)
    })

    const blob: Blob | null = await new Promise((resolve) =>
      canvas.toBlob((b: Blob | null) => resolve(b), 'image/png')
    )
    if (!blob) throw new Error('Failed to render image')
    return blob
  }

  async function downloadEcard() {
    try {
      setShareBusy(true)
      const blob = await renderEcardBlob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${(viewingTitle || 'ecard').replace(/[^a-z0-9\-\s_]/gi, '').trim() || 'ecard'}.png`
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
    } catch (e) {
      alert((e as Error).message)
    } finally {
      setShareBusy(false)
    }
  }

  async function shareEcard() {
    try {
      setShareBusy(true)
      const blob = await renderEcardBlob()
      const file = new File([blob], 'ecard.png', { type: 'image/png' })

      const anyNav: any = navigator
      const canShareFiles = typeof anyNav.canShare === 'function' && anyNav.canShare({ files: [file] })

      if (anyNav.share && canShareFiles) {
        await anyNav.share({
          title: viewingTitle || 'Card',
          text: 'My e-card',
          files: [file]
        })
        return
      }

      await downloadEcard()
      alert('Sharing is not supported on this browser. The card was downloaded instead.')
    } catch (e) {
      const msg = (e as any)?.name === 'AbortError' ? null : (e as Error).message
      if (msg) alert(msg)
    } finally {
      setShareBusy(false)
    }
  }

  async function openEdit(cardId: string) {
    const c = cards.find((x) => x.id === cardId)
    if (!c) return
    setEditingId(cardId)
    setKind(c.kind)
    setTitle(c.title)
    setIssuer(c.issuer ?? '')
    setExpiryDate(c.expiryDate)
    setProfileId(c.profileId ?? '')
    setRenewalProviderId(c.renewalProviderId ?? '')
    setRenewUrl(c.renewUrl ?? '')
    setNotes(c.notes ?? '')
    setScanMsg(null)
    if (fileRef.current) fileRef.current.value = ''
    setFormOpen(true)
  }

  async function onScanImage() {
    const file = fileRef.current?.files?.[0]
    if (!file) {
      setScanMsg('Please choose an image first.')
      return
    }

    setScanBusy(true)
    setScanMsg('Scanning image...')
    try {
      const res = await scanCardImage(file)
      
      // Build a message showing what was detected
      const detectedFields = []
      const detectedNotes: string[] = []

      if (res.personName) detectedNotes.push(`Name: ${res.personName}`)
      if (res.documentNumber) detectedNotes.push(`Document No: ${res.documentNumber}`)
      if (res.issueYmd) detectedNotes.push(`Issued: ${res.issueYmd}`)

      if (detectedNotes.length > 0) {
        setNotes((prev) => {
          const block = detectedNotes.join('\n')
          if (!prev.trim()) return block
          if (prev.includes(block)) return prev
          return `${prev.trim()}\n\n${block}`
        })
        detectedFields.push('Notes: +details')
      }

      if (res.title) {
        setTitle(res.title)
        detectedFields.push(`Title: ${res.title}`)
      }
      if (res.issuer) {
        setIssuer(res.issuer)
        detectedFields.push(`Issuer: ${res.issuer}`)
      }
      if (res.expiryYmd) {
        setExpiryDate(res.expiryYmd)
        detectedFields.push(`Expiry: ${res.expiryYmd}`)
      }

      // If title wasn't found, build a helpful one from detected name
      if (!res.title && !title.trim()) {
        const base = kind || 'Card'
        const withName = res.personName ? `${base} - ${res.personName}` : base
        setTitle(withName)
        detectedFields.push(`Title: ${withName}`)
      }
      
      if (detectedFields.length > 0) {
        setScanMsg(`Detected: ${detectedFields.join(', ')}`)
      } else {
        setScanMsg('Could not detect card information. Try a clearer image.')
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      setScanMsg(`Scan failed: ${msg}`)
    } finally {
      setScanBusy(false)
    }
  }

  async function onSave(e: React.FormEvent) {
    e.preventDefault()
    if (!expiryDate) return
    if (!title.trim()) return

    setBusy(true)
    try {
      const now = Date.now()
      const id = editingId ?? newId()
      const card: CardRecord = {
        id,
        kind,
        title: title.trim(),
        issuer: issuer.trim() ? issuer.trim() : undefined,
        expiryDate,
        profileId: profileId || undefined,
        renewalProviderId: renewalProviderId || undefined,
        renewUrl: normalizeUrl(renewUrl) || undefined,
        notes: notes.trim() ? notes.trim() : undefined,
        createdAt: editingId ? cards.find((c) => c.id === editingId)?.createdAt ?? now : now,
        updatedAt: now
      }

      const file = fileRef.current?.files?.[0]
      const imageBlob = file ? file.slice(0, file.size, file.type) : undefined

      await upsertCard({ card, imageBlob })
      await refresh()
      setFormOpen(false)
    } finally {
      setBusy(false)
    }
  }

  async function onAddKind() {
    const name = newKindName.trim()
    if (!name) return
    setBusy(true)
    try {
      await createCardKind(name)
      setNewKindName('')
      await refreshMeta()
    } finally {
      setBusy(false)
    }
  }

  async function onAddProfile() {
    const name = newProfileName.trim()
    if (!name) return
    setBusy(true)
    try {
      await createProfile(name)
      setNewProfileName('')
      await refreshMeta()
    } finally {
      setBusy(false)
    }
  }

  async function onAddProvider() {
    const name = newProviderName.trim()
    const url = normalizeUrl(newProviderUrl)
    if (!name || !url) return
    setBusy(true)
    try {
      await createRenewalProvider({ name, url })
      setNewProviderName('')
      setNewProviderUrl('')
      await refreshMeta()
    } finally {
      setBusy(false)
    }
  }

  async function onDeleteKind(name: string) {
    const ok = window.confirm(`Delete card type "${name}"?`)
    if (!ok) return
    setBusy(true)
    try {
      await deleteCardKind(name)
      await refreshMeta()
    } finally {
      setBusy(false)
    }
  }

  async function onDeleteProfile(id: string, name: string) {
    const ok = window.confirm(`Delete profile "${name}"?`)
    if (!ok) return
    setBusy(true)
    try {
      await deleteProfile(id)
      await refreshMeta()
    } finally {
      setBusy(false)
    }
  }

  async function onDeleteProvider(id: string, name: string) {
    const ok = window.confirm(`Delete renewal provider "${name}"?`)
    if (!ok) return
    setBusy(true)
    try {
      await deleteRenewalProvider(id)
      await refreshMeta()
    } finally {
      setBusy(false)
    }
  }

  function onProviderSelected(nextId: string) {
    setRenewalProviderId(nextId)
    const provider = providers.find((p) => p.id === nextId)
    if (!provider) return
    if (!renewUrl.trim()) {
      setRenewUrl(provider.url)
    }
  }

  async function onDelete(cardId: string) {
    const c = cards.find((x) => x.id === cardId)
    if (!c) return
    const ok = window.confirm(`Delete "${c.title}"?`)
    if (!ok) return

    setBusy(true)
    try {
      await deleteCard(cardId)
      await refresh()
    } finally {
      setBusy(false)
    }
  }

  async function toggleNotifications(next: boolean) {
    if (!settings) return

    if (next) {
      const perm = await Notification.requestPermission()
      if (perm !== 'granted') {
        setSettings({ ...settings, notificationsEnabled: false })
        await saveSettings({ ...settings, notificationsEnabled: false })
        return
      }
    }

    const updated = { ...settings, notificationsEnabled: next }
    setSettings(updated)
    await saveSettings(updated)
  }

  async function updateReminderDays(days: number) {
    if (!settings) return
    const updated = { ...settings, reminderDays: days }
    setSettings(updated)
    await saveSettings(updated)
  }

  if (!user) {
    return <Auth onAuthChange={setUser} />
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-slate-50">
      <Auth onAuthChange={setUser} />
      <div className="mx-auto max-w-6xl px-4 py-6">
        {dbError ? (
          <section className="mb-4 rounded-2xl bg-red-500/10 p-4 ring-1 ring-red-500/30">
            <div className="text-sm font-semibold text-red-200">
              Local storage error
            </div>
            <div className="mt-1 text-xs text-red-200/80 break-words">{dbError}</div>
            <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div className="text-xs text-slate-200/80">
                If you previously opened CardGuard in another tab, close it and reload. If the problem continues,
                reset local data.
              </div>
              <button
                disabled={busy}
                onClick={onResetLocalData}
                className="rounded-xl bg-red-500/15 px-4 py-2 text-sm font-semibold text-red-100 ring-1 ring-red-500/30 hover:bg-red-500/20 disabled:opacity-60"
              >
                Reset local data
              </button>
            </div>
          </section>
        ) : null}

        {/* Hero Section */}
        <header className="mb-8 text-center">
          <div className="mb-6 inline-flex items-center justify-center rounded-2xl bg-emerald-500/10 p-4 ring-1 ring-emerald-500/20">
            <svg className="h-12 w-12 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
            </svg>
          </div>
          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl lg:text-6xl">
            Card<span className="text-emerald-400">Guard</span>
          </h1>
          <p className="mt-4 text-lg text-slate-300 sm:text-xl">
            Never Miss an Expiry Again.
          </p>
          <p className="mt-2 text-sm text-slate-400">
            Store, track, and manage all your important cards with OCR-powered scanning
          </p>
        </header>

        {/* Quick Actions */}
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:justify-center">
          <button
            onClick={openAdd}
            className="group relative overflow-hidden rounded-xl bg-emerald-500 px-8 py-3 text-base font-semibold text-slate-950 transition-all hover:bg-emerald-400 active:bg-emerald-600 sm:px-6 sm:py-2 sm:text-sm"
          >
            <span className="relative z-10 flex items-center gap-2">
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Add Your First Card
            </span>
            <div className="absolute inset-0 bg-gradient-to-r from-emerald-600 to-teal-600 opacity-0 transition-opacity group-hover:opacity-100" />
          </button>
          <button
            onClick={() => setManageOpen(true)}
            className="rounded-xl bg-slate-800/50 px-8 py-3 text-base font-medium text-slate-200 ring-1 ring-slate-700 transition-all hover:bg-slate-800 sm:px-6 sm:py-2 sm:text-sm"
          >
            Manage Cards
          </button>
        </div>

        {/* Features Section */}
        <section className="mb-12">
          <h2 className="mb-6 text-center text-2xl font-semibold text-slate-100">Everything You Need</h2>
          <div className="grid gap-6 md:grid-cols-3">
            <div className="rounded-2xl bg-slate-900/50 p-6 ring-1 ring-slate-800 transition-all hover:bg-slate-900/70">
              <div className="mb-4 rounded-xl bg-emerald-500/10 p-3 w-fit">
                <svg className="h-6 w-6 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </div>
              <h3 className="mb-2 text-lg font-semibold text-slate-100">OCR Scanning</h3>
              <p className="text-sm text-slate-400">
                Instantly scan and extract information from your cards using advanced OCR technology
              </p>
            </div>
            <div className="rounded-2xl bg-slate-900/50 p-6 ring-1 ring-slate-800 transition-all hover:bg-slate-900/70">
              <div className="mb-4 rounded-xl bg-blue-500/10 p-3 w-fit">
                <svg className="h-6 w-6 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h3 className="mb-2 text-lg font-semibold text-slate-100">Smart Reminders</h3>
              <p className="text-sm text-slate-400">
                Get notified before your cards expire with customizable reminder settings
              </p>
            </div>
            <div className="rounded-2xl bg-slate-900/50 p-6 ring-1 ring-slate-800 transition-all hover:bg-slate-900/70">
              <div className="mb-4 rounded-xl bg-purple-500/10 p-3 w-fit">
                <svg className="h-6 w-6 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
              </div>
              <h3 className="mb-2 text-lg font-semibold text-slate-100">Secure Storage</h3>
              <p className="text-sm text-slate-400">
                Your data is stored locally and encrypted, keeping your information private and secure
              </p>
            </div>
          </div>
        </section>

        {/* Stats Section */}
        <section className="mb-8 grid gap-3 rounded-2xl bg-slate-900/50 p-6 ring-1 ring-slate-800">
          <h2 className="mb-4 text-xl font-semibold text-slate-100">Your Card Overview</h2>
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="rounded-xl bg-slate-950/40 p-4 ring-1 ring-slate-800">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-xs text-slate-400">Expiring Soon</div>
                  <div className="mt-1 text-2xl font-bold text-amber-400">{derived.expiringSoonCount}</div>
                </div>
                <svg className="h-8 w-8 text-amber-400/50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
            </div>
            <div className="rounded-xl bg-slate-950/40 p-4 ring-1 ring-slate-800">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-xs text-slate-400">Expired</div>
                  <div className="mt-1 text-2xl font-bold text-red-400">{derived.expiredCount}</div>
                </div>
                <svg className="h-8 w-8 text-red-400/50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
            </div>
            <div className="rounded-xl bg-slate-950/40 p-4 ring-1 ring-slate-800">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-xs text-slate-400">Total Cards</div>
                  <div className="mt-1 text-2xl font-bold text-emerald-400">{cards.length}</div>
                </div>
                <svg className="h-8 w-8 text-emerald-400/50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                </svg>
              </div>
            </div>
          </div>
          <div className="mt-4 flex items-center justify-between rounded-xl bg-slate-950/40 p-4 ring-1 ring-slate-800">
            <div className="flex items-center gap-2">
              <svg className="h-5 w-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
              </svg>
              <span className="text-sm text-slate-300">Reminder window:</span>
              <input
                type="number"
                min={1}
                max={365}
                value={settings?.reminderDays ?? 30}
                onChange={(e) => updateReminderDays(Number(e.target.value))}
                className="w-20 rounded-lg bg-slate-800 px-3 py-1 text-sm ring-1 ring-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
              <span className="text-sm text-slate-300">days before expiry</span>
            </div>
            <button
              onClick={() => toggleNotifications(!settings?.notificationsEnabled)}
              className={`rounded-lg px-4 py-2 text-sm font-medium transition-all ${
                settings?.notificationsEnabled
                  ? 'bg-emerald-500/20 text-emerald-300 ring-1 ring-emerald-500/30'
                  : 'bg-slate-800 text-slate-400 ring-1 ring-slate-700 hover:bg-slate-700'
              }`}
            >
              {settings?.notificationsEnabled ? 'Notifications On' : 'Notifications Off'}
            </button>
          </div>
        </section>

        {/* Filter and Cards */}
        {cards.length > 0 && (
          <section className="mb-8">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex gap-2">
                {(['All', 'Expiring', 'Expired'] as const).map((m) => (
                  <button
                    key={m}
                    onClick={() => setFilter(m)}
                  className={`rounded-xl px-3 py-2 text-sm ring-1 ring-slate-800 ${
                    filter === m
                      ? 'bg-slate-50 text-slate-950'
                      : 'bg-slate-950/30 text-slate-200 hover:bg-slate-900'
                  }`}
                >
                  {m}
                </button>
              ))}
            </div>

            <label className="flex items-center gap-3 rounded-xl bg-slate-950/30 px-3 py-2 text-sm ring-1 ring-slate-800">
              <input
                type="checkbox"
                checked={settings?.notificationsEnabled ?? false}
                onChange={(e) => toggleNotifications(e.target.checked)}
              />
              <span className="text-slate-200">Notifications</span>
              <span className="text-xs text-slate-400">(when supported)</span>
            </label>
          </div>
        </section>
        )}

        <section className="mt-6">
          {derived.filtered.length === 0 ? (
            <div className="rounded-2xl bg-slate-900/40 p-6 text-center text-sm text-slate-300 ring-1 ring-slate-800">
              No cards yet. Click <span className="font-semibold text-slate-50">Add card</span>.
            </div>
          ) : (
            <div className="grid gap-3">
              {derived.filtered.map(({ card, days, expired, expiringSoon }) => (
                <article
                  key={card.id}
                  className="rounded-2xl bg-slate-900/40 p-4 ring-1 ring-slate-800"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="text-base font-semibold">{card.title}</h2>
                        <span className="rounded-full bg-slate-950/40 px-2 py-1 text-xs text-slate-300 ring-1 ring-slate-800">
                          {card.kind}
                        </span>
                        {card.profileId ? (
                          <span className="rounded-full bg-slate-950/40 px-2 py-1 text-xs text-slate-300 ring-1 ring-slate-800">
                            {profiles.find((p) => p.id === card.profileId)?.name ?? 'Profile'}
                          </span>
                        ) : null}
                        {expired ? (
                          <span className="rounded-full bg-red-500/15 px-2 py-1 text-xs text-red-200 ring-1 ring-red-500/30">
                            Expired
                          </span>
                        ) : expiringSoon ? (
                          <span className="rounded-full bg-amber-500/15 px-2 py-1 text-xs text-amber-200 ring-1 ring-amber-500/30">
                            Expiring soon
                          </span>
                        ) : (
                          <span className="rounded-full bg-emerald-500/15 px-2 py-1 text-xs text-emerald-200 ring-1 ring-emerald-500/30">
                            Active
                          </span>
                        )}
                      </div>
                      {card.issuer ? (
                        <div className="mt-1 text-sm text-slate-300">{card.issuer}</div>
                      ) : null}
                      <div className="mt-2 text-sm">
                        <span className="text-slate-400">Expiry:</span>{' '}
                        <span className="font-medium text-slate-100">{card.expiryDate}</span>
                        <span className="ml-2 text-slate-300">({formatDaysLabel(days)})</span>
                      </div>
                      {card.notes ? (
                        <div className="mt-2 whitespace-pre-wrap text-sm text-slate-300">
                          {card.notes}
                        </div>
                      ) : null}
                    </div>

                    <div className="flex flex-col gap-2">
                      {card.renewUrl ? (
                        <a
                          href={card.renewUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="rounded-xl bg-slate-50 px-3 py-2 text-center text-sm font-semibold text-slate-950 hover:bg-white"
                        >
                          Renew
                        </a>
                      ) : (
                        <button
                          onClick={() => openEdit(card.id)}
                          className="rounded-xl bg-slate-950/30 px-3 py-2 text-sm text-slate-200 ring-1 ring-slate-800 hover:bg-slate-900"
                        >
                          Add renew link
                        </button>
                      )}

                      <button
                        disabled={busy}
                        onClick={() => openView(card.id)}
                        className="rounded-xl bg-slate-950/30 px-3 py-2 text-sm text-slate-200 ring-1 ring-slate-800 hover:bg-slate-900 disabled:opacity-60"
                      >
                        View image
                      </button>

                      <button
                        disabled={busy}
                        onClick={() => openEdit(card.id)}
                        className="rounded-xl bg-slate-950/30 px-3 py-2 text-sm text-slate-200 ring-1 ring-slate-800 hover:bg-slate-900 disabled:opacity-60"
                      >
                        Edit
                      </button>
                      <button
                        disabled={busy}
                        onClick={() => onDelete(card.id)}
                        className="rounded-xl bg-red-500/10 px-3 py-2 text-sm text-red-200 ring-1 ring-red-500/30 hover:bg-red-500/15 disabled:opacity-60"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>

        {formOpen ? (
          <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/70 p-4">
            <div className="flex w-full max-w-xl flex-col overflow-hidden rounded-2xl bg-slate-950 ring-1 ring-slate-800 max-h-[90dvh]">
              <div className="flex items-start justify-between gap-4 p-5">
                <div>
                  <div className="text-lg font-semibold">
                    {editingId ? 'Edit card' : 'Add card'}
                  </div>
                  <div className="text-xs text-slate-400">
                    Uploading an image is optional.
                  </div>
                </div>
                <button
                  onClick={() => setFormOpen(false)}
                  className="rounded-xl bg-slate-900 px-3 py-2 text-sm text-slate-200 ring-1 ring-slate-800 hover:bg-slate-800"
                >
                  Close
                </button>
              </div>

              <form onSubmit={onSave} className="flex min-h-0 flex-1 flex-col">
                <div className="grid min-h-0 flex-1 gap-3 overflow-y-auto px-5 pb-4">
                  <div className="grid gap-3 sm:grid-cols-2">
                  <label className="grid gap-1">
                    <span className="text-xs text-slate-300">Type</span>
                    <select
                      value={kind}
                      onChange={(e) => setKind(e.target.value as CardKind)}
                      className="rounded-xl bg-slate-900 px-3 py-2 text-sm ring-1 ring-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    >
                      {cardKinds.map((k) => (
                        <option key={k} value={k}>
                          {k}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="grid gap-1">
                    <span className="text-xs text-slate-300">Expiry date</span>
                    <input
                      value={expiryDate}
                      onChange={(e) => setExpiryDate(e.target.value)}
                      type="date"
                      required
                      className="rounded-xl bg-slate-900 px-3 py-2 text-sm ring-1 ring-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </label>
                </div>

                <label className="grid gap-1">
                  <span className="text-xs text-slate-300">Profile / Dependent (optional)</span>
                  <select
                    value={profileId}
                    onChange={(e) => setProfileId(e.target.value)}
                    className="rounded-xl bg-slate-900 px-3 py-2 text-sm ring-1 ring-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  >
                    <option value="">No profile</option>
                    {profiles.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="grid gap-1">
                  <span className="text-xs text-slate-300">Card name</span>
                  <input
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="e.g., Visa Platinum"
                    required
                    className="rounded-xl bg-slate-900 px-3 py-2 text-sm ring-1 ring-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </label>

                <label className="grid gap-1">
                  <span className="text-xs text-slate-300">Issuer (optional)</span>
                  <input
                    value={issuer}
                    onChange={(e) => setIssuer(e.target.value)}
                    placeholder="e.g., Bank / Department"
                    className="rounded-xl bg-slate-900 px-3 py-2 text-sm ring-1 ring-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </label>

                <label className="grid gap-1">
                  <span className="text-xs text-slate-300">Renew link (optional)</span>
                  <input
                    value={renewUrl}
                    onChange={(e) => setRenewUrl(e.target.value)}
                    placeholder="https://..."
                    inputMode="url"
                    className="rounded-xl bg-slate-900 px-3 py-2 text-sm ring-1 ring-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </label>

                <label className="grid gap-1">
                  <span className="text-xs text-slate-300">Renewal provider (optional)</span>
                  <select
                    value={renewalProviderId}
                    onChange={(e) => onProviderSelected(e.target.value)}
                    className="rounded-xl bg-slate-900 px-3 py-2 text-sm ring-1 ring-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  >
                    <option value="">No provider</option>
                    {providers.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="grid gap-1">
                  <span className="text-xs text-slate-300">Card image (optional)</span>
                  <input
                    ref={fileRef}
                    type="file"
                    accept="image/*"
                    className="block w-full text-sm text-slate-200 file:mr-3 file:rounded-xl file:border-0 file:bg-slate-50 file:px-3 file:py-2 file:text-sm file:font-semibold file:text-slate-950 hover:file:bg-white"
                  />
                </label>

                <div className="grid gap-2">
                  <button
                    type="button"
                    disabled={scanBusy || busy}
                    onClick={onScanImage}
                    className="rounded-xl bg-slate-50 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-white disabled:opacity-60"
                  >
                    {scanBusy ? 'Scanning...' : 'Scan image (auto-detect expiry)'}
                  </button>
                  {scanMsg ? <div className="text-xs text-slate-300">{scanMsg}</div> : null}
                </div>

                <label className="grid gap-1">
                  <span className="text-xs text-slate-300">Notes (optional)</span>
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    rows={3}
                    className="rounded-xl bg-slate-900 px-3 py-2 text-sm ring-1 ring-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </label>
                </div>

                <div className="sticky bottom-0 flex items-center justify-end gap-2 border-t border-slate-800 bg-slate-950/95 px-5 py-4 backdrop-blur">
                  <button
                    type="button"
                    onClick={() => setFormOpen(false)}
                    className="rounded-xl bg-slate-900 px-4 py-2 text-sm text-slate-200 ring-1 ring-slate-800 hover:bg-slate-800"
                  >
                    Cancel
                  </button>
                  <button
                    disabled={busy}
                    type="submit"
                    className="rounded-xl bg-emerald-500 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-emerald-400 active:bg-emerald-600 disabled:opacity-60"
                  >
                    Save
                  </button>
                </div>
              </form>
            </div>
          </div>
        ) : null}

        {viewingId ? (
          <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/70 p-4">
            <div className="flex w-full max-w-xl flex-col overflow-hidden rounded-2xl bg-slate-950 ring-1 ring-slate-800 max-h-[90dvh]">
              <div className="flex items-start justify-between gap-4 p-5">
                <div>
                  <div className="text-lg font-semibold">{viewingTitle}</div>
                  <div className="text-xs text-slate-400">Wallet preview</div>
                </div>
                <button
                  onClick={closeView}
                  className="rounded-xl bg-slate-900 px-3 py-2 text-sm text-slate-200 ring-1 ring-slate-800 hover:bg-slate-800"
                >
                  Close
                </button>
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto p-5">
                <div
                  ref={ecardRef}
                  className="relative mx-auto w-full max-w-md overflow-hidden rounded-3xl ring-1 ring-slate-800"
                >
                  <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/25 via-slate-950 to-emerald-500/20" />
                  <div className="absolute -top-24 -right-24 h-56 w-56 rounded-full bg-white/10 blur-2xl" />
                  <div className="absolute -bottom-24 -left-24 h-56 w-56 rounded-full bg-emerald-400/10 blur-2xl" />

                  <div className="relative p-5">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-xs text-slate-200/70">{viewingCard?.kind ?? 'Card'}</div>
                        <div className="truncate text-lg font-semibold text-slate-50">{viewingTitle}</div>
                      </div>
                      <div className="text-right">
                        <div className="text-xs text-slate-200/70">Issuer</div>
                        <div className="max-w-[11rem] truncate text-sm font-semibold text-slate-100">
                          {viewingCard?.issuer || '—'}
                        </div>
                      </div>
                    </div>

                    <div className="mt-5 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-14 rounded-xl bg-gradient-to-br from-amber-200 via-amber-400 to-amber-600 ring-1 ring-black/20" />
                        <svg className="h-8 w-8 text-slate-100/90" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                          <path d="M5 9c4-4 10-4 14 0" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                          <path d="M7.5 11.5c2.6-2.6 6.4-2.6 9 0" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                          <path d="M10 14c1.1-1.1 2.9-1.1 4 0" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                          <path d="M12 16.5h0" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
                        </svg>
                      </div>
                      <div className="rounded-2xl bg-slate-950/30 px-3 py-2 text-xs text-slate-200 ring-1 ring-slate-800">
                        CardGuard
                      </div>
                    </div>

                    <div className="mt-5 font-mono text-lg tracking-widest text-slate-50">
                      {pseudoCardNumber(viewingId)}
                    </div>

                    <div className="mt-5 grid grid-cols-2 gap-3">
                      <div className="rounded-2xl bg-slate-950/40 p-3 ring-1 ring-slate-800">
                        <div className="text-[11px] text-slate-200/70">Cardholder</div>
                        <div className="mt-1 truncate text-sm font-semibold text-slate-100">
                          {(viewingCard?.profileId
                            ? profiles.find((p) => p.id === viewingCard.profileId)?.name
                            : null) || 'Personal'}
                        </div>
                      </div>
                      <div className="rounded-2xl bg-slate-950/40 p-3 ring-1 ring-slate-800">
                        <div className="text-[11px] text-slate-200/70">Expiry</div>
                        <div className="mt-1 text-sm font-semibold text-slate-100">
                          {viewingCard?.expiryDate ?? '—'}
                        </div>
                      </div>
                    </div>

                    <div className="mt-4">
                      {viewingMissing ? (
                        <div className="rounded-2xl bg-slate-950/40 p-4 text-sm text-slate-300 ring-1 ring-slate-800">
                          No image saved for this card.
                        </div>
                      ) : viewingUrl ? (
                        <img
                          src={viewingUrl}
                          alt={viewingTitle}
                          className="w-full rounded-2xl ring-1 ring-slate-800"
                        />
                      ) : (
                        <div className="rounded-2xl bg-slate-950/40 p-4 text-sm text-slate-300 ring-1 ring-slate-800">
                          Loading...
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-end gap-2 border-t border-slate-800 bg-slate-950/95 px-5 py-4 backdrop-blur">
                <button
                  type="button"
                  disabled={shareBusy}
                  onClick={downloadEcard}
                  className="rounded-xl bg-slate-900 px-4 py-2 text-sm text-slate-200 ring-1 ring-slate-800 hover:bg-slate-800 disabled:opacity-60"
                >
                  Download
                </button>
                <button
                  type="button"
                  disabled={shareBusy}
                  onClick={shareEcard}
                  className="rounded-xl bg-emerald-500 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-emerald-400 active:bg-emerald-600 disabled:opacity-60"
                >
                  Share
                </button>
              </div>
            </div>
          </div>
        ) : null}

        {manageOpen ? (
          <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/70 p-4">
            <div className="w-full max-w-2xl rounded-2xl bg-slate-950 p-5 ring-1 ring-slate-800">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="text-lg font-semibold">Manage</div>
                  <div className="text-xs text-slate-400">Custom lists are saved locally</div>
                </div>
                <button
                  onClick={() => setManageOpen(false)}
                  className="rounded-xl bg-slate-900 px-3 py-2 text-sm text-slate-200 ring-1 ring-slate-800 hover:bg-slate-800"
                >
                  Close
                </button>
              </div>

              <div className="mt-5 grid gap-6">
                <section className="rounded-2xl bg-slate-900/40 p-4 ring-1 ring-slate-800">
                  <div className="text-sm font-semibold">Custom card types</div>
                  <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                    <input
                      value={newKindName}
                      onChange={(e) => setNewKindName(e.target.value)}
                      placeholder="e.g., Student Pass"
                      className="flex-1 rounded-xl bg-slate-900 px-3 py-2 text-sm ring-1 ring-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                    <button
                      disabled={busy}
                      onClick={onAddKind}
                      className="rounded-xl bg-emerald-500 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-emerald-400 disabled:opacity-60"
                    >
                      Add
                    </button>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {cardKinds.map((k) => (
                      <button
                        key={k}
                        disabled={busy}
                        onClick={() => onDeleteKind(k)}
                        className="rounded-full bg-slate-950/40 px-3 py-1 text-xs text-slate-200 ring-1 ring-slate-800 hover:bg-slate-900 disabled:opacity-60"
                        title="Click to delete"
                      >
                        {k}
                      </button>
                    ))}
                  </div>
                </section>

                <section className="rounded-2xl bg-slate-900/40 p-4 ring-1 ring-slate-800">
                  <div className="text-sm font-semibold">Profiles / Dependents</div>
                  <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                    <input
                      value={newProfileName}
                      onChange={(e) => setNewProfileName(e.target.value)}
                      placeholder="e.g., Me / Dad / Wife"
                      className="flex-1 rounded-xl bg-slate-900 px-3 py-2 text-sm ring-1 ring-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                    <button
                      disabled={busy}
                      onClick={onAddProfile}
                      className="rounded-xl bg-emerald-500 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-emerald-400 disabled:opacity-60"
                    >
                      Add
                    </button>
                  </div>
                  <div className="mt-3 grid gap-2">
                    {profiles.length === 0 ? (
                      <div className="text-sm text-slate-400">No profiles yet.</div>
                    ) : (
                      profiles.map((p) => (
                        <div
                          key={p.id}
                          className="flex items-center justify-between gap-3 rounded-xl bg-slate-950/40 px-3 py-2 ring-1 ring-slate-800"
                        >
                          <div className="text-sm text-slate-200">{p.name}</div>
                          <button
                            disabled={busy}
                            onClick={() => onDeleteProfile(p.id, p.name)}
                            className="rounded-lg bg-red-500/10 px-3 py-1 text-xs text-red-200 ring-1 ring-red-500/30 hover:bg-red-500/15 disabled:opacity-60"
                          >
                            Delete
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                </section>

                <section className="rounded-2xl bg-slate-900/40 p-4 ring-1 ring-slate-800">
                  <div className="text-sm font-semibold">Renewal providers</div>
                  <div className="mt-3 grid gap-2 sm:grid-cols-2">
                    <input
                      value={newProviderName}
                      onChange={(e) => setNewProviderName(e.target.value)}
                      placeholder="Provider name (e.g., Passport portal)"
                      className="rounded-xl bg-slate-900 px-3 py-2 text-sm ring-1 ring-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                    <input
                      value={newProviderUrl}
                      onChange={(e) => setNewProviderUrl(e.target.value)}
                      placeholder="https://..."
                      inputMode="url"
                      className="rounded-xl bg-slate-900 px-3 py-2 text-sm ring-1 ring-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                  <div className="mt-2">
                    <button
                      disabled={busy}
                      onClick={onAddProvider}
                      className="rounded-xl bg-emerald-500 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-emerald-400 disabled:opacity-60"
                    >
                      Add provider
                    </button>
                  </div>
                  <div className="mt-3 grid gap-2">
                    {providers.length === 0 ? (
                      <div className="text-sm text-slate-400">No providers yet.</div>
                    ) : (
                      providers.map((p) => (
                        <div
                          key={p.id}
                          className="flex flex-col gap-2 rounded-xl bg-slate-950/40 px-3 py-2 ring-1 ring-slate-800 sm:flex-row sm:items-center sm:justify-between"
                        >
                          <div>
                            <div className="text-sm text-slate-200">{p.name}</div>
                            <div className="text-xs text-slate-400 break-all">{p.url}</div>
                          </div>
                          <button
                            disabled={busy}
                            onClick={() => onDeleteProvider(p.id, p.name)}
                            className="rounded-lg bg-red-500/10 px-3 py-1 text-xs text-red-200 ring-1 ring-red-500/30 hover:bg-red-500/15 disabled:opacity-60"
                          >
                            Delete
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                </section>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  )
}
