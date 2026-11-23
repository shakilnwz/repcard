import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { clearAllDexieTables, vaultDb } from '@/shared/db/vaultDb';
import { clearAllBinaries } from '@/features/vault/lib/binaryStore';
import { DEFAULT_IGNORE_PATTERNS } from '@/features/vault/lib/ignore';
import {
  indexLocalDirectory,
  isLocalFolderSupported,
  LocalFsVaultProvider,
  pickLocalVaultDirectory,
} from '@/features/vault/providers/localFsProvider';
import type { FsaDirectoryHandle, FsaFileHandle, FsaHandle, WindowWithFsa } from '@/features/vault/types/fsa';

function mockFileHandle(name: string, content: string | Uint8Array, mime = 'text/plain'): FsaFileHandle {
  const bytes =
    typeof content === 'string'
      ? new TextEncoder().encode(content)
      : content;
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  const fileObj = {
    name,
    size: copy.byteLength,
    type: mime,
    lastModified: 1700000000000,
    async text() {
      return new TextDecoder('utf-8').decode(copy);
    },
    async arrayBuffer() {
      return copy.buffer;
    },
  } as unknown as File;

  return {
    kind: 'file',
    name,
    async getFile() {
      return fileObj;
    },
  };
}

function mockDirHandle(
  name: string,
  children: Record<string, FsaHandle>,
): FsaDirectoryHandle {
  return {
    kind: 'directory',
    name,
    async *entries() {
      for (const entry of Object.entries(children)) {
        yield entry;
      }
    },
    async getDirectoryHandle(childName: string) {
      const child = children[childName];
      if (!child || child.kind !== 'directory') {
        throw new Error(`Missing directory: ${childName}`);
      }
      return child;
    },
    async getFileHandle(childName: string) {
      const child = children[childName];
      if (!child || child.kind !== 'file') {
        throw new Error(`Missing file: ${childName}`);
      }
      return child;
    },
    async queryPermission() {
      return 'granted';
    },
    async requestPermission() {
      return 'granted';
    },
  };
}

describe('Local Folder Provider (Desktop Chromium FSA)', () => {
  const win = window as unknown as WindowWithFsa;
  const originalPicker = win.showDirectoryPicker;

  beforeEach(async () => {
    await clearAllBinaries();
    await clearAllDexieTables();
    delete win.showDirectoryPicker;
  });

  afterEach(() => {
    if (originalPicker) {
      win.showDirectoryPicker = originalPicker;
    } else {
      delete win.showDirectoryPicker;
    }
  });

  it('detects showDirectoryPicker support and fails gracefully when unsupported', async () => {
    expect(isLocalFolderSupported()).toBe(false);
    await expect(
      pickLocalVaultDirectory(DEFAULT_IGNORE_PATTERNS, {
        owner: 'shakilnwz',
        repo: 'genforge-lab-knowledgebase',
        branch: 'main',
      }),
    ).rejects.toThrow(/Desktop Chromium/i);
  });

  it('indexes local folders respecting ignore rules and lazy-loads binaries cleanly', async () => {
    const pdfBytes = new Uint8Array([37, 80, 68, 70, 1, 2, 3]);
    const rootHandle = mockDirHandle('genforge-lab-knowledgebase', {
      roadmaps: mockDirHandle('roadmaps', {
        'ai-engineer.md': mockFileHandle(
          'ai-engineer.md',
          '# AI Roadmap\n- [x] Embeddings\n- [ ] Agents\n',
        ),
      }),
      laravel: mockDirHandle('laravel', {
        'clean-code-in-laravel.pdf': mockFileHandle(
          'clean-code-in-laravel.pdf',
          pdfBytes,
          'application/pdf',
        ),
      }),
      '.obsidian': mockDirHandle('.obsidian', {
        'app.json': mockFileHandle('app.json', '{"vimMode":true}'),
      }),
      node_modules: mockDirHandle('node_modules', {
        'should-skip.js': mockFileHandle('should-skip.js', 'console.log(1)'),
      }),
    });

    win.showDirectoryPicker = vi.fn(async () => rootHandle);
    expect(isLocalFolderSupported()).toBe(true);

    const syncRes = await indexLocalDirectory(
      rootHandle,
      DEFAULT_IGNORE_PATTERNS,
      {
        owner: 'shakilnwz',
        repo: 'genforge-lab-knowledgebase',
        branch: 'main',
      },
    );

    expect(syncRes.totalFiles).toBe(3); // node_modules pruned completely
    expect(await vaultDb.files.get('node_modules/should-skip.js')).toBeUndefined();

    const md = await vaultDb.files.get('roadmaps/ai-engineer.md');
    expect(md?.isCached).toBe(true);
    expect(md?.taskTotal).toBe(2);
    expect(md?.taskDone).toBe(1);

    const obs = await vaultDb.files.get('.obsidian/app.json');
    expect(obs?.isHidden).toBe(true);
    expect(obs?.isCached).toBe(false);

    const pdf = await vaultDb.files.get('laravel/clean-code-in-laravel.pdf');
    expect(pdf?.isBinary).toBe(true);
    expect(pdf?.isCached).toBe(false);

    const provider = new LocalFsVaultProvider(rootHandle, rootHandle.name);
    const bin1 = await provider.readBinary('laravel/clean-code-in-laravel.pdf');
    expect(bin1.fromCache).toBe(false);
    expect(Array.from(bin1.bytes)).toEqual(Array.from(pdfBytes));

    const bin2 = await provider.readBinary('laravel/clean-code-in-laravel.pdf');
    expect(bin2.fromCache).toBe(true);
  });
});
