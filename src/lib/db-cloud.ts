import type { AppSettings, CardRecord, CardWithImage, Profile, RenewalProvider } from './types'
import { supabase } from './supabase'

const IMAGE_BUCKET = 'card-images'

function requireClient() {
  if (!supabase) throw new Error('Supabase is not configured')
  return supabase
}

export async function resetDatabase(): Promise<void> {
  return
}

export async function getSettings(): Promise<AppSettings> {
  const sb = requireClient()
  const { data, error } = await sb.from('settings').select('reminderDays,notificationsEnabled').eq('key', 'app').maybeSingle()
  if (error) throw error
  return (
    data ?? {
      reminderDays: 30,
      notificationsEnabled: false
    }
  )
}

export async function saveSettings(settings: AppSettings): Promise<void> {
  const sb = requireClient()
  const { error } = await sb
    .from('settings')
    .upsert({ key: 'app', reminderDays: settings.reminderDays, notificationsEnabled: settings.notificationsEnabled })
  if (error) throw error
}

export async function listCards(): Promise<CardRecord[]> {
  const sb = requireClient()
  const { data, error } = await sb.from('cards').select('*').order('expiryDate', { ascending: true })
  if (error) throw error
  return (data ?? []) as CardRecord[]
}

export async function getCard(id: string): Promise<CardWithImage | undefined> {
  const sb = requireClient()
  const { data, error } = await sb.from('cards').select('*').eq('id', id).maybeSingle()
  if (error) throw error
  if (!data) return undefined

  const dl = await sb.storage.from(IMAGE_BUCKET).download(id)
  const imageBlob = dl.error ? undefined : dl.data

  return { ...(data as CardRecord), imageBlob }
}

export async function upsertCard(input: { card: CardRecord; imageBlob?: Blob }): Promise<void> {
  const sb = requireClient()
  const { error } = await sb.from('cards').upsert(input.card)
  if (error) throw error

  if (input.imageBlob) {
    const up = await sb.storage.from(IMAGE_BUCKET).upload(input.card.id, input.imageBlob, {
      upsert: true,
      contentType: input.imageBlob.type || 'application/octet-stream'
    })
    if (up.error) throw up.error
  }
}

export async function deleteCard(id: string): Promise<void> {
  const sb = requireClient()
  const { error } = await sb.from('cards').delete().eq('id', id)
  if (error) throw error
  await sb.storage.from(IMAGE_BUCKET).remove([id])
}

export async function listProfiles(): Promise<Profile[]> {
  const sb = requireClient()
  const { data, error } = await sb.from('profiles').select('*').order('name', { ascending: true })
  if (error) throw error
  return (data ?? []) as Profile[]
}

export async function createProfile(name: string): Promise<Profile> {
  const sb = requireClient()
  const profile: Profile = { id: crypto.randomUUID(), name: name.trim(), createdAt: Date.now() }
  const { error } = await sb.from('profiles').insert(profile)
  if (error) throw error
  return profile
}

export async function deleteProfile(id: string): Promise<void> {
  const sb = requireClient()
  const { error } = await sb.from('profiles').delete().eq('id', id)
  if (error) throw error
}

export async function listRenewalProviders(): Promise<RenewalProvider[]> {
  const sb = requireClient()
  const { data, error } = await sb.from('renewalProviders').select('*').order('name', { ascending: true })
  if (error) throw error
  return (data ?? []) as RenewalProvider[]
}

export async function createRenewalProvider(input: { name: string; url: string }): Promise<RenewalProvider> {
  const sb = requireClient()
  const provider: RenewalProvider = {
    id: crypto.randomUUID(),
    name: input.name.trim(),
    url: input.url.trim(),
    createdAt: Date.now()
  }
  const { error } = await sb.from('renewalProviders').insert(provider)
  if (error) throw error
  return provider
}

export async function deleteRenewalProvider(id: string): Promise<void> {
  const sb = requireClient()
  const { error } = await sb.from('renewalProviders').delete().eq('id', id)
  if (error) throw error
}

export async function listCardKinds(): Promise<string[]> {
  const sb = requireClient()
  const { data, error } = await sb.from('cardKinds').select('name').order('name', { ascending: true })
  if (error) throw error
  return (data ?? []).map((x) => x.name as string)
}

export async function createCardKind(name: string): Promise<void> {
  const sb = requireClient()
  const trimmed = name.trim()
  if (!trimmed) return
  const { error } = await sb.from('cardKinds').upsert({ name: trimmed, createdAt: Date.now() })
  if (error) throw error
}

export async function deleteCardKind(name: string): Promise<void> {
  const sb = requireClient()
  const { error } = await sb.from('cardKinds').delete().eq('name', name)
  if (error) throw error
}
