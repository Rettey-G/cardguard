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

export function isBiometricSupported(): boolean {
  return typeof window !== 'undefined' && !!(window.PublicKeyCredential && navigator.credentials)
}

export async function registerBiometricCredential(appName: string, userId: string): Promise<string> {
  if (!isBiometricSupported()) throw new Error('Biometric unlock not supported on this device')

  const challenge = crypto.getRandomValues(new Uint8Array(32))
  const userHandle = crypto.getRandomValues(new Uint8Array(32))

  const cred = (await navigator.credentials.create({
    publicKey: {
      rp: { name: appName },
      user: {
        id: toArrayBuffer(userHandle),
        name: userId,
        displayName: userId
      },
      challenge: toArrayBuffer(challenge),
      pubKeyCredParams: [{ type: 'public-key', alg: -7 }, { type: 'public-key', alg: -257 }],
      authenticatorSelection: {
        authenticatorAttachment: 'platform',
        userVerification: 'required'
      },
      timeout: 60_000,
      attestation: 'none'
    }
  })) as PublicKeyCredential | null

  if (!cred) throw new Error('Biometric registration cancelled')
  return toB64(new Uint8Array(cred.rawId))
}

export async function authenticateBiometric(credentialIdB64: string): Promise<boolean> {
  if (!isBiometricSupported()) return false
  const rawId = fromB64(credentialIdB64)
  const challenge = crypto.getRandomValues(new Uint8Array(32))

  const res = (await navigator.credentials.get({
    publicKey: {
      challenge: toArrayBuffer(challenge),
      allowCredentials: [{ id: toArrayBuffer(rawId), type: 'public-key' }],
      userVerification: 'required',
      timeout: 60_000
    }
  })) as PublicKeyCredential | null

  return !!res
}
