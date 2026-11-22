import { vaultDb } from '@/db/vaultDb';
import { getFileExtension } from '@/lib/tree';

const OPFS_DIR_NAME = 'genforge-blobs';
const MIME_SUFFIX = '.mime';

const MIME_MAP: Record<string, string> = {
  pdf: 'application/pdf',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
  gif: 'image/gif',
  svg: 'image/svg+xml',
  md: 'text/markdown; charset=utf-8',
  canvas: 'application/json; charset=utf-8',
  json: 'application/json; charset=utf-8',
  txt: 'text/plain; charset=utf-8',
};

export function guessMimeType(path: string): string {
  const ext = getFileExtension(path);
  return MIME_MAP[ext] ?? 'application/octet-stream';
}

/**
 * Copies byte slice into a standalone ArrayBuffer for strict TS 7 BufferSource / IndexedDB safety.
 */
export function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return copy.buffer;
}

function safeBlobKey(blobSha: string): string {
  return blobSha.replace(/[^a-zA-Z0-9_-]/g, '_');
}

interface OpfsWritableStream {
  write(data: ArrayBuffer | string): Promise<void>;
  close(): Promise<void>;
}

interface OpfsFileHandleLike {
  getFile(): Promise<File>;
  createWritable?: () => Promise<OpfsWritableStream>;
}

interface OpfsDirectoryHandleLike {
  getDirectoryHandle(
    name: string,
    options?: { create?: boolean },
  ): Promise<OpfsDirectoryHandleLike>;
  getFileHandle(
    name: string,
    options?: { create?: boolean },
  ): Promise<OpfsFileHandleLike>;
  removeEntry(name: string): Promise<void>;
  entries(): AsyncIterableIterator<[string, OpfsFileHandleLike | OpfsDirectoryHandleLike]>;
}

async function getOpfsBlobsDir(
  create = false,
): Promise<OpfsDirectoryHandleLike | null> {
  if (
    typeof navigator === 'undefined' ||
    typeof navigator.storage?.getDirectory !== 'function'
  ) {
    return null;
  }

  try {
    const root =
      (await navigator.storage.getDirectory()) as unknown as OpfsDirectoryHandleLike;
    return await root.getDirectoryHandle(OPFS_DIR_NAME, { create });
  } catch {
    return null;
  }
}

export async function isOpfsSupported(): Promise<boolean> {
  try {
    const dir = await getOpfsBlobsDir(true);
    if (!dir) return false;
    const probeHandle = await dir.getFileHandle('__probe__', { create: true });
    const supported = typeof probeHandle.createWritable === 'function';
    await dir.removeEntry('__probe__').catch(() => {});
    return supported;
  } catch {
    return false;
  }
}

export async function putBinary(
  blobSha: string,
  bytes: Uint8Array,
  mimeType: string,
): Promise<'opfs' | 'indexeddb'> {
  const buffer = toArrayBuffer(bytes);
  const safeKey = safeBlobKey(blobSha);

  try {
    const dir = await getOpfsBlobsDir(true);
    if (dir) {
      const fileHandle = await dir.getFileHandle(safeKey, { create: true });
      if (typeof fileHandle.createWritable === 'function') {
        const writable = await fileHandle.createWritable();
        await writable.write(buffer);
        await writable.close();

        const mimeHandle = await dir.getFileHandle(`${safeKey}${MIME_SUFFIX}`, {
          create: true,
        });
        if (typeof mimeHandle.createWritable === 'function') {
          const mimeWriter = await mimeHandle.createWritable();
          await mimeWriter.write(mimeType);
          await mimeWriter.close();
        }
        return 'opfs';
      }
    }
  } catch {
    // Fall back to IndexedDB binary store below
  }

  await vaultDb.binaryBlobs.put({
    blobSha,
    bytes: buffer,
    mimeType,
    size: bytes.byteLength,
    updatedAt: Date.now(),
  });
  return 'indexeddb';
}

export async function readFileAsBytes(file: File): Promise<Uint8Array> {
  if (typeof file.arrayBuffer === 'function') {
    return new Uint8Array(await file.arrayBuffer());
  }
  const buffer = await new Promise<ArrayBuffer>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as ArrayBuffer);
    reader.onerror = () =>
      reject(reader.error ?? new Error('Failed to read file bytes.'));
    reader.readAsArrayBuffer(file);
  });
  return new Uint8Array(buffer);
}

export async function readFileAsText(file: File): Promise<string> {
  if (typeof file.text === 'function') {
    return file.text();
  }
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ''));
    reader.onerror = () =>
      reject(reader.error ?? new Error('Failed to read file text.'));
    reader.readAsText(file);
  });
}

export async function getBinary(
  blobSha: string,
  fallbackMimeType = 'application/octet-stream',
): Promise<{ bytes: Uint8Array; mimeType: string } | null> {
  const safeKey = safeBlobKey(blobSha);

  try {
    const dir = await getOpfsBlobsDir(false);
    if (dir) {
      const fileHandle = await dir.getFileHandle(safeKey, { create: false });
      const file = await fileHandle.getFile();
      const bytes = await readFileAsBytes(file);
      let mimeType = file.type || fallbackMimeType;
      try {
        const mimeHandle = await dir.getFileHandle(`${safeKey}${MIME_SUFFIX}`, {
          create: false,
        });
        const mimeFile = await mimeHandle.getFile();
        const storedMime = (await readFileAsText(mimeFile)).trim();
        if (storedMime) mimeType = storedMime;
      } catch {
        // Use fallback mime type if sidecar is absent
      }
      return { bytes, mimeType };
    }
  } catch {
    // Check IndexedDB fallback below
  }

  const record = await vaultDb.binaryBlobs.get(blobSha);
  if (!record) return null;
  return {
    bytes: new Uint8Array(record.bytes),
    mimeType: record.mimeType || fallbackMimeType,
  };
}

export async function hasBinary(blobSha: string): Promise<boolean> {
  const safeKey = safeBlobKey(blobSha);
  try {
    const dir = await getOpfsBlobsDir(false);
    if (dir) {
      await dir.getFileHandle(safeKey, { create: false });
      return true;
    }
  } catch {
    // Fallback to IndexedDB check
  }

  const count = await vaultDb.binaryBlobs.where('blobSha').equals(blobSha).count();
  return count > 0;
}

export async function clearAllBinaries(): Promise<void> {
  try {
    const dir = await getOpfsBlobsDir(false);
    if (dir) {
      const names: string[] = [];
      for await (const [name] of dir.entries()) {
        names.push(name);
      }
      await Promise.all(
        names.map((name) => dir.removeEntry(name).catch(() => {})),
      );
    }
  } catch {
    // Ignore OPFS cleanup failure
  }

  await vaultDb.binaryBlobs.clear();
}

export async function getBinaryCacheSummary(): Promise<{
  backend: 'opfs' | 'indexeddb';
  count: number;
  totalBytes: number;
}> {
  let opfsCount = 0;
  let opfsBytes = 0;
  const opfsSupported = await isOpfsSupported();

  try {
    const dir = await getOpfsBlobsDir(false);
    if (dir) {
      for await (const [name, handle] of dir.entries()) {
        if (name.endsWith(MIME_SUFFIX)) continue;
        if ('getFile' in handle && typeof handle.getFile === 'function') {
          const file = await handle.getFile();
          opfsCount += 1;
          opfsBytes += file.size;
        }
      }
    }
  } catch {
    // Ignore OPFS iteration failure
  }

  const idbRows = await vaultDb.binaryBlobs.toArray();
  const idbCount = idbRows.length;
  const idbBytes = idbRows.reduce((sum, row) => sum + row.size, 0);

  if (opfsCount > 0 || (opfsSupported && idbCount === 0)) {
    return {
      backend: 'opfs',
      count: opfsCount,
      totalBytes: opfsBytes,
    };
  }

  return {
    backend: 'indexeddb',
    count: idbCount + opfsCount,
    totalBytes: idbBytes + opfsBytes,
  };
}

export async function requestPersistentStorage(): Promise<boolean> {
  try {
    if (
      typeof navigator !== 'undefined' &&
      typeof navigator.storage?.persist === 'function'
    ) {
      return await navigator.storage.persist();
    }
  } catch {
    // Ignore unsupported environments
  }
  return false;
}

export async function getStorageEstimate(): Promise<{
  usage: number;
  quota: number;
  persisted: boolean;
}> {
  let usage = 0;
  let quota = 0;
  let persisted = false;

  try {
    if (
      typeof navigator !== 'undefined' &&
      typeof navigator.storage?.estimate === 'function'
    ) {
      const est = await navigator.storage.estimate();
      usage = est.usage ?? 0;
      quota = est.quota ?? 0;
    }
    if (
      typeof navigator !== 'undefined' &&
      typeof navigator.storage?.persisted === 'function'
    ) {
      persisted = await navigator.storage.persisted();
    }
  } catch {
    // Ignore storage estimate failure
  }

  return { usage, quota, persisted };
}
