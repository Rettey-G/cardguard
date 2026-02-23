import { deleteDB, openDB, type DBSchema } from 'idb'
import type {
  AppSettings,
  CardRecord,
  CardAttachment,
  CardWithImage,
  Profile,
  RenewalProvider
} from './types'

type CardImageRecord = {
  cardId: string
  blob: Blob
  updatedAt: number
}

type CardAttachmentRecord = {
  key: string
  cardId: string
  attachmentId: string
  name: string
  contentType: string
  blob: Blob
  updatedAt: number
}

interface CardGuardDb extends DBSchema {
  cards: {
    key: string
    value: CardRecord
    indexes: { 'by-expiry': string; 'by-kind': string }
  }
  cardImages: {
    key: string
    value: CardImageRecord
  }
  cardAttachments: {
    key: string
    value: CardAttachmentRecord
    indexes: { 'by-cardId': string }
  }
  profiles: {
    key: string
    value: Profile
  }
  renewalProviders: {
    key: string
    value: RenewalProvider
  }
  cardKinds: {
    key: string
    value: { name: string; createdAt: number }
  }
  settings: {
    key: 'app'
    value: AppSettings
  }
}

const DB_NAME = 'cardguard-db'
const DB_VERSION = 4

const DEFAULT_KINDS: string[] = [
  'Passport',
  'National ID',
  'Driving License',
  'Credit Card',
  'Debit Card',
  'Insurance Card',
  'Membership Card',
  'Other'
]

function newId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID()
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`
}

export async function getDb() {
  return openDB<CardGuardDb>(DB_NAME, DB_VERSION, {
    upgrade(db) {
      if (!db.objectStoreNames.contains('cards')) {
        const cards = db.createObjectStore('cards', { keyPath: 'id' })
        cards.createIndex('by-expiry', 'expiryDate')
        cards.createIndex('by-kind', 'kind')
      }

      if (!db.objectStoreNames.contains('cardImages')) {
        db.createObjectStore('cardImages', { keyPath: 'cardId' })
      }

      if (!db.objectStoreNames.contains('cardAttachments')) {
        const atts = db.createObjectStore('cardAttachments', { keyPath: 'key' })
        atts.createIndex('by-cardId', 'cardId')
      }

      if (!db.objectStoreNames.contains('profiles')) {
        db.createObjectStore('profiles', { keyPath: 'id' })
      }

      if (!db.objectStoreNames.contains('renewalProviders')) {
        db.createObjectStore('renewalProviders', { keyPath: 'id' })
      }

      if (!db.objectStoreNames.contains('cardKinds')) {
        const kinds = db.createObjectStore('cardKinds', { keyPath: 'name' })
        const createdAt = Date.now()
        for (const name of DEFAULT_KINDS) {
          kinds.put({ name, createdAt })
        }
      }

      if (!db.objectStoreNames.contains('settings')) {
        db.createObjectStore('settings')
      }
    },
    blocked() {
      // Another tab may be holding the old DB connection.
      console.warn('CardGuard DB upgrade blocked. Close other CardGuard tabs and reload.')
    },
    blocking() {
      // We are the old connection blocking a future upgrade.
      console.warn('CardGuard DB is blocking an upgrade. Reloading may be required.')
    },
    terminated() {
      console.warn('CardGuard DB connection terminated unexpectedly.')
    }
  })
}

export async function resetDatabase(): Promise<void> {
  await deleteDB(DB_NAME)
}

export async function getSettings(): Promise<AppSettings> {
  const db = await getDb()
  const existing = await db.get('settings', 'app')
  return (
    existing ?? {
      reminderDays: 30,
      notificationsEnabled: false
    }
  )
}

export async function saveSettings(settings: AppSettings): Promise<void> {
  const db = await getDb()
  await db.put('settings', settings, 'app')
}

export async function listCards(): Promise<CardRecord[]> {
  const db = await getDb()
  return db.getAll('cards')
}

export async function getCard(id: string): Promise<CardWithImage | undefined> {
  const db = await getDb()
  const card = await db.get('cards', id)
  if (!card) return undefined
  const image = await db.get('cardImages', id)

  const attachmentRecords = await db.getAllFromIndex('cardAttachments', 'by-cardId', id)
  const attachments: CardAttachment[] = attachmentRecords.map((r) => ({
    id: r.attachmentId,
    name: r.name,
    contentType: r.contentType,
    blob: r.blob
  }))

  const legacy = image?.blob
  const imageBlob = legacy ?? attachments.find((a) => a.contentType.startsWith('image/'))?.blob

  return {
    ...card,
    imageBlob,
    attachments: attachments.length ? attachments : undefined
  }
}

export async function upsertCard(input: {
  card: CardRecord
  imageBlob?: Blob
  attachments?: CardAttachment[]
}): Promise<void> {
  const db = await getDb()
  await db.put('cards', input.card)
  if (input.imageBlob) {
    await db.put('cardImages', {
      cardId: input.card.id,
      blob: input.imageBlob,
      updatedAt: Date.now()
    })
  }

  if (input.attachments) {
    const existing = await db.getAllFromIndex('cardAttachments', 'by-cardId', input.card.id)
    for (const r of existing) {
      await db.delete('cardAttachments', r.key)
    }
    const updatedAt = Date.now()
    for (const a of input.attachments) {
      const key = `${input.card.id}:${a.id}`
      await db.put('cardAttachments', {
        key,
        cardId: input.card.id,
        attachmentId: a.id,
        name: a.name,
        contentType: a.contentType,
        blob: a.blob,
        updatedAt
      })
    }
  }
}

export async function deleteCard(id: string): Promise<void> {
  const db = await getDb()
  await db.delete('cards', id)
  await db.delete('cardImages', id)
  const existing = await db.getAllFromIndex('cardAttachments', 'by-cardId', id)
  for (const r of existing) {
    await db.delete('cardAttachments', r.key)
  }
}

export async function listProfiles(): Promise<Profile[]> {
  const db = await getDb()
  const items = await db.getAll('profiles')
  items.sort((a, b) => a.name.localeCompare(b.name))
  return items
}

export async function createProfile(name: string): Promise<Profile> {
  const db = await getDb()
  const profile: Profile = { id: newId(), name: name.trim(), createdAt: Date.now() }
  await db.put('profiles', profile)
  return profile
}

export async function updateProfile(input: { id: string; name: string }): Promise<void> {
  const db = await getDb()
  const existing = await db.get('profiles', input.id)
  if (!existing) return
  await db.put('profiles', { ...existing, name: input.name.trim() })
}

export async function deleteProfile(id: string): Promise<void> {
  const db = await getDb()
  await db.delete('profiles', id)
}

export async function listRenewalProviders(): Promise<RenewalProvider[]> {
  const db = await getDb()
  const items = await db.getAll('renewalProviders')
  items.sort((a, b) => a.name.localeCompare(b.name))
  return items
}

export async function createRenewalProvider(input: {
  name: string
  url: string
}): Promise<RenewalProvider> {
  const db = await getDb()
  const provider: RenewalProvider = {
    id: newId(),
    name: input.name.trim(),
    url: input.url.trim(),
    createdAt: Date.now()
  }
  await db.put('renewalProviders', provider)
  return provider
}

export async function deleteRenewalProvider(id: string): Promise<void> {
  const db = await getDb()
  await db.delete('renewalProviders', id)
}

export async function listCardKinds(): Promise<string[]> {
  const db = await getDb()
  const items = await db.getAll('cardKinds')
  const names = items.map((x) => x.name)
  names.sort((a, b) => a.localeCompare(b))
  return names
}

export async function createCardKind(name: string): Promise<void> {
  const db = await getDb()
  const trimmed = name.trim()
  if (!trimmed) return
  await db.put('cardKinds', { name: trimmed, createdAt: Date.now() }, trimmed)
}

export async function deleteCardKind(name: string): Promise<void> {
  const db = await getDb()
  await db.delete('cardKinds', name)
}
