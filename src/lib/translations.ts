export type Language = 'en' | 'dv'

export interface Translation {
  appTitle: string
  addCard: string
  editCard: string
  cardTitle: string
  cardTitlePlaceholder: string
  issuer: string
  issuerPlaceholder: string
  expiryDate: string
  profile: string
  notes: string
  save: string
  cancel: string
  delete: string
  edit: string
  viewFiles: string
  renew: string
  move: string
  rename: string
  personal: string
  noCards: string
  addCardButton: string
  manageCards: string
  profiles: string
  addProfile: string
  deleteProfile: string
  renewalProviders: string
  addProvider: string
  providerName: string
  providerUrl: string
  settings: string
  reminderDays: string
  notifications: string
  language: string
  expiresToday: string
  daysLeft: string
  daysOverdue: string
  expired: string
  expiringSoon: string
  filterAll: string
  filterExpiring: string
  filterExpired: string
  daysBeforeExpiry: string
  notificationsOn: string
  notificationsOff: string
}

export const translations: Record<Language, Translation> = {
  en: {
    appTitle: 'CardGuard',
    addCard: 'Add Card',
    editCard: 'Edit Card',
    cardTitle: 'Card Title',
    cardTitlePlaceholder: 'e.g., Visa Platinum',
    issuer: 'Issuer',
    issuerPlaceholder: 'e.g., Bank / Department',
    expiryDate: 'Expiry Date',
    profile: 'Profile',
    notes: 'Notes',
    save: 'Save',
    cancel: 'Cancel',
    delete: 'Delete',
    edit: 'Edit',
    viewFiles: 'View Files',
    renew: 'Renew Now',
    move: 'Move',
    rename: 'Rename',
    personal: 'Personal',
    noCards: 'No cards yet. Click <span class="font-semibold text-slate-50">Add card</span>.',
    addCardButton: 'Add Your First Card',
    manageCards: 'Manage Cards',
    profiles: 'Profiles / Dependents',
    addProfile: 'Add',
    deleteProfile: 'Delete',
    renewalProviders: 'Renewal providers',
    addProvider: 'Add provider',
    providerName: 'Provider name (e.g., Passport portal)',
    providerUrl: 'https://...',
    settings: 'Settings',
    reminderDays: 'Reminder days',
    notifications: 'Notifications',
    language: 'Language',
    expiresToday: 'Expires today',
    daysLeft: '{0} day(s) left',
    daysOverdue: '{0} day(s) overdue',
    expired: 'Expired',
    expiringSoon: 'Expiring soon',
    filterAll: 'All',
    filterExpiring: 'Expiring',
    filterExpired: 'Expired',
    daysBeforeExpiry: 'days before expiry',
    notificationsOn: 'Notifications On',
    notificationsOff: 'Notifications Off'
  },
  dv: {
    appTitle: 'ކާޑްގާޑް',
    addCard: 'ކާޑު އަޅުއްވާ',
    editCard: 'ކާޑު ބަދަލުކުރުމަށް',
    cardTitle: 'ކާޑްގެ ނަން',
    cardTitlePlaceholder: 'މިސާލަ: ވީޒާ ޕްލެޓިނަމް',
    issuer: 'ދޫކުރާފައިވާ',
    issuerPlaceholder: 'މިސާލަ: ބޭންކް / ޑިޕާޓްމަންޓް',
    expiryDate: 'މުައްދަތުހަމަވާ ތާރީޙް',
    profile: 'ވަނަވަރު',
    notes: 'ނޯޓްސް',
    save: 'ސޭވްކުރޭ',
    cancel: 'ކެންސަލްކުރޭ',
    delete: 'ފޮހެލާ',
    edit: 'ބަދަލު ކޮއްލުމަށް',
    viewFiles: 'ފައިލް ބަލާލުމަށް',
    renew: 'އަލުން ހެދޭ',
    move: 'ބަދާލޭ',
    rename: 'ނަން ބަދަލު ކޮއްލުމަށް',
    personal: 'ޕަރސަނަލް',
    noCards: 'މިހާތަ ކާޑެއް ނެތް. <span class="font-semibold text-slate-50">ކާޑް އިތުރުކުރޭ</span> ކްލިކުރޭ.',
    addCardButton: 'ފުރަތަވެރި ކާޑް އިތުރުކުރޭ',
    manageCards: 'ކާޑްތައް މެނޭޖްކުރޭ',
    profiles: 'ޕްރޮފައިލްސް / ބަދަލުވެފައިވާ މީހުން',
    addProfile: 'އިތުރުކުރޭ',
    deleteProfile: 'ފޮހޮރާލޭ',
    renewalProviders: 'ރިނިއުއަލް ޕްރޮވައިޑަރުސް',
    addProvider: 'ޕްރޮވައިޑަރު އިތުރުކުރޭ',
    providerName: 'ޕްރޮވައިޑަރުގެ ނަން (މިސާލަ: ޕާސްޕޯޓް ޕޯޓަލް)',
    providerUrl: 'https://...',
    settings: 'ސެޓިންގްސް',
    reminderDays: 'ރިމައިންޑަރ ދުވަސްތައް',
    notifications: 'ނޮޓިފިކޭޝަންސް',
    language: 'ބަހުރުވައް',
    expiresToday: 'މިއަދު މުއްދަން ފުރިހަމަވެއްޖެ',
    daysLeft: '{0} ދުވަހުގެ ތެރޭގައި',
    daysOverdue: '{0} ދުވަހުގެ ފަހުން',
    expired: 'މުއްދަން ފުރިހަމަވެއްޖެ',
    expiringSoon: 'ހަމަވާނީ އަވަހަށް',
    filterAll: 'ހުރިހާ',
    filterExpiring: 'މުއްދަތު ހަމަވަނީ',
    filterExpired: 'މުއްދަތު ހަމަވެއްޖެ',
    daysBeforeExpiry: 'މުއްދަން ފުރިހަމަވުމުގެ ކުރިން ދުވަސްތައް',
    notificationsOn: 'ނޮޓިފިކޭޝަންސް އޯން',
    notificationsOff: 'ނޮޓިފިކޭޝަންސް އޮފް'
  }
}

export function useTranslation(language: Language) {
  return translations[language]
}

export function formatDays(days: number, t: Translation): string {
  if (days < 0) return t.daysOverdue.replace('{0}', Math.abs(days).toString())
  if (days === 0) return t.expiresToday
  if (days === 1) return '1 ދުވަހުގެ ތެރޭގައި'
  return t.daysLeft.replace('{0}', days.toString())
}
