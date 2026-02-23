export type LockConfig = {
  enabled: boolean
  pinSaltB64: string | null
  pinVerifierB64: string | null
}

const LS_ENABLED = 'cardguard.lock.enabled'
const LS_SALT = 'cardguard.lock.pinSaltB64'
const LS_VERIFIER = 'cardguard.lock.pinVerifierB64'

const NOTE_PREFIX = 'enc:v1:'

function toB64(bytes: Uint8Array): string {
  let s = ''
  for (const b of bytes) s += String.fromCharCode(b)
  return btoa(s)
}

function fromB64(b64: string): Uint8Array {
  const bin = atob(b64)
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}

function toArrayBuffer(u8: Uint8Array): ArrayBuffer {
  return u8.buffer.slice(u8.byteOffset, u8.byteOffset + u8.byteLength) as ArrayBuffer
}

async function sha256(data: Uint8Array): Promise<Uint8Array> {
  const digest = await crypto.subtle.digest('SHA-256', toArrayBuffer(data))
  return new Uint8Array(digest)
}

function utf8(s: string): Uint8Array {
  return new TextEncoder().encode(s)
}

function utf8Decode(b: Uint8Array): string {
  return new TextDecoder().decode(b)
}

export function loadLockConfig(): LockConfig {
  const enabled = localStorage.getItem(LS_ENABLED) === '1'
  const pinSaltB64 = localStorage.getItem(LS_SALT)
  const pinVerifierB64 = localStorage.getItem(LS_VERIFIER)
  return { enabled, pinSaltB64, pinVerifierB64 }
}

export function saveLockConfig(cfg: LockConfig) {
  localStorage.setItem(LS_ENABLED, cfg.enabled ? '1' : '0')
  if (cfg.pinSaltB64) localStorage.setItem(LS_SALT, cfg.pinSaltB64)
  else localStorage.removeItem(LS_SALT)
  if (cfg.pinVerifierB64) localStorage.setItem(LS_VERIFIER, cfg.pinVerifierB64)
  else localStorage.removeItem(LS_VERIFIER)
}

export function clearLockConfig() {
  localStorage.removeItem(LS_ENABLED)
  localStorage.removeItem(LS_SALT)
  localStorage.removeItem(LS_VERIFIER)
}

export async function createPinVerifier(pin: string): Promise<{ pinSaltB64: string; pinVerifierB64: string }> {
  const salt = crypto.getRandomValues(new Uint8Array(16))
  const saltB64 = toB64(salt)
  const verifier = await sha256(utf8(`cardguard:pin:${pin}:${saltB64}`))
  return { pinSaltB64: saltB64, pinVerifierB64: toB64(verifier) }
}

export async function verifyPin(pin: string, cfg: LockConfig): Promise<boolean> {
  if (!cfg.pinSaltB64 || !cfg.pinVerifierB64) return false
  const verifier = await sha256(utf8(`cardguard:pin:${pin}:${cfg.pinSaltB64}`))
  return toB64(verifier) === cfg.pinVerifierB64
}

export async function deriveNotesKey(pin: string, pinSaltB64: string): Promise<CryptoKey> {
  const salt = fromB64(pinSaltB64)
  const keyMaterial = await crypto.subtle.importKey('raw', toArrayBuffer(utf8(pin)), 'PBKDF2', false, ['deriveKey'])
  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: toArrayBuffer(salt),
      iterations: 200_000,
      hash: 'SHA-256'
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  )
}

export async function encryptNote(notePlain: string, key: CryptoKey): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const pt = utf8(notePlain)
  const ctBuf = await crypto.subtle.encrypt({ name: 'AES-GCM', iv: toArrayBuffer(iv) }, key, toArrayBuffer(pt))
  const ct = new Uint8Array(ctBuf)
  const payload = new Uint8Array(iv.length + ct.length)
  payload.set(iv, 0)
  payload.set(ct, iv.length)
  return `${NOTE_PREFIX}${toB64(payload)}`
}

export async function decryptNote(noteStored: string, key: CryptoKey): Promise<string> {
  if (!noteStored.startsWith(NOTE_PREFIX)) return noteStored
  const payloadB64 = noteStored.slice(NOTE_PREFIX.length)
  const payload = fromB64(payloadB64)
  const iv = payload.slice(0, 12)
  const ct = payload.slice(12)
  const ptBuf = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: toArrayBuffer(iv) }, key, toArrayBuffer(ct))
  return utf8Decode(new Uint8Array(ptBuf))
}

export function isEncryptedNote(noteStored: string | undefined): boolean {
  return !!noteStored && noteStored.startsWith(NOTE_PREFIX)
}
