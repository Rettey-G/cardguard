export type CardKind = string

export type Profile = {
  id: string
  name: string
  createdAt: number
}

export type RenewalProvider = {
  id: string
  name: string
  url: string
  createdAt: number
}

export type CardRecord = {
  id: string
  kind: CardKind
  title: string
  issuer?: string
  expiryDate: string // YYYY-MM-DD
  renewUrl?: string
  profileId?: string
  renewalProviderId?: string
  notes?: string
  createdAt: number
  updatedAt: number
}

export type CardAttachment = {
  id: string
  name: string
  contentType: string
  blob: Blob
}

export type CardWithImage = CardRecord & {
  imageBlob?: Blob
  attachments?: CardAttachment[]
}

export type AppSettings = {
  reminderDays: number
  notificationsEnabled: boolean
}
