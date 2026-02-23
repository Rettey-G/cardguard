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
  searchInstructions?: string // e.g. "Enter card number in the search field"
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
  reminderDays?: number[] // e.g. [30, 14, 7, 1]
  renewalSteps?: RenewalStep[]
  createdAt: number
  updatedAt: number
}

export type CardAttachment = {
  id: string
  name: string
  contentType: string
  blob: Blob
}

export type RenewalStep = {
  id: string
  title: string
  description?: string
  required: boolean
  completed: boolean
  documentIds?: string[] // attachment IDs
  order: number
}

export type CardWithImage = CardRecord & {
  imageBlob?: Blob
  attachments?: CardAttachment[]
}

export type AppSettings = {
  reminderDays: number
  notificationsEnabled: boolean
  defaultReminderDays: number[] // default for new cards
}
