import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { clearAllDexieTables } from '@/shared/db/vaultDb';
import {
  clearAllBinaries,
  getBinary,
  getBinaryCacheSummary,
  guessMimeType,
  hasBinary,
  putBinary,
  toArrayBuffer,
} from '@/features/vault/lib/binaryStore';

function createMockOpfsRoot() {
  const files = new Map<string, { data: Uint8Array; type: string }>();
  const dirs = new Map<string, ReturnType<typeof createDirHandle>>();

  function createDirHandle(prefix: string) {
    return {
      async getDirectoryHandle(name: string) {
        const key = `${prefix}/${name}`;
        let d = dirs.get(key);
        if (!d) {
          d = createDirHandle(key);
          dirs.set(key, d);
        }
        return d;
      },
      async getFileHandle(name: string, opts?: { create?: boolean }) {
        const key = `${prefix}/${name}`;
        if (!files.has(key) && !opts?.create) {
          throw new DOMException('File not found', 'NotFoundError');
        }
        if (!files.has(key)) {
          files.set(key, { data: new Uint8Array(), type: '' });
        }
        return {
          async getFile() {
            const entry = files.get(key) ?? { data: new Uint8Array(), type: '' };
            return new File([toArrayBuffer(entry.data)], name, {
              type: entry.type,
            });
          },
          async createWritable() {
            return {
              async write(chunk: ArrayBuffer | string) {
                const bytes =
                  typeof chunk === 'string'
                    ? new TextEncoder().encode(chunk)
                    : new Uint8Array(chunk);
                files.set(key, { data: bytes, type: '' });
              },
              async close() {},
            };
          },
        };
      },
      async removeEntry(name: string) {
        files.delete(`${prefix}/${name}`);
      },
      async *entries() {
        for (const [fullKey] of files.entries()) {
          if (!fullKey.startsWith(`${prefix}/`)) continue;
          const rel = fullKey.slice(prefix.length + 1);
          if (rel.includes('/')) continue;
          yield [
            rel,
            await this.getFileHandle(rel, { create: false }),
          ] as const;
        }
      },
    };
  }

  return createDirHandle('root');
}

describe('binaryStore (IndexedDB fallback & OPFS)', () => {
  const originalStorageDescriptor = Object.getOwnPropertyDescriptor(
    navigator,
    'storage',
  );

  beforeEach(async () => {
    await clearAllBinaries();
    await clearAllDexieTables();
  });

  afterEach(() => {
    if (originalStorageDescriptor) {
      Object.defineProperty(navigator, 'storage', originalStorageDescriptor);
    } else {
      Reflect.deleteProperty(navigator, 'storage');
    }
  });

  it('guesses common binary MIME types accurately', () => {
    expect(guessMimeType('laravel/clean-code-in-laravel.pdf')).toBe(
      'application/pdf',
    );
    expect(guessMimeType('ai_enginnering/ai-eng.png')).toBe('image/png');
    expect(guessMimeType('unknown.bin')).toBe('application/octet-stream');
  });

  it('stores, reads, summarizes, and clears blobs using IndexedDB fallback', async () => {
    const sampleBytes = new Uint8Array([37, 80, 68, 70, 45, 49, 46, 55]);
    const backend = await putBinary(
      'sha-pdf-001',
      sampleBytes,
      'application/pdf',
    );

    expect(backend).toBe('indexeddb');
    await expect(hasBinary('sha-pdf-001')).resolves.toBe(true);

    const loaded = await getBinary('sha-pdf-001');
    expect(loaded).not.toBeNull();
    expect(loaded?.mimeType).toBe('application/pdf');
    expect(Array.from(loaded!.bytes)).toEqual(Array.from(sampleBytes));

    const summary = await getBinaryCacheSummary();
    expect(summary.backend).toBe('indexeddb');
    expect(summary.count).toBe(1);
    expect(summary.totalBytes).toBe(sampleBytes.byteLength);

    await clearAllBinaries();
    await expect(hasBinary('sha-pdf-001')).resolves.toBe(false);
    await expect(getBinaryCacheSummary()).resolves.toMatchObject({
      count: 0,
      totalBytes: 0,
    });
  });

  it('uses OPFS directory storage seamlessly when getDirectory is available', async () => {
    const mockRoot = createMockOpfsRoot();
    Object.defineProperty(navigator, 'storage', {
      configurable: true,
      value: {
        getDirectory: async () => mockRoot,
        estimate: async () => ({ usage: 4096, quota: 10_000_000 }),
        persisted: async () => true,
        persist: async () => true,
      },
    });

    const pngBytes = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);
    const backend = await putBinary('sha-img-1', pngBytes, 'image/png');

    expect(backend).toBe('opfs');
    const loaded = await getBinary('sha-img-1');
    expect(loaded?.mimeType).toBe('image/png');
    expect(Array.from(loaded!.bytes)).toEqual(Array.from(pngBytes));

    const summary = await getBinaryCacheSummary();
    expect(summary.backend).toBe('opfs');
    expect(summary.count).toBe(1);
    expect(summary.totalBytes).toBe(pngBytes.byteLength);

    await clearAllBinaries();
    await expect(hasBinary('sha-img-1')).resolves.toBe(false);
  });
});
