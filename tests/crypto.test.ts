import { describe, expect, it } from 'vitest';
import { decryptToken, encryptToken, PBKDF2_ITERATIONS } from '@/shared/lib/crypto';

describe('crypto token encryption (PBKDF2 + AES-GCM)', () => {
  it('encrypts and decrypts a GitHub PAT with unique salt and IV per call', async () => {
    const secretToken = 'github_pat_11ABCDEF_secret_value_for_tests';
    const passphrase = 'correct-horse-battery-staple';

    const envA = await encryptToken(secretToken, passphrase);
    const envB = await encryptToken(secretToken, passphrase);

    expect(envA.mode).toBe('aes-gcm');
    expect(envA.iterations).toBe(PBKDF2_ITERATIONS);
    expect(envA.ciphertextB64).not.toContain('github_pat');
    expect(envA.saltB64).not.toBe(envB.saltB64);
    expect(envA.ivB64).not.toBe(envB.ivB64);
    expect(envA.ciphertextB64).not.toBe(envB.ciphertextB64);

    await expect(decryptToken(envA, passphrase)).resolves.toBe(secretToken);
    await expect(decryptToken(envB, passphrase)).resolves.toBe(secretToken);
  });

  it('rejects wrong passphrase or empty passphrases', async () => {
    await expect(encryptToken('tok', '')).rejects.toThrow(/empty/i);

    const envelope = await encryptToken('github_pat_xyz', 'pass-1');
    await expect(decryptToken(envelope, 'wrong-pass')).rejects.toThrow(
      /invalid passphrase/i,
    );
    await expect(decryptToken(envelope, '')).rejects.toThrow(/passphrase/i);
  });
});
