import type { AppSettings, CardAttachment, CardRecord, CardWithImage, Profile, RenewalProvider } from './types'
import { supabase } from './supabase'

const IMAGE_BUCKET = 'card-images'
const AVATAR_BUCKET = 'profile-avatars'

function requireClient() {
  if (!supabase) throw new Error('Supabase is not configured')
  return supabase
}

async function getCurrentUserId(): Promise<string> {
  const sb = requireClient()
  const { data: { session } } = await sb.auth.getSession()
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
  if (!data) {
    return {
      reminderDays: 30,
      notificationsEnabled: false,
      defaultReminderDays: [30, 14, 7, 1]
    }
  }
  return {
    reminderDays: (data as any).reminderdays,
    notificationsEnabled: (data as any).notificationsenabled,
    defaultReminderDays: [30, 14, 7, 1] // fallback since column doesn't exist yet
  }
}

export async function saveSettings(settings: AppSettings): Promise<void> {
  const sb = requireClient()
  const userId = await getCurrentUserId()
  const { error } = await sb
    .from('settings')
    .upsert({ 
      key: 'app', 
      reminderdays: settings.reminderDays, 
      notificationsenabled: settings.notificationsEnabled,
      // omit defaultreminderdays until column is added
      user_id: userId 
    })
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

  const attachments: CardAttachment[] = []

  const listRes = await sb.storage.from(IMAGE_BUCKET).list(id, { limit: 100, offset: 0 })
  if (!listRes.error) {
    for (const obj of listRes.data ?? []) {
      if (!obj.name) continue
      const path = `${id}/${obj.name}`
      const dl = await sb.storage.from(IMAGE_BUCKET).download(path)
      if (dl.error || !dl.data) continue
      const ct = dl.data.type || 'application/octet-stream'
      attachments.push({
        id: obj.name,
        name: obj.name,
        contentType: ct,
        blob: dl.data
      })
    }
  }

  const legacyDl = await sb.storage.from(IMAGE_BUCKET).download(id)
  const legacyImageBlob = legacyDl.error ? undefined : legacyDl.data
  const imageBlob = legacyImageBlob ?? attachments.find((a) => a.contentType.startsWith('image/'))?.blob

  return {
    ...(data as any),
    createdAt: (data as any).createdat,
    updatedAt: (data as any).updatedat,
    expiryDate: (data as any).expirydate,
    renewUrl: (data as any).renewurl,
    profileId: (data as any).profileid,
    renewalProviderId: (data as any).renewalproviderid,
    imageBlob,
    attachments: attachments.length ? attachments : undefined
  }
}

export async function upsertCard(input: { card: CardRecord; imageBlob?: Blob; attachments?: CardAttachment[] }): Promise<void> {
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

  if (input.attachments) {
    const listRes = await sb.storage.from(IMAGE_BUCKET).list(input.card.id, { limit: 100, offset: 0 })
    if (!listRes.error) {
      const paths = (listRes.data ?? []).map((o) => `${input.card.id}/${o.name}`)
      if (paths.length) {
        const rm = await sb.storage.from(IMAGE_BUCKET).remove(paths)
        if (rm.error) throw rm.error
      }
    }

    for (const a of input.attachments) {
      const path = `${input.card.id}/${a.id}`
      const up = await sb.storage.from(IMAGE_BUCKET).upload(path, a.blob, {
        upsert: true,
        contentType: a.contentType || a.blob.type || 'application/octet-stream'
      })
      if (up.error) throw up.error
    }
  }
}

export async function deleteCard(id: string): Promise<void> {
  const sb = requireClient()
  const userId = await getCurrentUserId()
  const { error } = await sb.from('cards').delete().eq('id', id).eq('user_id', userId)
  if (error) throw error

  await sb.storage.from(IMAGE_BUCKET).remove([id])
  const listRes = await sb.storage.from(IMAGE_BUCKET).list(id, { limit: 100, offset: 0 })
  if (!listRes.error) {
    const paths = (listRes.data ?? []).map((o) => `${id}/${o.name}`)
    if (paths.length) {
      await sb.storage.from(IMAGE_BUCKET).remove(paths)
    }
  }
}

export async function listProfiles(): Promise<Profile[]> {
  const sb = requireClient()
  const userId = await getCurrentUserId()
  const { data, error } = await sb.from('profiles').select('*').eq('user_id', userId).order('name', { ascending: true })
  if (error) throw error
  return (data ?? []).map((row: any) => ({
    id: row.id,
    name: row.name,
    avatarUrl: row.avatarurl,
    createdAt: row.createdat
  })) as Profile[]
}

export async function createProfile(name: string): Promise<Profile> {
  const sb = requireClient()
  const userId = await getCurrentUserId()
  const profile = {
    id: crypto.randomUUID(),
    name: name.trim(),
    avatarurl: null,
    createdat: Date.now(),
    user_id: userId
  }
  const { error } = await sb.from('profiles').insert(profile)
  if (error) throw error
  return {
    id: profile.id,
    name: profile.name,
    avatarUrl: profile.avatarurl,
    createdAt: profile.createdat
  }
}

export async function updateProfile(input: { id: string; name: string; avatarUrl?: string | null }): Promise<void> {
  const sb = requireClient()
  const userId = await getCurrentUserId()
  const { error } = await sb
    .from('profiles')
    .update({ name: input.name.trim(), avatarurl: input.avatarUrl })
    .eq('id', input.id)
    .eq('user_id', userId)
  if (error) throw error
}

export async function saveProfileAvatar(profileId: string, file: File): Promise<string> {
  const sb = requireClient()
  const ext = file.name.split('.').pop() ?? 'jpg'
  const path = `${profileId}/avatar.${ext}`
  const { error } = await sb.storage.from(AVATAR_BUCKET).upload(path, file, { upsert: true, contentType: file.type })
  if (error) throw error
  const { data: { publicUrl } } = sb.storage.from(AVATAR_BUCKET).getPublicUrl(path)
  return publicUrl
}

export async function getProfileAvatar(profileId: string): Promise<string | null> {
  const sb = requireClient()
  const { data } = await sb.storage.from(AVATAR_BUCKET).list(profileId, { limit: 1 })
  if (!data?.length) return null
  const { data: { publicUrl } } = sb.storage.from(AVATAR_BUCKET).getPublicUrl(`${profileId}/${data[0].name}`)
  return publicUrl
}

export async function deleteProfileAvatar(profileId: string): Promise<void> {
  const sb = requireClient()
  const { data } = await sb.storage.from(AVATAR_BUCKET).list(profileId, { limit: 100 })
  if (data?.length) {
    const paths = data.map((f) => `${profileId}/${f.name}`)
    await sb.storage.from(AVATAR_BUCKET).remove(paths)
  }
}

export async function deleteProfile(id: string): Promise<void> {
  const sb = requireClient()
  const userId = await getCurrentUserId()
  const { error } = await sb.from('profiles').delete().eq('id', id).eq('user_id', userId)
  if (error) throw error
  // Also delete avatar files
  await deleteProfileAvatar(id)
}

export async function listRenewalProviders(): Promise<RenewalProvider[]> {
  const sb = requireClient()
  const userId = await getCurrentUserId()
  const { data, error } = await sb.from('renewalproviders').select('*').eq('user_id', userId).order('name', { ascending: true })
  if (error) throw error
  return (data ?? []).map((row: any) => ({
    ...row,
    createdAt: row.createdat,
    searchInstructions: row.searchinstructions
  })) as RenewalProvider[]
}

export async function createRenewalProvider(input: { 
  name: string; 
  url: string; 
  searchInstructions?: string 
}): Promise<RenewalProvider> {
  const sb = requireClient()
  const userId = await getCurrentUserId()
  const provider = {
    id: crypto.randomUUID(),
    name: input.name.trim(),
    url: input.url.trim(),
    searchinstructions: input.searchInstructions?.trim() || null,
    createdat: Date.now(),
    user_id: userId
  }
  const { error } = await sb.from('renewalproviders').insert(provider)
  if (error) throw error
  return {
    id: provider.id,
    name: provider.name,
    url: provider.url,
    searchInstructions: provider.searchinstructions,
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
