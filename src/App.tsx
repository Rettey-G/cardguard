import React, { useEffect, useMemo, useRef, useState } from 'react'
import type { AppSettings, CardAttachment, CardKind, CardRecord, Profile, RenewalProvider, RenewalStep } from './lib/types'
import { daysUntil, isExpired } from './lib/expiry'
import { scanCardImage } from './lib/ocr'
import { Auth } from './components/Auth'
import type { User } from '@supabase/supabase-js'
import html2canvas from 'html2canvas'
import { Analytics } from '@vercel/analytics/react'
import type { Language, Translation } from './lib/translations'
import { useTranslation, formatDays } from './lib/translations'
import './styles/dhivehi.css'
import {
  createPinVerifier,
  encryptNote,
  decryptNote,
  deriveNotesKey,
  loadLockConfig,
  saveLockConfig,
  verifyPin,
  type LockConfig
} from './lib/security'
import { createGoogleCalendarUrl, createAppleCalendarUrl, downloadICSFile } from './lib/calendar'
import {
  createCardKind,
  createProfile,
  updateProfile,
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

type SortMode = 'Expiry' | 'Created' | 'Issuer'

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
  const LOGO_SRC = '/image/CardGuard%20logo.png'
  const [user, setUser] = useState<User | null>(null)
  const [cards, setCards] = useState<CardRecord[]>([])
  const [filter, setFilter] = useState<FilterMode>('All')
  const [sortMode, setSortMode] = useState<SortMode>('Expiry')
  const [searchQuery, setSearchQuery] = useState('')
  const [expiringWithinDays, setExpiringWithinDays] = useState<7 | 14 | 30 | null>(null)
  const [filterKind, setFilterKind] = useState<string>('')
  const [filterProfileId, setFilterProfileId] = useState<string>('')
  const [filterProviderId, setFilterProviderId] = useState<string>('')
  const [settings, setSettings] = useState<AppSettings | null>(null)
  const [busy, setBusy] = useState(false)
  const [language, setLanguage] = useState<Language>('en')

  const [lockConfig, setLockConfig] = useState<LockConfig>(() => loadLockConfig())
  const [locked, setLocked] = useState(false)
  const [unlockPin, setUnlockPin] = useState('')
  const [unlockError, setUnlockError] = useState<string | null>(null)
  const [notesKey, setNotesKey] = useState<CryptoKey | null>(null)
  const [pinSetupOpen, setPinSetupOpen] = useState(false)
  const [newPin, setNewPin] = useState('')
  const [newPin2, setNewPin2] = useState('')

  const [dbError, setDbError] = useState<string | null>(null)
  const t = useTranslation(language)

  const [cardKinds, setCardKinds] = useState<CardKind[]>([])
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [providers, setProviders] = useState<RenewalProvider[]>([])

  const [manageOpen, setManageOpen] = useState(false)
  const [newKindName, setNewKindName] = useState('')
  const [newProfileName, setNewProfileName] = useState('')
  const [newProviderName, setNewProviderName] = useState('')
  const [newProviderUrl, setNewProviderUrl] = useState('')
  const [newProviderInstructions, setNewProviderInstructions] = useState('')

  const seededVehicleKindsRef = useRef(false)

  // Reminder settings
  const [selectedReminderDays, setSelectedReminderDays] = useState<number[]>([30, 14, 7, 1])
  const [showCalendarMenu, setShowCalendarMenu] = useState<string | null>(null) // cardId
  
  // Renewal steps
  const [renewalStepsOpen, setRenewalStepsOpen] = useState<string | null>(null) // cardId
  const [steps, setSteps] = useState<RenewalStep[]>([])
  const [newStepTitle, setNewStepTitle] = useState('')
  const [newStepDescription, setNewStepDescription] = useState('')
  const [newStepRequired, setNewStepRequired] = useState(true)

  const [viewingId, setViewingId] = useState<string | null>(null)
  const [viewingTitle, setViewingTitle] = useState<string>('')
  const [viewingUrl, setViewingUrl] = useState<string | null>(null)
  const [viewingMissing, setViewingMissing] = useState(false)
  const [viewingAttachments, setViewingAttachments] = useState<CardAttachment[]>([])
  const [viewingAttachmentIndex, setViewingAttachmentIndex] = useState(0)
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

    // If lock is enabled, decrypt notes only when unlocked.
    if (lockConfig.enabled) {
      if (!notesKey) {
        // Do not keep encrypted notes in memory when locked.
        setCards(
          all.map((c) => ({
            ...c,
            notes: undefined
          }))
        )
        return
      }

      const decrypted = await Promise.all(
        all.map(async (c) => {
          if (!c.notes) return c
          try {
            const plain = await decryptNote(c.notes, notesKey)
            return { ...c, notes: plain }
          } catch {
            return { ...c, notes: undefined }
          }
        })
      )
      setCards(decrypted)
      return
    }

    setCards(all)
  }

  async function refreshMeta() {
    const [kinds0, p, prov] = await Promise.all([listCardKinds(), listProfiles(), listRenewalProviders()])

    if (!seededVehicleKindsRef.current) {
      const mustHave = ['Vehicle Insurance', 'Roadworthiness', 'Annual Fee']
      const missing = mustHave.filter((x) => !kinds0.includes(x))
      if (missing.length > 0) {
        seededVehicleKindsRef.current = true
        await Promise.all(missing.map((k) => createCardKind(k)))
        const kinds1 = await listCardKinds()
        setCardKinds(kinds1)
        setProfiles(p)
        setProviders(prov)
        if (!kind && kinds1.length > 0 && formOpen) {
          setKind(kinds1[0])
        }
        return
      }
      seededVehicleKindsRef.current = true
    }

    setCardKinds(kinds0)
    setProfiles(p)
    setProviders(prov)
    // Set default card kind if none selected and form is open
    if (!kind && kinds0.length > 0 && formOpen) {
      setKind(kinds0[0])
    }
  }

  useEffect(() => {
    // Lock immediately on load if enabled.
    setLocked(lockConfig.enabled)

    ;(async () => {
      try {
        const s = await getSettings()
        setSettings(s)
        await refreshMeta()
        // Only load cards if not locked.
        if (!lockConfig.enabled) {
          await refresh()
        }
      } catch (err) {
        console.error('CardGuard local storage error:', err)
        setDbError(null)
      }
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    function onVis() {
      if (!lockConfig.enabled) return
      if (document.hidden) {
        setLocked(true)
        setUnlockPin('')
        setUnlockError(null)
        setNotesKey(null)
        setCards([])
        setFormOpen(false)
        setManageOpen(false)
        closeView()
      }
    }
    document.addEventListener('visibilitychange', onVis)
    return () => document.removeEventListener('visibilitychange', onVis)
  }, [lockConfig.enabled])

  async function onUnlock() {
    if (!lockConfig.enabled) return
    if (!unlockPin || unlockPin.length !== 6) {
      setUnlockError('Enter 6-digit PIN')
      return
    }
    const ok = await verifyPin(unlockPin, lockConfig)
    if (!ok) {
      setUnlockError('Incorrect PIN')
      return
    }
    if (!lockConfig.pinSaltB64) {
      setUnlockError('PIN not configured')
      return
    }

    try {
      const key = await deriveNotesKey(unlockPin, lockConfig.pinSaltB64)
      setNotesKey(key)
      setLocked(false)
      setUnlockPin('')
      setUnlockError(null)
      await refresh()
      await refreshMeta()
    } catch (e) {
      setUnlockError(e instanceof Error ? e.message : 'Unlock failed')
    }
  }

  async function enableLockWithNewPin() {
    if (newPin.length !== 6 || newPin2.length !== 6) {
      setUnlockError('PIN must be 6 digits')
      return
    }
    if (newPin !== newPin2) {
      setUnlockError('PINs do not match')
      return
    }

    const { pinSaltB64, pinVerifierB64 } = await createPinVerifier(newPin)
    const cfg: LockConfig = { enabled: true, pinSaltB64, pinVerifierB64 }
    saveLockConfig(cfg)
    setLockConfig(cfg)
    setNotesKey(null)
    setLocked(true)
    setPinSetupOpen(false)
    setNewPin('')
    setNewPin2('')
    setUnlockPin('')
    setUnlockError(null)
    setCards([])
  }

  function disableLock() {
    const cfg: LockConfig = { enabled: false, pinSaltB64: null, pinVerifierB64: null }
    saveLockConfig(cfg)
    setLockConfig(cfg)
    setLocked(false)
    setNotesKey(null)
    setUnlockError(null)
  }

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

    const providerById = new Map(providers.map((p) => [p.id, p]))
    const profileById = new Map(profiles.map((p) => [p.id, p]))

    const q = searchQuery.trim().toLowerCase()

    const by = cards.map((card) => {
      const days = daysUntil(card.expiryDate)
      const expired = days < 0
      const expiringSoon = days >= 0 && days <= reminderDays
      const providerName = card.renewalProviderId ? providerById.get(card.renewalProviderId)?.name ?? '' : ''
      const profileName = card.profileId ? profileById.get(card.profileId)?.name ?? '' : 'Personal'

      return {
        card,
        days,
        expired,
        expiringSoon,
        providerName,
        profileName
      }
    })

    const filtered = by
      .filter((x) => {
        if (filter === 'All') return true
        if (filter === 'Expired') return x.expired
        if (filter === 'Expiring') return x.expiringSoon
        return true
      })
      .filter((x) => {
        if (!expiringWithinDays) return true
        return x.days >= 0 && x.days <= expiringWithinDays
      })
      .filter((x) => {
        if (!filterKind) return true
        return x.card.kind === filterKind
      })
      .filter((x) => {
        if (!filterProfileId) return true
        return (x.card.profileId || 'personal') === filterProfileId
      })
      .filter((x) => {
        if (!filterProviderId) return true
        return (x.card.renewalProviderId || '') === filterProviderId
      })
      .filter((x) => {
        if (!q) return true
        const hay = [
          x.card.title,
          x.card.issuer ?? '',
          x.card.notes ?? '',
          x.card.kind,
          x.providerName,
          x.profileName
        ]
          .join(' ')
          .toLowerCase()
        return hay.includes(q)
      })

    const expiringSoonCount = by.filter((x) => x.expiringSoon).length
    const expiredCount = by.filter((x) => x.expired).length

    const compare = (a: (typeof filtered)[number], b: (typeof filtered)[number]) => {
      if (sortMode === 'Created') {
        return a.card.createdAt - b.card.createdAt
      }
      if (sortMode === 'Issuer') {
        const ai = (a.card.issuer ?? '').toLowerCase()
        const bi = (b.card.issuer ?? '').toLowerCase()
        const cmp = ai.localeCompare(bi)
        if (cmp !== 0) return cmp
        return a.card.expiryDate.localeCompare(b.card.expiryDate)
      }
      return a.card.expiryDate.localeCompare(b.card.expiryDate)
    }

    // Group cards by profile
    const groupedByProfile = filtered.reduce(
      (acc, item) => {
        const profileId = item.card.profileId || 'personal'
        let profile

        if (profileId === 'personal') {
          profile = { id: 'personal', name: 'Personal', createdAt: 0 }
        } else {
          profile = profiles.find((p) => p.id === profileId)
          if (!profile) {
            console.log(`Profile ${profileId} not found, moving to Personal`)
            profile = { id: 'personal', name: 'Personal', createdAt: 0 }
          }
        }

        if (!acc[profile.id]) {
          acc[profile.id] = {
            profile,
            cards: []
          }
        }
        acc[profile.id].cards.push(item)
        return acc
      },
      {} as Record<string, { profile: Profile; cards: typeof filtered }>
    )

    const profileGroups = Object.values(groupedByProfile).map((g) => ({
      ...g,
      cards: [...g.cards].sort(compare)
    }))

    return { filtered, expiringSoonCount, expiredCount, profileGroups }
  }, [
    cards,
    filter,
    settings,
    profiles,
    providers,
    searchQuery,
    expiringWithinDays,
    filterKind,
    filterProfileId,
    filterProviderId,
    sortMode
  ])

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
    setSelectedReminderDays([30, 14, 7, 1])
    setSteps([])
    setScanMsg(null)
    if (fileRef.current) fileRef.current.value = ''
    setFormOpen(true)
  }

  function openAddForProfile(nextProfileId: string) {
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
    setProfileId(nextProfileId) // Pre-fill profile
    setRenewalProviderId('')
    setRenewUrl('')
    setNotes('')
    setSelectedReminderDays([30, 14, 7, 1])
    setSteps([])
    setScanMsg(null)
    if (fileRef.current) fileRef.current.value = ''
    setFormOpen(true)
  }

  async function openView(cardId: string) {
    const c = cards.find((x) => x.id === cardId)
    setViewingTitle(c?.title ?? 'Card image')
    setViewingId(cardId)
    setViewingMissing(false)
    setViewingAttachments([])
    setViewingAttachmentIndex(0)

    if (viewingUrl) {
      URL.revokeObjectURL(viewingUrl)
      setViewingUrl(null)
    }

    const full = await getCard(cardId)
    const attachments: CardAttachment[] =
      full?.attachments && full.attachments.length
        ? full.attachments
        : full?.imageBlob
          ? [
              {
                id: 'image',
                name: 'image',
                contentType: full.imageBlob.type || 'application/octet-stream',
                blob: full.imageBlob
              }
            ]
          : []

    setViewingAttachments(attachments)

    const first = attachments[0]
    if (!first?.blob) {
      setViewingMissing(true)
      return
    }

    const url = URL.createObjectURL(first.blob)
    setViewingUrl(url)
  }

  function closeView() {
    setViewingId(null)
    setViewingTitle('')
    setViewingMissing(false)
    setViewingAttachments([])
    setViewingAttachmentIndex(0)
    setShowCalendarMenu(null)
    setRenewalStepsOpen(null)
    if (viewingUrl) {
      URL.revokeObjectURL(viewingUrl)
      setViewingUrl(null)
    }
  }

  function onSelectViewingAttachment(index: number) {
    const next = viewingAttachments[index]
    if (!next) return
    setViewingAttachmentIndex(index)
    if (viewingUrl) {
      URL.revokeObjectURL(viewingUrl)
      setViewingUrl(null)
    }
    setViewingUrl(URL.createObjectURL(next.blob))
  }

  async function downloadViewingAttachment() {
    const a = viewingAttachments[viewingAttachmentIndex]
    if (!a) return
    const url = URL.createObjectURL(a.blob)
    const el = document.createElement('a')
    el.href = url
    el.download = a.name || 'attachment'
    document.body.appendChild(el)
    el.click()
    el.remove()
    URL.revokeObjectURL(url)
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
    setSelectedReminderDays(c.reminderDays ?? [30, 14, 7, 1])
    setSteps(c.renewalSteps ?? [])
    setScanMsg(null)
    if (fileRef.current) fileRef.current.value = ''
    setFormOpen(true)
  }

  async function onScanImage() {
    const files = Array.from(fileRef.current?.files ?? [])
    const file = files.find((f) => f.type.startsWith('image/'))
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

    if (lockConfig.enabled && !notesKey) {
      return
    }

    setBusy(true)
    try {
      const now = Date.now()

      let storedNotes: string | undefined = notes.trim() ? notes.trim() : undefined
      if (lockConfig.enabled && storedNotes && notesKey) {
        storedNotes = await encryptNote(storedNotes, notesKey)
      }

      const card: CardRecord = {
        id: editingId ?? newId(),
        kind,
        title: title.trim(),
        issuer: issuer.trim() ? issuer.trim() : undefined,
        expiryDate,
        profileId: profileId || undefined,
        renewalProviderId: renewalProviderId || undefined,
        renewUrl: normalizeUrl(renewUrl) || undefined,
        notes: storedNotes,
        reminderDays: selectedReminderDays.length > 0 ? selectedReminderDays : undefined,
        renewalSteps: steps.length > 0 ? steps : undefined,
        createdAt: editingId ? cards.find((c) => c.id === editingId)?.createdAt ?? now : now,
        updatedAt: now
      }

      const files = Array.from(fileRef.current?.files ?? [])
      const attachments: CardAttachment[] = files.map((f, idx) => {
        const nameLower = f.name.toLowerCase()
        const contentType =
          f.type || (nameLower.endsWith('.pdf') ? 'application/pdf' : 'application/octet-stream')

        return {
          id: `${String(idx + 1).padStart(2, '0')}-${f.name}`,
          name: f.name,
          contentType,
          blob: f.slice(0, f.size, contentType)
        }
      })

      const firstImage = files.find((f) => f.type.startsWith('image/'))
      const imageBlob = firstImage ? firstImage.slice(0, firstImage.size, firstImage.type) : undefined

      await upsertCard({ card, imageBlob, attachments: attachments.length ? attachments : undefined })
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
    if (!newProviderName.trim() || !newProviderUrl.trim()) return
    setBusy(true)
    try {
      await createRenewalProvider({ 
        name: newProviderName.trim(), 
        url: normalizeUrl(newProviderUrl.trim()) || '',
        searchInstructions: newProviderInstructions.trim() || undefined
      })
      setNewProviderName('')
      setNewProviderUrl('')
      setNewProviderInstructions('')
      await refreshMeta()
    } finally {
      setBusy(false)
    }
  }

  // Renewal steps helpers
  function addRenewalStep() {
    if (!newStepTitle.trim()) return
    const newStep: RenewalStep = {
      id: newId(),
      title: newStepTitle.trim(),
      description: newStepDescription.trim() || undefined,
      required: newStepRequired,
      completed: false,
      order: steps.length,
      documentIds: []
    }
    setSteps([...steps, newStep])
    setNewStepTitle('')
    setNewStepDescription('')
    setNewStepRequired(true)
  }

  function updateRenewalStep(stepId: string, updates: Partial<RenewalStep>) {
    setSteps(steps.map(s => s.id === stepId ? { ...s, ...updates } : s))
  }

  function deleteRenewalStep(stepId: string) {
    setSteps(steps.filter(s => s.id !== stepId))
  }

  function moveRenewalStep(stepId: string, direction: 'up' | 'down') {
    const index = steps.findIndex(s => s.id === stepId)
    if (index === -1) return
    const newIndex = direction === 'up' ? index - 1 : index + 1
    if (newIndex < 0 || newIndex >= steps.length) return
    const newSteps = [...steps]
    ;[newSteps[index], newSteps[newIndex]] = [newSteps[newIndex], newSteps[index]]
    // Update order property
    newSteps.forEach((s, i) => s.order = i)
    setSteps(newSteps)
  }

  // Calendar helpers
  function openRenewWithInstructions(cardId: string) {
    const c = cards.find((x) => x.id === cardId)
    if (!c) return

    if (c.renewUrl) {
      window.open(c.renewUrl, '_blank')
      return
    }

    if (c.renewalProviderId) {
      const provider = providers.find((p) => p.id === c.renewalProviderId)
      if (provider?.url) {
        window.open(provider.url, '_blank')
        if (provider.searchInstructions) {
          alert(`Provider Instructions: ${provider.searchInstructions}`)
        }
        return
      }
    }

    alert('No renewal URL available for this card.')
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

  async function onRenameProfile() {
    if (profiles.length === 0) {
      alert('No profiles to rename')
      return
    }
    
    const choice = window.prompt(
      `Choose profile to rename:\n\n` +
      profiles.map((p, i) => `${i + 1}. ${p.name}`).join('\n') +
      `\n\nEnter number (1-${profiles.length}):`
    )
    
    if (!choice) return
    const index = parseInt(choice) - 1
    if (isNaN(index) || index < 0 || index >= profiles.length) return
    
    const profile = profiles[index]
    const newName = window.prompt(`Rename "${profile.name}" to:`, profile.name)
    if (!newName) return
    if (!newName.trim()) return
    
    setBusy(true)
    try {
      await updateProfile({ id: profile.id, name: newName.trim() })
      await refreshMeta()
    } finally {
      setBusy(false)
    }
  }

  async function onMoveCard(cardId: string) {
    const card = cards.find(c => c.id === cardId)
    if (!card) return
    
    const options = [
      { id: '', name: 'Personal' },
      ...profiles.map(p => ({ id: p.id, name: p.name }))
    ]
    
    const currentLabel = card.profileId 
      ? options.find(o => o.id === card.profileId)?.name || 'Unknown'
      : 'Personal'
    
    const choice = window.prompt(
      `Move "${card.title}" from "${currentLabel}" to:\n\n` +
      options.map((o, i) => `${i + 1}. ${o.name}`).join('\n') +
      `\n\nEnter number (1-${options.length}):`
    )
    
    if (!choice) return
    const index = parseInt(choice) - 1
    if (isNaN(index) || index < 0 || index >= options.length) return
    
    setBusy(true)
    try {
      await upsertCard({ 
        card: { ...card, profileId: options[index].id },
        imageBlob: undefined,
        attachments: undefined
      })
      await refresh()
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

  function openRenew(cardId: string) {
    const c = cards.find((x) => x.id === cardId)
    if (!c) return
    
    // First try to use the card's direct renewUrl
    if (c.renewUrl) {
      window.open(c.renewUrl, '_blank')
      return
    }
    
    // If no direct URL, try to find the renewal provider
    if (c.renewalProviderId) {
      const provider = providers.find((p) => p.id === c.renewalProviderId)
      if (provider?.url) {
        window.open(provider.url, '_blank')
        return
      }
    }
    
    // If no renewal URL found, show alert
    alert('No renewal URL available for this card.')
  }

  function clearAllFilters() {
    setFilter('All')
    setSearchQuery('')
    setExpiringWithinDays(null)
    setFilterKind('')
    setFilterProfileId('')
    setFilterProviderId('')
    setSortMode('Expiry')
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
    <>
      <div
        className={`min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-slate-50 ${
          language === 'dv' ? 'dhivehi-font dhivehi-text' : ''
        }`}
      >
        <Auth onAuthChange={setUser} />
        <div className="mx-auto max-w-6xl px-4 py-6">
        {lockConfig.enabled && locked ? (
          <div className="fixed inset-0 z-[60] grid place-items-center bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 p-4">
            <div className="w-full max-w-sm rounded-3xl bg-slate-900/80 p-8 shadow-2xl backdrop-blur-xl ring-1 ring-slate-700/50">
              {/* Branded Header */}
              <div className="mb-8 flex flex-col items-center">
                <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500 to-emerald-600 text-2xl font-bold text-white shadow-lg overflow-hidden">
                  <img src={LOGO_SRC} alt="CardGuard" className="h-full w-full object-contain" />
                </div>
                <h2 className="text-xl font-bold text-slate-100">CardGuard</h2>
                <p className="mt-1 text-sm text-slate-400">Enter your PIN to continue</p>
              </div>

              {/* PIN Dots Display */}
              <div className="mb-6 flex justify-center gap-2">
                {[0, 1, 2, 3, 4, 5].map((i) => (
                  <div
                    key={i}
                    className={`h-3 w-3 rounded-full transition-all duration-200 ${
                      i < unlockPin.length
                        ? 'bg-emerald-500 shadow-lg shadow-emerald-500/40'
                        : 'bg-slate-700'
                    }`}
                  />
                ))}
              </div>

              {/* Hidden numeric input */}
              <input
                value={unlockPin}
                onChange={(e) => {
                  const v = e.target.value.replace(/\D/g, '').slice(0, 6)
                  setUnlockPin(v)
                  setUnlockError(null)
                  if (v.length === 6) {
                    setTimeout(() => onUnlock(), 100)
                  }
                }}
                inputMode="numeric"
                type="password"
                maxLength={6}
                className="sr-only"
                autoFocus
              />

              {/* Keypad */}
              <div className="grid grid-cols-3 gap-3">
                {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
                  <button
                    key={num}
                    type="button"
                    onClick={() => {
                      if (unlockPin.length < 6) {
                        const newPin = unlockPin + num
                        setUnlockPin(newPin)
                        setUnlockError(null)
                        if (newPin.length === 6) {
                          setTimeout(() => onUnlock(), 100)
                        }
                      }
                    }}
                    className="rounded-2xl bg-slate-800 py-4 text-lg font-semibold text-slate-100 shadow-inner transition-all hover:bg-slate-700 active:scale-95 active:bg-slate-600"
                  >
                    {num}
                  </button>
                ))}
                <button
                  type="button"
                  disabled={unlockPin.length === 0}
                  onClick={() => {
                    setUnlockPin(unlockPin.slice(0, -1))
                    setUnlockError(null)
                  }}
                  className="rounded-2xl bg-slate-800/40 py-4 text-sm font-medium text-slate-400 shadow-inner transition-all hover:bg-slate-700/40 active:scale-95 disabled:opacity-30"
                >
                  ⌫
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (unlockPin.length < 6) {
                      const newPin = unlockPin + '0'
                      setUnlockPin(newPin)
                      setUnlockError(null)
                      if (newPin.length === 6) {
                        setTimeout(() => onUnlock(), 100)
                      }
                    }
                  }}
                  className="rounded-2xl bg-slate-800 py-4 text-lg font-semibold text-slate-100 shadow-inner transition-all hover:bg-slate-700 active:scale-95 active:bg-slate-600"
                >
                  0
                </button>
                <button
                  type="button"
                  onClick={onUnlock}
                  disabled={unlockPin.length === 0}
                  className="rounded-2xl bg-emerald-500/10 py-4 text-sm font-medium text-emerald-400 shadow-inner transition-all hover:bg-emerald-500/20 active:scale-95 disabled:opacity-30"
                >
                  ✓
                </button>
              </div>

              {/* Error Message */}
              {unlockError ? (
                <div className="mt-4 text-center text-sm text-red-400 animate-pulse">
                  {unlockError}
                </div>
              ) : null}
            </div>
          </div>
        ) : null}

        {/* App Lock */}
        <section className="mb-8">
          <div className="rounded-xl bg-slate-950/40 p-4 ring-1 ring-slate-800">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-semibold text-slate-100">App Lock</div>
                <div className="text-xs text-slate-400">Locks the app when you background it. Uses a 6-digit PIN.</div>
              </div>
              {lockConfig.enabled ? (
                <button
                  type="button"
                  onClick={disableLock}
                  className="rounded-lg bg-slate-900 px-3 py-2 text-sm text-slate-200 ring-1 ring-slate-800 hover:bg-slate-800"
                >
                  Disable
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setPinSetupOpen(true)
                    setUnlockError(null)
                  }}
                  className="rounded-lg bg-emerald-500/10 px-3 py-2 text-sm text-emerald-200 ring-1 ring-emerald-500/30 hover:bg-emerald-500/15"
                >
                  Enable
                </button>
              )}
            </div>

            {pinSetupOpen ? (
              <div className="mt-4 grid gap-2">
                <div className="text-xs text-slate-300">Set a new 6-digit PIN</div>
                <input
                  value={newPin}
                  onChange={(e) => setNewPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  inputMode="numeric"
                  type="password"
                  placeholder="New PIN"
                  className="w-full rounded-xl bg-slate-900 px-3 py-2 text-sm ring-1 ring-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
                <input
                  value={newPin2}
                  onChange={(e) => setNewPin2(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  inputMode="numeric"
                  type="password"
                  placeholder="Confirm PIN"
                  className="w-full rounded-xl bg-slate-900 px-3 py-2 text-sm ring-1 ring-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
                {unlockError ? <div className="text-xs text-red-300">{unlockError}</div> : null}
                <div className="mt-2 flex gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setPinSetupOpen(false)
                      setNewPin('')
                      setNewPin2('')
                      setUnlockError(null)
                    }}
                    className="flex-1 rounded-xl bg-slate-900 px-3 py-2 text-sm text-slate-200 ring-1 ring-slate-800 hover:bg-slate-800"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={enableLockWithNewPin}
                    className="flex-1 rounded-xl bg-emerald-500 px-3 py-2 text-sm font-semibold text-slate-950 hover:bg-emerald-400"
                  >
                    Save PIN
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        </section>

        {/* Hero Section */}
        <header className="mb-8 text-center">
          <div className="mb-6 inline-flex items-center justify-center rounded-2xl bg-emerald-500/10 p-4 ring-1 ring-emerald-500/20">
            <img src={LOGO_SRC} alt="CardGuard" className="h-12 w-12 object-contain" />
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
              {t.addCardButton}
            </span>
            <div className="absolute inset-0 bg-gradient-to-r from-emerald-600 to-teal-600 opacity-0 transition-opacity group-hover:opacity-100" />
          </button>
          <button
            onClick={() => setManageOpen(true)}
            className="rounded-xl bg-slate-800/50 px-8 py-3 text-base font-medium text-slate-200 ring-1 ring-slate-700 transition-all hover:bg-slate-800 sm:px-6 sm:py-2 sm:text-sm"
          >
            {t.manageCards}
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
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </div>
            </div>
          </div>
          <div className="mt-4 flex items-center justify-between rounded-xl bg-slate-950/40 p-4 ring-1 ring-slate-800">
            <div className="flex items-center gap-2">
              <svg className="h-5 w-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
              </svg>
              <span className="text-sm text-slate-300">{t.reminderDays}:</span>
              <input
                type="number"
                min={1}
                max={365}
                value={settings?.reminderDays ?? 30}
                onChange={(e) => updateReminderDays(Number(e.target.value))}
                className="w-20 rounded-lg bg-slate-800 px-3 py-1 text-sm ring-1 ring-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
              <span className="text-sm text-slate-300">{t.daysBeforeExpiry}</span>
            </div>
            <button
              onClick={() => toggleNotifications(!settings?.notificationsEnabled)}
              className={`rounded-lg px-4 py-2 text-sm font-medium transition-all ${
                settings?.notificationsEnabled
                  ? 'bg-emerald-500/20 text-emerald-300 ring-1 ring-emerald-500/30'
                  : 'bg-slate-800 text-slate-400 ring-1 ring-slate-700 hover:bg-slate-700'
              }`}
            >
              {settings?.notificationsEnabled ? t.notificationsOn : t.notificationsOff}
            </button>
          </div>
        </section>

        {/* Language Toggle */}
        <section className="mb-8">
          <div className="flex items-center justify-between rounded-xl bg-slate-950/40 p-4 ring-1 ring-slate-800">
            <div className="flex items-center gap-2">
              <svg className="h-5 w-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129" />
              </svg>
              <span className="text-sm text-slate-300">Language / ބަހުރުވައް:</span>
            </div>
            <button
              onClick={() => setLanguage(language === 'en' ? 'dv' : 'en')}
              className={`rounded-lg px-4 py-2 text-sm font-medium transition-all ${
                language === 'dv'
                  ? 'bg-emerald-500/20 text-emerald-300 ring-1 ring-emerald-500/30 dhivehi-font'
                  : 'bg-slate-800 text-slate-400 ring-1 ring-slate-700 hover:bg-slate-700'
              }`}
            >
              {language === 'en' ? 'English' : 'ދިވެހިބަސް'}
            </button>
          </div>
        </section>

        {/* Filter and Cards */}
        <section className="mb-8">
          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex flex-wrap gap-2">
                {(['All', 'Expiring', 'Expired'] as const).map((m) => (
                  <button
                    key={m}
                    onClick={() => setFilter(m)}
                    className={`rounded-xl px-3 py-2 text-sm ring-1 ring-slate-800 ${
                      filter === m
                        ? 'bg-emerald-500/10 text-emerald-300 ring-emerald-500/30'
                        : 'bg-slate-800/50 text-slate-400 hover:bg-slate-800'
                    }`}
                  >
                    {m === 'All' ? t.filterAll : m === 'Expiring' ? t.filterExpiring : t.filterExpired}
                  </button>
                ))}
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-slate-950/20 px-3 py-2 text-xs text-slate-300 ring-1 ring-slate-800">
                <div>
                  Showing <span className="font-semibold text-slate-100">{derived.filtered.length}</span> of{' '}
                  <span className="font-semibold text-slate-100">{cards.length}</span>
                </div>
                <button
                  type="button"
                  onClick={clearAllFilters}
                  className="rounded-lg bg-slate-900 px-2 py-1 text-xs text-slate-200 ring-1 ring-slate-800 hover:bg-slate-800"
                >
                  Clear filters
                </button>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <label className="flex items-center gap-2 rounded-xl bg-slate-950/30 px-3 py-2 text-sm ring-1 ring-slate-800">
                <svg className="h-4 w-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M21 21l-4.35-4.35m0 0A7.5 7.5 0 105.25 5.25a7.5 7.5 0 0011.4 11.4z"
                  />
                </svg>
                <input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search title, issuer, notes, provider…"
                  className="w-full bg-transparent text-slate-200 placeholder:text-slate-500 focus:outline-none"
                />
              </label>

                <div className="flex flex-wrap items-center gap-2 rounded-xl bg-slate-950/30 px-3 py-2 text-sm ring-1 ring-slate-800">
                  <span className="text-slate-300">Expiring in:</span>
                  {([7, 14, 30] as const).map((d) => (
                    <button
                      key={d}
                      type="button"
                      onClick={() => setExpiringWithinDays(expiringWithinDays === d ? null : d)}
                      className={`rounded-lg px-2 py-1 text-xs ring-1 ${
                        expiringWithinDays === d
                          ? 'bg-emerald-500/10 text-emerald-300 ring-emerald-500/30'
                          : 'bg-slate-800/50 text-slate-300 ring-slate-700 hover:bg-slate-800'
                      }`}
                    >
                      {d}d
                    </button>
                  ))}
                  {expiringWithinDays ? (
                    <button
                      type="button"
                      onClick={() => setExpiringWithinDays(null)}
                      className="ml-auto text-xs text-slate-400 hover:text-slate-200"
                    >
                      Clear
                    </button>
                  ) : null}
                </div>

                <label className="flex items-center gap-2 rounded-xl bg-slate-950/30 px-3 py-2 text-sm ring-1 ring-slate-800">
                  <span className="text-slate-300">Sort:</span>
                  <select
                    value={sortMode}
                    onChange={(e) => setSortMode(e.target.value as SortMode)}
                    className="ml-auto w-full bg-transparent text-slate-200 focus:outline-none"
                  >
                    <option value="Expiry">Expiry date</option>
                    <option value="Created">Created</option>
                    <option value="Issuer">Issuer</option>
                  </select>
                </label>

                <label className="flex items-center gap-2 rounded-xl bg-slate-950/30 px-3 py-2 text-sm ring-1 ring-slate-800">
                  <span className="text-slate-300">Kind:</span>
                  <select
                    value={filterKind}
                    onChange={(e) => setFilterKind(e.target.value)}
                    className="ml-auto w-full bg-transparent text-slate-200 focus:outline-none"
                  >
                    <option value="">All</option>
                    {cardKinds.map((k) => (
                      <option key={k} value={k}>
                        {k}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="flex items-center gap-2 rounded-xl bg-slate-950/30 px-3 py-2 text-sm ring-1 ring-slate-800">
                  <span className="text-slate-300">Profile:</span>
                  <select
                    value={filterProfileId}
                    onChange={(e) => setFilterProfileId(e.target.value)}
                    className="ml-auto w-full bg-transparent text-slate-200 focus:outline-none"
                  >
                    <option value="">All</option>
                    <option value="personal">Personal</option>
                    {profiles.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="flex items-center gap-2 rounded-xl bg-slate-950/30 px-3 py-2 text-sm ring-1 ring-slate-800">
                  <span className="text-slate-300">Provider:</span>
                  <select
                    value={filterProviderId}
                    onChange={(e) => setFilterProviderId(e.target.value)}
                    className="ml-auto w-full bg-transparent text-slate-200 focus:outline-none"
                  >
                    <option value="">All</option>
                    {providers.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            </div>
          </section>

        <section className="mt-6">
          {derived.filtered.length === 0 ? (
            <div className="rounded-2xl bg-slate-900/40 p-6 text-center text-sm text-slate-300 ring-1 ring-slate-800" dangerouslySetInnerHTML={{ __html: t.noCards }} />
          ) : (
            <div className="space-y-6">
              {derived.profileGroups.map(({ profile, cards }) => (
                <div key={profile.id}>
                  <div className="mb-3 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <h3 className="text-lg font-semibold text-slate-100">
                        {profile.name}
                      </h3>
                      {profile.id !== 'personal' && (
                        <button
                          disabled={busy}
                          onClick={() => onRenameProfile()}
                          className="rounded-lg bg-slate-900 px-2 py-1 text-xs text-slate-200 ring-1 ring-slate-800 hover:bg-slate-800 disabled:opacity-60"
                        >
                          {t.rename}
                        </button>
                      )}
                    </div>
                    <button
                      onClick={() => openAddForProfile(profile.id === 'personal' ? '' : profile.id)}
                      className="rounded-xl bg-emerald-500/10 px-3 py-1 text-sm text-emerald-300 ring-1 ring-emerald-500/30 hover:bg-emerald-500/15"
                    >
                      + {t.addCard}
                    </button>
                  </div>
                  <div className="grid gap-3">
                    {cards.map(({ card, days, expired, expiringSoon }) => (
                      <article
                        key={card.id}
                        className="rounded-2xl bg-slate-900/40 p-4 ring-1 ring-slate-800 hover:ring-slate-700 transition-all"
                      >
                        <div className="flex items-start gap-4">
                          {/* Card Icon */}
                          <div className="flex-shrink-0">
                            <div className="h-12 w-16 rounded-lg bg-gradient-to-br from-emerald-200 via-emerald-400 to-emerald-600 ring-1 ring-black/20 flex items-center justify-center overflow-hidden">
                              {card.kind.toLowerCase().includes('driving') || card.kind.toLowerCase().includes('license') ? (
                                <img src="/icons/driving licence.png" alt="Driving License" className="h-8 w-8 object-contain" />
                              ) : card.kind.toLowerCase().includes('passport') ? (
                                <img src="/icons/passport.png" alt="Passport" className="h-8 w-8 object-contain" />
                              ) : card.kind.toLowerCase().includes('id') || card.kind.toLowerCase().includes('card') ? (
                                <img src="/icons/id-card.png" alt="ID Card" className="h-8 w-8 object-contain" />
                              ) : (
                                <svg className="h-6 w-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                                </svg>
                              )}
                            </div>
                          </div>

                          {/* Card Content */}
                          <div className="flex-1 min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <h2 className="text-base font-semibold text-slate-100 truncate">{card.title}</h2>
                              <span className="rounded-full bg-slate-950/40 px-2 py-1 text-xs text-slate-300 ring-1 ring-slate-800">
                                {card.kind}
                              </span>
                              {expired ? (
                                <span className="rounded-full bg-red-500/15 px-2 py-1 text-xs text-red-200 ring-1 ring-red-500/30">
                                  {t.expired}
                                </span>
                              ) : expiringSoon ? (
                                <span className="rounded-full bg-amber-500/15 px-2 py-1 text-xs text-amber-200 ring-1 ring-amber-500/30">
                                  {t.expiringSoon}
                                </span>
                              ) : null}
                            </div>
                            <div className="mt-1 text-sm text-slate-400 flex items-center gap-2">
                              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                              </svg>
                              {card.issuer}
                            </div>
                            <div className="mt-1 text-xs text-slate-400 flex items-center gap-2">
                              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                              </svg>
                              Expires: {new Date(card.expiryDate).toLocaleDateString()}
                            </div>
                            {card.notes && (
                              <div className="mt-2 text-xs text-slate-300 flex items-start gap-1">
                                <svg className="h-3 w-3 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                </svg>
                                <span className="line-clamp-2">{card.notes}</span>
                              </div>
                            )}
                          </div>

                          {/* Action Buttons */}
                          <div className="flex flex-col gap-2 flex-shrink-0">
                            {expired && (
                              <button
                                disabled={busy}
                                onClick={() => openRenew(card.id)}
                                className="rounded-xl bg-red-500/10 px-3 py-2 text-sm text-red-200 ring-1 ring-red-500/30 hover:bg-red-500/15 disabled:opacity-60"
                              >
                                {t.renew}
                              </button>
                            )}
                            {card.renewUrl && (
                              <button
                                disabled={busy}
                                onClick={() => window.open(card.renewUrl, '_blank')}
                                className="rounded-xl bg-slate-950/30 px-3 py-2 text-sm text-slate-200 ring-1 ring-slate-800 hover:bg-slate-900 disabled:opacity-60"
                              >
                                {t.renew}
                              </button>
                            )}

                            <button
                              disabled={busy}
                              onClick={() => openView(card.id)}
                              className="rounded-xl bg-slate-950/30 px-3 py-2 text-sm text-slate-200 ring-1 ring-slate-800 hover:bg-slate-900 disabled:opacity-60"
                            >
                              {t.viewFiles}
                            </button>

                            <button
                              disabled={busy}
                              onClick={() => onMoveCard(card.id)}
                              className="rounded-xl bg-blue-500/10 px-3 py-2 text-sm text-blue-200 ring-1 ring-blue-500/30 hover:bg-blue-500/15 disabled:opacity-60"
                            >
                              {t.move}
                            </button>

                            <button
                              disabled={busy}
                              onClick={() => openEdit(card.id)}
                              className="rounded-xl bg-slate-950/30 px-3 py-2 text-sm text-slate-200 ring-1 ring-slate-800 hover:bg-slate-900 disabled:opacity-60"
                            >
                              {t.edit}
                            </button>
                            <button
                              disabled={busy}
                              onClick={() => onDelete(card.id)}
                              className="rounded-xl bg-red-500/10 px-3 py-2 text-sm text-red-200 ring-1 ring-red-500/30 hover:bg-red-500/15 disabled:opacity-60"
                            >
                              {t.delete}
                            </button>
                          </div>
                        </div>
                      </article>
                    ))}
                  </div>
                </div>
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
                    <span className="text-xs text-slate-300">{t.expiryDate}</span>
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
                  <span className="text-xs text-slate-300">{t.profile} / Dependent (optional)</span>
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
                  <span className="text-xs text-slate-300">{t.cardTitle}</span>
                  <input
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder={t.cardTitlePlaceholder}
                    required
                    className="rounded-xl bg-slate-900 px-3 py-2 text-sm ring-1 ring-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </label>

                <label className="grid gap-1">
                  <span className="text-xs text-slate-300">{t.issuer} (optional)</span>
                  <input
                    value={issuer}
                    onChange={(e) => setIssuer(e.target.value)}
                    placeholder={t.issuerPlaceholder}
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
                  <span className="text-xs text-slate-300">Card files (optional)</span>
                  <input
                    ref={fileRef}
                    type="file"
                    multiple
                    accept="image/*,application/pdf"
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

                {/* Reminder Settings */}
                <div className="grid gap-2">
                  <div className="text-xs text-slate-300">{t.reminders}</div>
                  <div className="grid gap-2">
                    {[30, 14, 7, 1].map((days) => (
                      <label key={days} className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={selectedReminderDays.includes(days)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedReminderDays([...selectedReminderDays, days].sort((a, b) => b - a))
                            } else {
                              setSelectedReminderDays(selectedReminderDays.filter(d => d !== days))
                            }
                          }}
                          className="rounded border-slate-600 bg-slate-900 text-emerald-500 focus:ring-emerald-500 focus:ring-offset-0"
                        />
                        <span className="text-sm text-slate-200">{t.days[days as keyof typeof t.days]}</span>
                      </label>
                    ))}
                  </div>
                </div>

                {/* Renewal Steps */}
                <div className="grid gap-2">
                  <div className="flex items-center justify-between">
                    <div className="text-xs text-slate-300">{t.renewalSteps}</div>
                    <button
                      type="button"
                      onClick={() => setRenewalStepsOpen('new')}
                      className="rounded-xl bg-slate-800 px-3 py-1 text-xs text-slate-200 hover:bg-slate-700"
                    >
                      {t.addStep}
                    </button>
                  </div>
                  
                  {steps.length > 0 && (
                    <div className="grid gap-2">
                      {steps.sort((a, b) => a.order - b.order).map((step, index) => (
                        <div key={step.id} className="rounded-xl bg-slate-900 p-3 ring-1 ring-slate-700">
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <span className="text-xs text-slate-400">{index + 1}.</span>
                                <span className="text-sm font-medium text-slate-100">{step.title}</span>
                                {step.required && <span className="text-xs text-red-400">*</span>}
                                {step.completed && <span className="text-xs text-emerald-400">✓</span>}
                              </div>
                              {step.description && (
                                <div className="mt-1 text-xs text-slate-400">{step.description}</div>
                              )}
                            </div>
                            <div className="flex gap-1">
                              <button
                                type="button"
                                onClick={() => moveRenewalStep(step.id, 'up')}
                                disabled={index === 0}
                                className="rounded px-2 py-1 text-xs text-slate-400 hover:bg-slate-800 disabled:opacity-50"
                              >
                                ↑
                              </button>
                              <button
                                type="button"
                                onClick={() => moveRenewalStep(step.id, 'down')}
                                disabled={index === steps.length - 1}
                                className="rounded px-2 py-1 text-xs text-slate-400 hover:bg-slate-800 disabled:opacity-50"
                              >
                                ↓
                              </button>
                              <button
                                type="button"
                                onClick={() => deleteRenewalStep(step.id)}
                                className="rounded px-2 py-1 text-xs text-red-400 hover:bg-slate-800"
                              >
                                ×
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {renewalStepsOpen === 'new' && (
                    <div className="rounded-xl bg-slate-900 p-3 ring-1 ring-slate-700">
                      <div className="grid gap-2">
                        <input
                          value={newStepTitle}
                          onChange={(e) => setNewStepTitle(e.target.value)}
                          placeholder={t.stepTitle}
                          className="rounded-lg bg-slate-800 px-3 py-2 text-sm ring-1 ring-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                        />
                        <textarea
                          value={newStepDescription}
                          onChange={(e) => setNewStepDescription(e.target.value)}
                          placeholder={t.stepDescription}
                          rows={2}
                          className="rounded-lg bg-slate-800 px-3 py-2 text-sm ring-1 ring-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                        />
                        <label className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={newStepRequired}
                            onChange={(e) => setNewStepRequired(e.target.checked)}
                            className="rounded border-slate-600 bg-slate-800 text-emerald-500 focus:ring-emerald-500 focus:ring-offset-0"
                          />
                          <span className="text-sm text-slate-200">{t.required}</span>
                        </label>
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              addRenewalStep()
                              setRenewalStepsOpen(null)
                            }}
                            disabled={!newStepTitle.trim()}
                            className="rounded-lg bg-emerald-500 px-3 py-2 text-sm font-medium text-slate-950 hover:bg-emerald-400 disabled:opacity-60"
                          >
                            Add
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setRenewalStepsOpen(null)
                              setNewStepTitle('')
                              setNewStepDescription('')
                              setNewStepRequired(true)
                            }}
                            className="rounded-lg bg-slate-700 px-3 py-2 text-sm text-slate-200 hover:bg-slate-600"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                <label className="grid gap-1">
                  <span className="text-xs text-slate-300">{t.notes} (optional)</span>
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
                    {t.cancel}
                  </button>
                  <button
                    disabled={busy}
                    type="submit"
                    className="rounded-xl bg-emerald-500 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-emerald-400 active:bg-emerald-600 disabled:opacity-60"
                  >
                    {t.save}
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
                        {t.appTitle} v2.0
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
                        <div className="grid gap-3">
                          {viewingAttachments.length > 1 ? (
                            <div className="flex flex-wrap gap-2">
                              {viewingAttachments.map((a, idx) => (
                                <button
                                  key={`${a.id}-${idx}`}
                                  type="button"
                                  onClick={() => onSelectViewingAttachment(idx)}
                                  className={
                                    idx === viewingAttachmentIndex
                                      ? 'rounded-full bg-emerald-500/15 px-3 py-1 text-xs text-emerald-200 ring-1 ring-emerald-500/30'
                                      : 'rounded-full bg-slate-950/30 px-3 py-1 text-xs text-slate-200 ring-1 ring-slate-800 hover:bg-slate-900'
                                  }
                                  title={a.name}
                                >
                                  {idx === 0 ? 'Front' : idx === 1 ? 'Back' : `File ${idx + 1}`}
                                </button>
                              ))}
                            </div>
                          ) : null}

                          {(() => {
                            const a = viewingAttachments[viewingAttachmentIndex]
                            const nameLower = a?.name?.toLowerCase?.() ?? ''
                            const isPdf = a?.contentType === 'application/pdf' || nameLower.endsWith('.pdf')
                            const isImage = a?.contentType?.startsWith('image/')

                            if (isPdf) {
                              return (
                                <div className="grid gap-3">
                                  <a
                                    href={viewingUrl}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="inline-flex items-center justify-center rounded-xl bg-slate-900 px-4 py-2 text-sm text-slate-200 ring-1 ring-slate-800 hover:bg-slate-800"
                                  >
                                    Open PDF
                                  </a>
                                  <object
                                    data={viewingUrl}
                                    type="application/pdf"
                                    className="h-[60vh] w-full rounded-2xl ring-1 ring-slate-800"
                                  >
                                    <div className="rounded-2xl bg-slate-950/40 p-4 text-sm text-slate-300 ring-1 ring-slate-800">
                                      PDF preview not supported in this browser. Use Open PDF or Download.
                                    </div>
                                  </object>
                                </div>
                              )
                            }

                            if (isImage) {
                              return (
                                <img
                                  src={viewingUrl}
                                  alt={viewingTitle}
                                  className="w-full rounded-2xl ring-1 ring-slate-800"
                                />
                              )
                            }

                            return (
                              <div className="rounded-2xl bg-slate-950/40 p-4 text-sm text-slate-300 ring-1 ring-slate-800">
                                Preview not available. Use Download.
                              </div>
                            )
                          })()}
                        </div>
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
                {/* Calendar Integration */}
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setShowCalendarMenu(showCalendarMenu === viewingId ? null : viewingId)}
                    className="rounded-xl bg-slate-900 px-4 py-2 text-sm text-slate-200 ring-1 ring-slate-800 hover:bg-slate-800"
                  >
                    {t.addToCalendar}
                  </button>
                  
                  {showCalendarMenu === viewingId && viewingCard && (
                    <div className="absolute bottom-full mb-2 right-0 w-48 rounded-xl bg-slate-900 p-2 ring-1 ring-slate-700 shadow-lg">
                      <button
                        type="button"
                        onClick={() => {
                          const url = createGoogleCalendarUrl(
                            `${viewingCard.title} Renewal`,
                            viewingCard.expiryDate,
                            undefined,
                            `Card renewal for ${viewingCard.title}${viewingCard.issuer ? ` (${viewingCard.issuer})` : ''}`
                          )
                          window.open(url, '_blank')
                          setShowCalendarMenu(null)
                        }}
                        className="w-full rounded-lg px-3 py-2 text-left text-sm text-slate-200 hover:bg-slate-800"
                      >
                        Google Calendar
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          const url = createAppleCalendarUrl(
                            `${viewingCard.title} Renewal`,
                            viewingCard.expiryDate,
                            undefined,
                            `Card renewal for ${viewingCard.title}${viewingCard.issuer ? ` (${viewingCard.issuer})` : ''}`
                          )
                          window.open(url, '_blank')
                          setShowCalendarMenu(null)
                        }}
                        className="w-full rounded-lg px-3 py-2 text-left text-sm text-slate-200 hover:bg-slate-800"
                      >
                        Apple Calendar
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          downloadICSFile(
                            `${viewingCard.title} Renewal`,
                            viewingCard.expiryDate,
                            undefined,
                            `Card renewal for ${viewingCard.title}${viewingCard.issuer ? ` (${viewingCard.issuer})` : ''}`
                          )
                          setShowCalendarMenu(null)
                        }}
                        className="w-full rounded-lg px-3 py-2 text-left text-sm text-slate-200 hover:bg-slate-800"
                      >
                        Download .ics
                      </button>
                    </div>
                  )}
                </div>

                {/* Enhanced Renew Button with Instructions */}
                {viewingCard?.renewUrl || viewingCard?.renewalProviderId ? (
                  <button
                    type="button"
                    onClick={() => openRenewWithInstructions(viewingId)}
                    className="rounded-xl bg-blue-500 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-blue-400"
                  >
                    {t.renew}
                  </button>
                ) : null}

                {viewingAttachments.length ? (
                  <button
                    type="button"
                    disabled={shareBusy}
                    onClick={downloadViewingAttachment}
                    className="rounded-xl bg-slate-900 px-4 py-2 text-sm text-slate-200 ring-1 ring-slate-800 hover:bg-slate-800 disabled:opacity-60"
                  >
                    Download file
                  </button>
                ) : null}
                <button
                  type="button"
                  disabled={shareBusy}
                  onClick={downloadEcard}
                  className="rounded-xl bg-slate-900 px-4 py-2 text-sm text-slate-200 ring-1 ring-slate-800 hover:bg-slate-800 disabled:opacity-60"
                >
                  Download card
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

              {/* Renewal Steps Section */}
              {viewingCard?.renewalSteps && viewingCard.renewalSteps.length > 0 && (
                <div className="border-t border-slate-800 bg-slate-950/95 px-5 py-4">
                  <div className="mb-3 text-sm font-semibold text-slate-200">{t.renewalSteps}</div>
                  <div className="grid gap-2">
                    {viewingCard.renewalSteps.sort((a, b) => a.order - b.order).map((step, index) => (
                      <div key={step.id} className="rounded-xl bg-slate-900 p-3 ring-1 ring-slate-700">
                        <div className="flex items-start gap-3">
                          <div className="mt-0.5">
                            <div className={`h-4 w-4 rounded-full border-2 ${
                              step.completed 
                                ? 'border-emerald-500 bg-emerald-500' 
                                : 'border-slate-600 bg-slate-800'
                            }`}>
                              {step.completed && (
                                <svg className="h-3 w-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                </svg>
                              )}
                            </div>
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-medium text-slate-100">{step.title}</span>
                              {step.required && <span className="text-xs text-red-400">*</span>}
                            </div>
                            {step.description && (
                              <div className="mt-1 text-xs text-slate-400">{step.description}</div>
                            )}
                            {step.documentIds && step.documentIds.length > 0 && (
                              <div className="mt-2 text-xs text-slate-400">
                                {t.attachDocuments}: {step.documentIds.length} file(s)
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        ) : null}

        {manageOpen ? (
          <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/70 p-4">
            <div className="flex max-h-[90dvh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-slate-950 p-5 ring-1 ring-slate-800">
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

              <div className="mt-5 grid min-h-0 flex-1 gap-6 overflow-y-auto">
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
                          <div className="flex items-center gap-2">
                            <button
                              disabled={busy}
                              onClick={() => onRenameProfile()}
                              className="rounded-lg bg-slate-900 px-3 py-1 text-xs text-slate-200 ring-1 ring-slate-800 hover:bg-slate-800 disabled:opacity-60"
                            >
                              Rename
                            </button>
                            <button
                              disabled={busy}
                              onClick={() => onDeleteProfile(p.id, p.name)}
                              className="rounded-lg bg-red-500/10 px-3 py-1 text-xs text-red-200 ring-1 ring-red-500/30 hover:bg-red-500/15 disabled:opacity-60"
                            >
                              Delete
                            </button>
                          </div>
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
                    <textarea
                      value={newProviderInstructions}
                      onChange={(e) => setNewProviderInstructions(e.target.value)}
                      placeholder={t.searchInstructions}
                      rows={2}
                      className="w-full rounded-xl bg-slate-900 px-3 py-2 text-sm ring-1 ring-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500"
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
                          <div className="flex-1">
                            <div className="text-sm text-slate-200">{p.name}</div>
                            <div className="text-xs text-slate-400 break-all">{p.url}</div>
                            {p.searchInstructions && (
                              <div className="mt-1 text-xs text-slate-500 italic">{p.searchInstructions}</div>
                            )}
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
      <Analytics />
    </>
  )
}
