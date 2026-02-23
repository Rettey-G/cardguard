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
  theme: string
  about: string
  privacy: string
  source: string
  lock: string
  enableLock: string
  setPin: string
  confirmPin: string
  pinsMustMatch: string
  disableLock: string
  notificationsOn: string
  notificationsOff: string
  expiresToday: string
  daysLeft: string
  daysOverdue: string
  expired: string
  expiringSoon: string
  filterAll: string
  filterExpiring: string
  filterExpired: string
  daysBeforeExpiry: string
  reminders: string
  reminderDaysBefore: string
  defaultReminders: string
  calendarIntegration: string
  addToCalendar: string
  renewalSteps: string
  addStep: string
  stepTitle: string
  stepDescription: string
  required: string
  completed: string
  attachDocuments: string
  providerInstructions: string
  searchInstructions: string
  selectDays: string
  days: {
    30: string
    14: string
    7: string
    1: string
  }
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
    theme: 'Theme',
    about: 'About',
    privacy: 'Privacy',
    source: 'Source',
    lock: 'App Lock',
    enableLock: 'Enable App Lock',
    setPin: 'Set 6-digit PIN',
    confirmPin: 'Confirm PIN',
    pinsMustMatch: 'PINs must match',
    disableLock: 'Disable App Lock',
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
    notificationsOff: 'Notifications Off',
    reminders: 'Reminders',
    reminderDaysBefore: 'Remind me days before expiry',
    defaultReminders: 'Default reminders for new cards',
    calendarIntegration: 'Calendar Integration',
    addToCalendar: 'Add to Calendar',
    renewalSteps: 'Renewal Steps',
    addStep: 'Add Step',
    stepTitle: 'Step title',
    stepDescription: 'Description (optional)',
    required: 'Required',
    completed: 'Completed',
    attachDocuments: 'Attach documents',
    providerInstructions: 'Provider Instructions',
    searchInstructions: 'Search instructions for provider portal',
    selectDays: 'Select reminder days',
    days: {
      30: '30 days before',
      14: '14 days before',
      7: '7 days before',
      1: '1 day before'
    }
  },
  dv: {
    appTitle: 'ކާޑްގާޑް',
    addCard: 'ކާޑު އަޅުއްވާ',
    editCard: 'ކާޑު ބަދަލުކުރުމަށް',
    cardTitle: 'ކާޑްގެ ނަން',
    cardTitlePlaceholder: 'މިސާލަ: ވީޒާ ޕްލެޓިނަމް',
    issuer: 'ދޫކުރާފައިވާ',
    issuerPlaceholder: 'މިސާލަ: ބޭންކް / ޑިޕާޓްމަންޓް',
    expiryDate: 'މުއްދަތުހަމަވާ ތާރީޙް',
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
    settings: 'ސެޓިންގސް',
    reminderDays: 'ރިމައިންޑަރ ދުވަސްތައް',
    notifications: 'ނޮޓިފިކޭޝަންސް',
    language: 'ބަހުރުވައް',
    theme: 'ތީމް',
    about: 'ހަމަތަ',
    privacy: 'ރައްކައުވަން',
    source: 'މަސްދަރު',
    lock: 'އެޕް ލޮކް',
    enableLock: 'އެޕް ލޮކް އޯންކުރޭ',
    setPin: '6 ޑިޖިޓް PIN ސެޓްކުރޭ',
    confirmPin: 'PIN ޔަގީންކުރޭ',
    pinsMustMatch: 'PINސް އެއްވުމަކަށް ޖެހޭ',
    disableLock: 'އެޕް ލޮކް އޮފްކުރޭ',
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
    notificationsOff: 'ނޮޓިފިކޭޝަންސް އޮފް',
    reminders: 'ހަމަވާނަމަ ފޮނުވާ',
    reminderDaysBefore: 'މުއްދަތު ހަމަވުމުގެ ކުރިން ހަމަވާނަމަ ދުވަސްތައް',
    defaultReminders: 'އާ ކާޑުތަކަށް ޑިފޯލްޓް ހަމަވާނަމަ ދުވަސްތައް',
    calendarIntegration: 'ކެލެންޑަރު އިންޓެގްރޭޝަން',
    addToCalendar: 'ކެލެންޑަރަށް އިއްދައިން',
    renewalSteps: 'އަލުން ހެދުމުގެ ފިޔަވަޅުތައް',
    addStep: 'ފިޔަވަޅު އިއްދައިން',
    stepTitle: 'ފިޔަވަޅުގެ ނަން',
    stepDescription: 'ތަފްސީލް (އޮޕްޝަނަލް)',
    required: 'ލާބައްވާ',
    completed: 'ނިންިގުނު',
    attachDocuments: 'ސިއްހީ ބިލުތައް އެއްލުމަށް',
    providerInstructions: 'ޕްރޮވައިޑަރުގެ އިންސްޓްރަކްޝަންސް',
    searchInstructions: 'ޕްރޮވައިޑަރު ޕޯޓަލްގައި ހޯދުމުގެ އިންސްޓްރަކްޝަންސް',
    selectDays: 'ހަމަވާނަމަ ދުވަސްތައް އިންގޭ',
    days: {
      30: '30 ދުވަހުގެ ކުރިން',
      14: '14 ދުވަހުގެ ކުރިން',
      7: '7 ދުވަހުގެ ކުރިން',
      1: '1 ދުވަހުގެ ކުރިން'
    }
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
