import { vaultDb, type VaultFileRecord, type VaultMetaRecord } from '@/shared/db/vaultDb';
import {
  getBinary,
  guessMimeType,
  putBinary,
  readFileAsBytes,
  readFileAsText,
} from '@/features/vault/lib/binaryStore';
import { extractDocumentMetadata } from '@/features/vault/lib/documentIndex';
import { isBinaryFile, MAX_EAGER_TEXT_BYTES } from '@/features/vault/lib/githubApi';
import { isPathIgnored } from '@/features/vault/lib/ignore';
import { classifyFileKind, getFileExtension } from '@/features/vault/lib/tree';
import type {
  FsaDirectoryHandle,
  FsaFileHandle,
  FsaPermissionMode,
  WindowWithFsa,
} from '@/features/vault/types/fsa';
import type {
  BinaryReadResult,
  RepoConfig,
  SyncProgress,
  SyncResult,
  VaultFileEntry,
  VaultProvider,
} from '@/features/vault/types/vault';

const HARD_PRUNED_DIRS = new Set([
  '.git',
  'node_modules',
  '.venv',
  'venv',
  '__pycache__',
  'dist',
  '.vite',
  'coverage',
]);

export function isLocalFolderSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof (window as unknown as WindowWithFsa).showDirectoryPicker ===
      'function'
  );
}

export async function ensureHandlePermission(
  handle: FsaDirectoryHandle,
  mode: FsaPermissionMode = 'read',
): Promise<boolean> {
  if (typeof handle.queryPermission === 'function') {
    const state = await handle.queryPermission({ mode });
    if (state === 'granted') return true;
  }
  if (typeof handle.requestPermission === 'function') {
    const state = await handle.requestPermission({ mode });
    return state === 'granted';
  }
  return true;
}

async function resolveNestedFileHandle(
  root: FsaDirectoryHandle,
  relativePath: string,
  createMissing = false,
): Promise<FsaFileHandle> {
  const parts = relativePath.split('/').filter(Boolean);
  if (parts.length === 0) {
    throw new Error(`Invalid file path: ${relativePath}`);
  }

  let currentDir = root;
  for (let i = 0; i < parts.length - 1; i += 1) {
    currentDir = await currentDir.getDirectoryHandle(parts[i], {
      create: createMissing,
    });
  }
  return currentDir.getFileHandle(parts[parts.length - 1], {
    create: createMissing,
  });
}

export async function writeLocalFileText(
  root: FsaDirectoryHandle,
  relativePath: string,
  content: string,
): Promise<boolean> {
  try {
    const granted = await ensureHandlePermission(root, 'readwrite');
    if (!granted) return false;
    const handle = await resolveNestedFileHandle(root, relativePath, true);
    if (typeof handle.createWritable !== 'function') return false;
    const writable = await handle.createWritable();
    await writable.write(content);
    await writable.close();
    return true;
  } catch {
    return false;
  }
}

export async function indexLocalDirectory(
  dirHandle: FsaDirectoryHandle,
  ignorePatterns: string[],
  repoConfig: RepoConfig,
  onProgress?: (progress: SyncProgress) => void,
): Promise<SyncResult> {
  const startedAt = Date.now();
  const records: VaultFileRecord[] = [];
  let fetchedBlobs = 0;
  let binaryCount = 0;
  const now = Date.now();

  onProgress?.({ phase: 'indexing', done: 0, total: 1 });

  async function walk(
    currentHandle: FsaDirectoryHandle,
    prefix: string,
  ): Promise<void> {
    for await (const [entryName, handle] of currentHandle.entries()) {
      const relPath = prefix ? `${prefix}/${entryName}` : entryName;

      if (handle.kind === 'directory') {
        if (HARD_PRUNED_DIRS.has(entryName)) {
          continue;
        }
        await walk(handle, relPath);
        continue;
      }

      const file = await handle.getFile();
      const folder = prefix;
      const ext = getFileExtension(relPath);
      const kind = classifyFileKind(relPath);
      const isBinary = isBinaryFile(relPath);
      const isHidden = isPathIgnored(relPath, ignorePatterns);
      const blobSha = `local:${file.size}:${file.lastModified}`;

      if (isBinary) {
        binaryCount += 1;
        records.push({
          path: relPath,
          name: entryName,
          ext,
          folder,
          kind,
          size: file.size,
          blobSha,
          isBinary: true,
          isHidden,
          isCached: false,
          updatedAt: file.lastModified || now,
        });
        continue;
      }

      let content: string | undefined;
      let isCached = false;
      let docMeta: ReturnType<typeof extractDocumentMetadata> = {};

      if (!isHidden && file.size <= MAX_EAGER_TEXT_BYTES) {
        content = await readFileAsText(file);
        isCached = true;
        fetchedBlobs += 1;
        docMeta = extractDocumentMetadata(kind, relPath, content);
        onProgress?.({
          phase: 'indexing',
          done: fetchedBlobs,
          total: fetchedBlobs,
          currentPath: relPath,
        });
      }

      records.push({
        path: relPath,
        name: entryName,
        ext,
        folder,
        kind,
        size: file.size,
        blobSha,
        isBinary: false,
        isHidden,
        isCached,
        content,
        ...docMeta,
        updatedAt: file.lastModified || now,
      });
    }
  }

  await walk(dirHandle, '');

  const existingMeta = await vaultDb.vaultMeta.get('active');
  const nextMeta: VaultMetaRecord = {
    id: 'active',
    source: 'local-fs',
    owner: repoConfig.owner,
    repo: dirHandle.name || repoConfig.repo,
    branch: 'local',
    authMode: 'local-fs',
    user: existingMeta?.user,
    avatarUrl: existingMeta?.avatarUrl,
    tokenEnvelope: existingMeta?.tokenEnvelope,
    passphraseLocked: existingMeta?.passphraseLocked,
    lastSyncedAt: now,
    localFolderName: dirHandle.name,
  };

  await vaultDb.transaction(
    'rw',
    [vaultDb.files, vaultDb.vaultMeta],
    async () => {
      await vaultDb.files.clear();
      if (records.length > 0) {
        await vaultDb.files.bulkPut(records);
      }
      await vaultDb.vaultMeta.put(nextMeta);
    },
  );

  try {
    // Store native FileSystemDirectoryHandle in IndexedDB when cloneable (fails silently for non-cloneable test mocks)
    await vaultDb.vaultMeta.update('active', { localDirHandle: dirHandle });
  } catch {
    // Ignore non-cloneable handles
  }

  return {
    status: 'synced',
    fetchedBlobs,
    removedFiles: 0,
    binaryCount,
    totalFiles: records.length,
    apiCalls: 0,
    durationMs: Date.now() - startedAt,
  };
}

export async function pickLocalVaultDirectory(
  ignorePatterns: string[],
  repoConfig: RepoConfig,
  onProgress?: (progress: SyncProgress) => void,
): Promise<{ dirHandle: FsaDirectoryHandle; result: SyncResult }> {
  if (!isLocalFolderSupported()) {
    throw new Error(
      'Local Folder Mode requires a Desktop Chromium browser (Chrome, Brave, Edge, or Opera) with File System Access API support.',
    );
  }

  const picker = (window as unknown as WindowWithFsa).showDirectoryPicker!;
  let dirHandle: FsaDirectoryHandle;
  try {
    dirHandle = await picker({ id: 'genforge-kb-vault', mode: 'readwrite' });
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      throw err;
    }
    dirHandle = await picker({ id: 'genforge-kb-vault', mode: 'read' });
  }

  const result = await indexLocalDirectory(
    dirHandle,
    ignorePatterns,
    repoConfig,
    onProgress,
  );
  return { dirHandle, result };
}

export class LocalFsVaultProvider implements VaultProvider {
  readonly mode = 'local-fs' as const;
  readonly label: string;
  private readonly dirHandle: FsaDirectoryHandle | null;

  constructor(dirHandle: FsaDirectoryHandle | null, folderName?: string | null) {
    this.dirHandle = dirHandle;
    this.label = folderName ? `Local: ${folderName}` : 'Local Folder';
  }

  async listEntries(): Promise<VaultFileEntry[]> {
    return vaultDb.files.toArray();
  }

  async readText(path: string): Promise<string> {
    const record = await vaultDb.files.get(path);
    if (record?.isCached && typeof record.content === 'string') {
      return record.content;
    }

    if (!this.dirHandle) {
      throw new Error(
        'Local folder permission needs re-authorization. Click Reconnect Local Folder to inspect uncached files.',
      );
    }

    const granted = await ensureHandlePermission(this.dirHandle, 'read');
    if (!granted) {
      throw new Error('Permission denied when reading local vault folder.');
    }

    const fileHandle = await resolveNestedFileHandle(this.dirHandle, path);
    const file = await fileHandle.getFile();
    const text = await readFileAsText(file);
    const kind = classifyFileKind(path);
    const docMeta = extractDocumentMetadata(kind, path, text);

    if (record) {
      await vaultDb.files.update(path, {
        content: text,
        isCached: true,
        ...docMeta,
        updatedAt: Date.now(),
      });
    }

    return text;
  }

  async readBinary(path: string): Promise<BinaryReadResult> {
    const record = await vaultDb.files.get(path);
    const fallbackMime = guessMimeType(path);

    if (record) {
      const cached = await getBinary(record.blobSha, fallbackMime);
      if (cached) {
        if (!record.isCached) {
          await vaultDb.files.update(path, { isCached: true });
        }
        return {
          bytes: cached.bytes,
          mimeType: cached.mimeType,
          fromCache: true,
        };
      }
    }

    if (!this.dirHandle) {
      throw new Error(
        'Asset is not cached yet. Reconnect your local folder to load it.',
      );
    }

    const granted = await ensureHandlePermission(this.dirHandle, 'read');
    if (!granted) {
      throw new Error('Permission denied when reading binary asset.');
    }

    const fileHandle = await resolveNestedFileHandle(this.dirHandle, path);
    const file = await fileHandle.getFile();
    const bytes = await readFileAsBytes(file);
    const blobSha =
      record?.blobSha ?? `local:${file.size}:${file.lastModified}`;
    const mimeType = file.type || fallbackMime;

    await putBinary(blobSha, bytes, mimeType);
    if (record) {
      await vaultDb.files.update(path, {
        isCached: true,
        updatedAt: Date.now(),
      });
    }

    return {
      bytes,
      mimeType,
      fromCache: false,
    };
  }
}
