import { sql } from '@vercel/postgres'

// Types for our database
export interface CardRecord {
  id: string
  title: string
  issuer?: string
  expiryDate: string
  kind: string
  profileId?: string
  renewalProviderId?: string
  renewUrl?: string
  notes?: string
  createdAt: number
  updatedAt: number
}

export interface Profile {
  id: string
  name: string
  createdAt: number
}

export interface RenewalProvider {
  id: string
  name: string
  url: string
  createdAt: number
}

export interface CardKind {
  name: string
  createdAt: number
}

export interface AppSettings {
  reminderDays: number
  notificationsEnabled: boolean
}

// Database operations
export async function listCards(): Promise<CardRecord[]> {
  const result = await sql<CardRecord>`
    SELECT * FROM cards 
    ORDER BY expiryDate ASC
  `
  return result.rows
}

export async function createCard(card: Omit<CardRecord, 'createdAt' | 'updatedAt'>): Promise<void> {
  const now = Date.now()
  await sql`
    INSERT INTO cards (id, title, issuer, expiryDate, kind, profileId, renewalProviderId, renewUrl, notes, createdAt, updatedAt)
    VALUES (${card.id}, ${card.title}, ${card.issuer}, ${card.expiryDate}, ${card.kind}, ${card.profileId}, ${card.renewalProviderId}, ${card.renewUrl}, ${card.notes}, ${now}, ${now})
  `
}

export async function updateCard(card: CardRecord): Promise<void> {
  const now = Date.now()
  await sql`
    UPDATE cards 
    SET title = ${card.title}, issuer = ${card.issuer}, expiryDate = ${card.expiryDate}, kind = ${card.kind}, 
        profileId = ${card.profileId}, renewalProviderId = ${card.renewalProviderId}, renewUrl = ${card.renewUrl}, 
        notes = ${card.notes}, updatedAt = ${now}
    WHERE id = ${card.id}
  `
}

export async function deleteCard(id: string): Promise<void> {
  await sql`DELETE FROM cards WHERE id = ${id}`
}

export async function listCardKinds(): Promise<string[]> {
  const result = await sql<CardKind>`
    SELECT * FROM cardKinds 
    ORDER BY name ASC
  `
  return result.rows.map(k => k.name)
}

export async function createCardKind(name: string): Promise<void> {
  const now = Date.now()
  await sql`
    INSERT INTO cardKinds (name, createdAt) 
    VALUES (${name}, ${now})
    ON CONFLICT (name) DO NOTHING
  `
}

export async function deleteCardKind(name: string): Promise<void> {
  await sql`DELETE FROM cardKinds WHERE name = ${name}`
}

export async function listProfiles(): Promise<Profile[]> {
  const result = await sql<Profile>`
    SELECT * FROM profiles 
    ORDER BY name ASC
  `
  return result.rows
}

export async function createProfile(profile: Omit<Profile, 'createdAt'>): Promise<void> {
  const now = Date.now()
  await sql`
    INSERT INTO profiles (id, name, createdAt) 
    VALUES (${profile.id}, ${profile.name}, ${now})
  `
}

export async function deleteProfile(id: string): Promise<void> {
  await sql`DELETE FROM profiles WHERE id = ${id}`
}

export async function listRenewalProviders(): Promise<RenewalProvider[]> {
  const result = await sql<RenewalProvider>`
    SELECT * FROM renewalProviders 
    ORDER BY name ASC
  `
  return result.rows
}

export async function createRenewalProvider(provider: Omit<RenewalProvider, 'createdAt'>): Promise<void> {
  const now = Date.now()
  await sql`
    INSERT INTO renewalProviders (id, name, url, createdAt) 
    VALUES (${provider.id}, ${provider.name}, ${provider.url}, ${now})
  `
}

export async function deleteRenewalProvider(id: string): Promise<void> {
  await sql`DELETE FROM renewalProviders WHERE id = ${id}`
}

export async function getSettings(): Promise<AppSettings> {
  const result = await sql<AppSettings>`
    SELECT * FROM settings 
    WHERE key = 'app'
  `
  if (result.rows.length === 0) {
    const defaults: AppSettings = {
      reminderDays: 30,
      notificationsEnabled: false
    }
    await sql`
      INSERT INTO settings (key, reminderDays, notificationsEnabled) 
      VALUES ('app', ${defaults.reminderDays}, ${defaults.notificationsEnabled})
    `
    return defaults
  }
  return {
    reminderDays: result.rows[0].reminderDays,
    notificationsEnabled: result.rows[0].notificationsEnabled
  }
}

export async function saveSettings(settings: AppSettings): Promise<void> {
  await sql`
    UPDATE settings 
    SET reminderDays = ${settings.reminderDays}, notificationsEnabled = ${settings.notificationsEnabled}
    WHERE key = 'app'
  `
}
