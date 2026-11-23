import { toArrayBuffer } from '@/features/vault/lib/binaryStore';
import type { TokenEnvelope } from '@/features/vault/types/vault';

export const PBKDF2_ITERATIONS = 210_000;
const SALT_BYTES = 16;
const IV_BYTES = 12;

export function bytesToBase64(bytes: Uint8Array): string {
  const chunkSize = 0x8000;
  const parts: string[] = [];
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize);
    parts.push(String.fromCharCode(...chunk));
  }
  return btoa(parts.join(''));
}

export function base64ToBytes(b64: string): Uint8Array {
  const clean = b64.replace(/\s+/g, '');
  const binary = atob(clean);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function getSubtleCrypto(): SubtleCrypto {
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) {
    throw new Error(
      'Web Crypto API (SubtleCrypto) is unavailable in this browser context.',
    );
  }
  return subtle;
}

async function deriveAesGcmKey(
  passphrase: string,
  salt: Uint8Array,
  iterations: number,
  usage: KeyUsage[],
): Promise<CryptoKey> {
  const subtle = getSubtleCrypto();
  const passphraseBytes = new TextEncoder().encode(passphrase);
  const keyMaterial = await subtle.importKey(
    'raw',
    toArrayBuffer(passphraseBytes),
    { name: 'PBKDF2' },
    false,
    ['deriveKey'],
  );

  return subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: toArrayBuffer(salt),
      iterations,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    usage,
  );
}

/**
 * Encrypts a repository access token with PBKDF2 (SHA-256) + AES-GCM (256-bit).
 */
export async function encryptToken(
  token: string,
  passphrase: string,
): Promise<Extract<TokenEnvelope, { mode: 'aes-gcm' }>> {
  if (!passphrase) {
    throw new Error('Passphrase cannot be empty.');
  }

  const subtle = getSubtleCrypto();
  const salt = globalThis.crypto.getRandomValues(new Uint8Array(SALT_BYTES));
  const iv = globalThis.crypto.getRandomValues(new Uint8Array(IV_BYTES));
  const key = await deriveAesGcmKey(passphrase, salt, PBKDF2_ITERATIONS, [
    'encrypt',
  ]);
  const plainBytes = new TextEncoder().encode(token);

  const encrypted = await subtle.encrypt(
    { name: 'AES-GCM', iv: toArrayBuffer(iv) },
    key,
    toArrayBuffer(plainBytes),
  );

  return {
    mode: 'aes-gcm',
    ciphertextB64: bytesToBase64(new Uint8Array(encrypted)),
    ivB64: bytesToBase64(iv),
    saltB64: bytesToBase64(salt),
    iterations: PBKDF2_ITERATIONS,
  };
}

/**
 * Decrypts an AES-GCM wrapped token envelope with the user passphrase.
 */
export async function decryptToken(
  envelope: Extract<TokenEnvelope, { mode: 'aes-gcm' }>,
  passphrase: string,
): Promise<string> {
  if (!passphrase) {
    throw new Error('Enter your vault passphrase to unlock.');
  }

  const subtle = getSubtleCrypto();
  const salt = base64ToBytes(envelope.saltB64);
  const iv = base64ToBytes(envelope.ivB64);
  const ciphertext = base64ToBytes(envelope.ciphertextB64);
  const key = await deriveAesGcmKey(
    passphrase,
    salt,
    envelope.iterations,
    ['decrypt'],
  );

  try {
    const decrypted = await subtle.decrypt(
      { name: 'AES-GCM', iv: toArrayBuffer(iv) },
      key,
      toArrayBuffer(ciphertext),
    );
    return new TextDecoder('utf-8').decode(decrypted);
  } catch {
    throw new Error('Invalid passphrase or corrupted credential envelope.');
  }
}
