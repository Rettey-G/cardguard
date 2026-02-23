import * as local from './db'
import * as cloud from './db-cloud'
import { hasSupabase } from './supabase'

const impl = hasSupabase() ? cloud : local

export const resetDatabase = impl.resetDatabase
export const getSettings = impl.getSettings
export const saveSettings = impl.saveSettings
export const listCards = impl.listCards
export const getCard = impl.getCard
export const upsertCard = impl.upsertCard
export const deleteCard = impl.deleteCard
export const listProfiles = impl.listProfiles
export const createProfile = impl.createProfile
export const updateProfile = (impl as any).updateProfile
export const deleteProfile = impl.deleteProfile
export const listRenewalProviders = impl.listRenewalProviders
export const createRenewalProvider = impl.createRenewalProvider
export const deleteRenewalProvider = impl.deleteRenewalProvider
export const listCardKinds = impl.listCardKinds
export const createCardKind = impl.createCardKind
export const deleteCardKind = impl.deleteCardKind
export const getDb = (local as any).getDb
