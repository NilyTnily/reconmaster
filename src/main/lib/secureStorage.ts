import { safeStorage } from 'electron'

// Encrypts a string using the OS credential store (DPAPI on Windows, Keychain on macOS).
// Falls back to plain text when encryption is unavailable (e.g. headless test envs).
// On first run after an update, existing plain-text values decrypt gracefully via the
// try/catch fallback — they are re-encrypted on next save.
export function encryptSecret(plain: string): string {
  if (!plain || !safeStorage.isEncryptionAvailable()) return plain
  try {
    return safeStorage.encryptString(plain).toString('base64')
  } catch {
    return plain
  }
}

export function decryptSecret(stored: string): string {
  if (!stored || !safeStorage.isEncryptionAvailable()) return stored
  try {
    return safeStorage.decryptString(Buffer.from(stored, 'base64'))
  } catch {
    // Value was stored as plain text (pre-encryption migration) — return as-is
    return stored
  }
}
