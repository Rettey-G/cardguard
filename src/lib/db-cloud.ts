import type { AppSettings, CardRecord, CardWithImage, Profile, RenewalProvider } from './types'
import { supabase } from './supabase'

const IMAGE_BUCKET = 'card-images'

function requireClient() {
  if (!supabase) throw new Error('Supabase is not configured')
  return supabase
}

async function getCurrentUserId(): Promise<string> {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session?.user?.id) throw new Error('User not authenticated')
  return session.user.id
}

export async function resetDatabase(): Promise<void> {
  return
}

export async function getSettings(): Promise<AppSettings> {
  const sb = requireClient()
  const userId = await getCurrentUserId()
  const { data, error } = await sb.from('settings').select('reminderdays,notificationsenabled').eq('user_id', userId).maybeSingle()
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
  const userId = await getCurrentUserId()
  const { error } = await sb
    .from('settings')
    .upsert({ key: 'app', reminderdays: settings.reminderDays, notificationsenabled: settings.notificationsEnabled, user_id: userId })
  if (error) throw error
}

export async function listCards(): Promise<CardRecord[]> {
  const sb = requireClient()
  const userId = await getCurrentUserId()
  const { data, error } = await sb.from('cards').select('*').eq('user_id', userId).order('expirydate', { ascending: true })
  if (error) throw error
  return (data ?? []).map((row: any) => ({
    ...row,
    createdAt: row.createdat,
    updatedAt: row.updatedat,
    expiryDate: row.expirydate,
    renewUrl: row.renewurl,
    profileId: row.profileid,
    renewalProviderId: row.renewalproviderid
  })) as CardRecord[]
}

export async function getCard(id: string): Promise<CardWithImage | undefined> {
  const sb = requireClient()
  const userId = await getCurrentUserId()
  const { data, error } = await sb.from('cards').select('*').eq('id', id).eq('user_id', userId).maybeSingle()
  if (error) throw error
  if (!data) return undefined

  const dl = await sb.storage.from(IMAGE_BUCKET).download(id)
  const imageBlob = dl.error ? undefined : dl.data

  return {
    ...(data as any),
    createdAt: (data as any).createdat,
    updatedAt: (data as any).updatedat,
    expiryDate: (data as any).expirydate,
    renewUrl: (data as any).renewurl,
    profileId: (data as any).profileid,
    renewalProviderId: (data as any).renewalproviderid,
    imageBlob
  }
}

export async function upsertCard(input: { card: CardRecord; imageBlob?: Blob }): Promise<void> {
  const sb = requireClient()
  const userId = await getCurrentUserId()
  const { error } = await sb.from('cards').upsert({
    id: input.card.id,
    kind: input.card.kind,
    title: input.card.title,
    issuer: input.card.issuer,
    expirydate: input.card.expiryDate,
    renewurl: input.card.renewUrl,
    profileid: input.card.profileId,
    renewalproviderid: input.card.renewalProviderId,
    notes: input.card.notes,
    createdat: input.card.createdAt,
    updatedat: input.card.updatedAt,
    user_id: userId
  })
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
  const userId = await getCurrentUserId()
  const { error } = await sb.from('cards').delete().eq('id', id).eq('user_id', userId)
  if (error) throw error
  await sb.storage.from(IMAGE_BUCKET).remove([id])
}

export async function listProfiles(): Promise<Profile[]> {
  const sb = requireClient()
  const userId = await getCurrentUserId()
  const { data, error } = await sb.from('profiles').select('*').eq('user_id', userId).order('name', { ascending: true })
  if (error) throw error
  return (data ?? []).map((row: any) => ({
    ...row,
    createdAt: row.createdat
  })) as Profile[]
}

export async function createProfile(name: string): Promise<Profile> {
  const sb = requireClient()
  const userId = await getCurrentUserId()
  const profile = {
    id: crypto.randomUUID(),
    name: name.trim(),
    createdat: Date.now(),
    user_id: userId
  }
  const { error } = await sb.from('profiles').insert(profile)
  if (error) throw error
  return {
    id: profile.id,
    name: profile.name,
    createdAt: profile.createdat
  }
}

export async function deleteProfile(id: string): Promise<void> {
  const sb = requireClient()
  const userId = await getCurrentUserId()
  const { error } = await sb.from('profiles').delete().eq('id', id).eq('user_id', userId)
  if (error) throw error
}

export async function listRenewalProviders(): Promise<RenewalProvider[]> {
  const sb = requireClient()
  const userId = await getCurrentUserId()
  const { data, error } = await sb.from('renewalproviders').select('*').eq('user_id', userId).order('name', { ascending: true })
  if (error) throw error
  return (data ?? []).map((row: any) => ({
    ...row,
    createdAt: row.createdat
  })) as RenewalProvider[]
}

export async function createRenewalProvider(input: { name: string; url: string }): Promise<RenewalProvider> {
  const sb = requireClient()
  const userId = await getCurrentUserId()
  const provider = {
    id: crypto.randomUUID(),
    name: input.name.trim(),
    url: input.url.trim(),
    createdat: Date.now(),
    user_id: userId
  }
  const { error } = await sb.from('renewalproviders').insert(provider)
  if (error) throw error
  return {
    id: provider.id,
    name: provider.name,
    url: provider.url,
    createdAt: provider.createdat
  }
}

export async function deleteRenewalProvider(id: string): Promise<void> {
  const sb = requireClient()
  const userId = await getCurrentUserId()
  const { error } = await sb.from('renewalproviders').delete().eq('id', id).eq('user_id', userId)
  if (error) throw error
}

export async function listCardKinds(): Promise<string[]> {
  const sb = requireClient()
  const { data, error } = await sb.from('cardkinds').select('name').order('name', { ascending: true })
  if (error) throw error
  return (data ?? []).map((x: any) => x.name as string)
}

export async function createCardKind(name: string): Promise<void> {
  const sb = requireClient()
  const trimmed = name.trim()
  if (!trimmed) return
  const { error } = await sb.from('cardkinds').upsert({ name: trimmed, createdat: Date.now() })
  if (error) throw error
}

export async function deleteCardKind(name: string): Promise<void> {
  const sb = requireClient()
  const { error } = await sb.from('cardkinds').delete().eq('name', name)
  if (error) throw error
}
