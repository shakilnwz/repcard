import {
  clearAllDexieTables,
  vaultDb,
  type OutboxEditRecord,
  type VaultFileRecord,
  type VaultMetaRecord,
} from '@/db/vaultDb';
import {
  clearAllBinaries,
  getBinaryCacheSummary,
  getStorageEstimate,
  requestPersistentStorage,
} from '@/lib/binaryStore';
import { buildConflictCopyPath } from '@/lib/checklist';
import { decryptToken, encryptToken } from '@/lib/crypto';
import { extractDocumentMetadata } from '@/lib/documentIndex';
import {
  isRadarJsonString,
  parseRadarJson,
  serializeRadarJson,
} from '@/lib/radarSchema';
import {
  runWithConcurrency,
  syncGitHubVault,
  testGitHubConnection,
  type ConnectionTestResult,
} from '@/lib/githubApi';
import { pushOutboxToGitHub } from '@/lib/githubPush';
import { buildVaultGraph, type VaultGraphData } from '@/lib/graphBuilder';
import { isPathIgnored } from '@/lib/ignore';
import { classifyFileKind, getFileExtension } from '@/lib/tree';
import {
  computeBacklinksForTarget,
  extractRawOutgoingTargets,
  type BacklinkItem,
} from '@/lib/wikilinks';
import { GitHubVaultProvider } from '@/providers/githubProvider';
import {
  ensureHandlePermission,
  indexLocalDirectory,
  LocalFsVaultProvider,
  pickLocalVaultDirectory,
  writeLocalFileText,
} from '@/providers/localFsProvider';
import { useAppStore } from '@/store/useAppStore';
import type { FsaDirectoryHandle } from '@/types/fsa';
import type { RadarDocument, SavedCustomRadar } from '@/types/radar';
import type {
  BinaryReadResult,
  RepoConfig,
  StorageStats,
  SyncProgress,
  SyncResult,
  TokenEnvelope,
  VaultFileEntry,
  VaultProvider,
} from '@/types/vault';

let activeLocalDirHandle: FsaDirectoryHandle | null = null;
let inFlightSync: Promise<SyncResult | null> | null = null;

function toFileEntries(records: VaultFileRecord[]): VaultFileEntry[] {
  return records.map((r) => ({
    path: r.path,
    name: r.name,
    ext: r.ext,
    kind: r.kind,
    size: r.size,
    isHidden: r.isHidden,
    taskTotal: r.taskTotal,
    taskDone: r.taskDone,
    folder: r.folder,
    blobSha: r.blobSha,
    isBinary: r.isBinary,
    isCached: r.isCached,
    updatedAt: r.updatedAt,
  }));
}

async function refreshEntriesInStore(): Promise<void> {
  const [rows, outbox] = await Promise.all([
    vaultDb.files.toArray(),
    vaultDb.outboxEdits.toArray(),
  ]);
  const store = useAppStore.getState();
  store.setSyncedEntries(toFileEntries(rows));
  store.setOutboxEdits(outbox);
}

function triggerSearchCacheInvalidation(): void {
  void import('@/lib/searchEngine')
    .then((m) => m.invalidateSearchIndexCache())
    .catch(() => {});
}

function getActiveProvider(): VaultProvider {
  const state = useAppStore.getState();
  if (state.vaultSource === 'local-fs') {
    return new LocalFsVaultProvider(
      activeLocalDirHandle,
      state.localFolderName,
    );
  }
  return new GitHubVaultProvider({
    mode: state.authMode === 'github-oauth' ? 'github-oauth' : 'pat',
    config: state.repoConfig,
    getToken: () => useAppStore.getState().runtimeToken,
  });
}

function scrubLegacyLocalStorageToken(): string | null {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return null;
    const raw = window.localStorage.getItem('genforge-kb-ui-v1');
    if (!raw) return null;
    const parsed = JSON.parse(raw) as {
      state?: { authSession?: { user?: string; avatarUrl?: string; token?: string } };
    };
    const legacyToken = parsed?.state?.authSession?.token ?? null;
    if (legacyToken && parsed.state?.authSession) {
      delete parsed.state.authSession.token;
      window.localStorage.setItem('genforge-kb-ui-v1', JSON.stringify(parsed));
    }
    return legacyToken;
  } catch {
    return null;
  }
}

export async function hydrateVaultFromDb(): Promise<void> {
  const store = useAppStore.getState();
  const legacyToken = scrubLegacyLocalStorageToken();
  const meta = await vaultDb.vaultMeta.get('active');
  const files = await vaultDb.files.toArray();

  if (meta) {
    if (meta.localDirHandle) {
      activeLocalDirHandle = meta.localDirHandle;
    }

    store.setVaultSource(meta.source);
    store.setRepoConfig({
      owner: meta.owner,
      repo: meta.repo,
      branch: meta.branch === 'local' ? store.repoConfig.branch : meta.branch,
    });
    store.setAuthMode(meta.authMode);
    if (meta.user) {
      store.setAuthSession({ user: meta.user, avatarUrl: meta.avatarUrl });
    }
    store.setLocalFolderName(meta.localFolderName ?? null);
    store.setLastSyncedAt(meta.lastSyncedAt ?? null);
    store.setLastSyncedCommitSha(meta.lastSyncedCommitSha ?? null);
    store.setRateLimit(meta.rateLimit ?? null);

    if (meta.tokenEnvelope?.mode === 'aes-gcm') {
      store.setHasPassphraseLock(true);
      if (!store.runtimeToken) {
        store.setVaultLocked(true);
      }
    } else if (meta.tokenEnvelope?.mode === 'plain') {
      store.setHasPassphraseLock(false);
      store.setVaultLocked(false);
      store.setRuntimeToken(meta.tokenEnvelope.token);
    }
  } else if (legacyToken && store.authSession) {
    const fallbackMeta: VaultMetaRecord = {
      id: 'active',
      source: 'github',
      owner: store.repoConfig.owner,
      repo: store.repoConfig.repo,
      branch: store.repoConfig.branch,
      authMode: store.authMode,
      user: store.authSession.user,
      avatarUrl: store.authSession.avatarUrl,
      tokenEnvelope: { mode: 'plain', token: legacyToken },
    };
    await vaultDb.vaultMeta.put(fallbackMeta);
    store.setVaultSource('github');
    store.setRuntimeToken(legacyToken);
  }

  if (files.length > 0) {
    store.setSyncedEntries(toFileEntries(files));
    if (!meta) {
      store.setVaultSource('github');
    }
  }

  const [outboxRows, recentFiles, pinnedFiles] = await Promise.all([
    vaultDb.outboxEdits.toArray(),
    getUserStateValue<string[]>('recentFiles', []),
    getUserStateValue<string[]>('pinnedFiles', []),
  ]);
  store.setOutboxEdits(outboxRows);
  store.setRecentFiles(recentFiles);
  store.setPinnedFiles(pinnedFiles);

  store.setDbHydrated(true);
}

export async function testPatConnection(
  config: RepoConfig,
  token: string,
): Promise<ConnectionTestResult> {
  return testGitHubConnection(config, token.trim());
}

export interface ConnectWithPatInput {
  config: RepoConfig;
  token: string;
  passphrase?: string;
}

export async function connectWithPat({
  config,
  token,
  passphrase,
}: ConnectWithPatInput): Promise<SyncResult | null> {
  const trimmedToken = token.trim();
  const conn = await testGitHubConnection(config, trimmedToken);

  const tokenEnvelope: TokenEnvelope = passphrase
    ? await encryptToken(trimmedToken, passphrase)
    : { mode: 'plain', token: trimmedToken };

  const existingMeta = await vaultDb.vaultMeta.get('active');
  const nextMeta: VaultMetaRecord = {
    ...(existingMeta ?? {}),
    id: 'active',
    source: 'github',
    owner: config.owner,
    repo: config.repo,
    branch: config.branch,
    authMode: 'pat',
    user: conn.user,
    avatarUrl: conn.avatarUrl,
    tokenEnvelope,
    passphraseLocked: Boolean(passphrase),
    rateLimit: conn.rateLimit,
  };
  await vaultDb.vaultMeta.put(nextMeta);

  const store = useAppStore.getState();
  store.setRepoConfig(config);
  store.setAuthMode('pat');
  store.setAuthSession({ user: conn.user, avatarUrl: conn.avatarUrl });
  store.setAuthError(null);
  store.setRuntimeToken(trimmedToken);
  store.setHasPassphraseLock(Boolean(passphrase));
  store.setVaultLocked(false);
  store.setVaultSource('github');
  store.setRateLimit(conn.rateLimit ?? null);

  return syncNow({ forceFullSync: true });
}

export interface ConnectWithOAuthInput {
  token: string;
  user: string;
  avatarUrl?: string;
  passphrase?: string;
}

export async function connectWithOAuthToken({
  token,
  user,
  avatarUrl,
  passphrase,
}: ConnectWithOAuthInput): Promise<SyncResult | null> {
  const store = useAppStore.getState();
  const config = store.repoConfig;
  const trimmedToken = token.trim();

  const tokenEnvelope: TokenEnvelope = passphrase
    ? await encryptToken(trimmedToken, passphrase)
    : { mode: 'plain', token: trimmedToken };

  const existingMeta = await vaultDb.vaultMeta.get('active');
  const nextMeta: VaultMetaRecord = {
    ...(existingMeta ?? {}),
    id: 'active',
    source: 'github',
    owner: config.owner,
    repo: config.repo,
    branch: config.branch,
    authMode: 'github-oauth',
    user,
    avatarUrl,
    tokenEnvelope,
    passphraseLocked: Boolean(passphrase),
  };
  await vaultDb.vaultMeta.put(nextMeta);

  store.setAuthMode('github-oauth');
  store.setAuthSession({ user, avatarUrl });
  store.setAuthError(null);
  store.setRuntimeToken(trimmedToken);
  store.setHasPassphraseLock(Boolean(passphrase));
  store.setVaultLocked(false);
  store.setVaultSource('github');

  return syncNow({ forceFullSync: true });
}

export async function connectLocalFolder(): Promise<SyncResult> {
  const store = useAppStore.getState();
  store.setSyncState('syncing');
  store.setSyncError(null);
  store.setSyncMessage('Scanning local vault folder...');

  try {
    const { dirHandle, result } = await pickLocalVaultDirectory(
      store.ignorePatterns,
      store.repoConfig,
      (progress) => store.setSyncProgress(progress),
    );
    activeLocalDirHandle = dirHandle;
    await refreshEntriesInStore();

    store.setAuthMode('local-fs');
    store.setVaultSource('local-fs');
    store.setLocalFolderName(dirHandle.name);
    store.setLastSyncedAt(Date.now());
    store.setLastSyncedCommitSha(null);
    store.setSyncState('idle');
    store.setSyncProgress(null);
    store.setSyncMessage(`Indexed ${result.totalFiles} files from ${dirHandle.name}`);
    return result;
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Failed to open local folder.';
    store.setSyncState('error');
    store.setSyncProgress(null);
    store.setSyncError(msg);
    throw err;
  }
}

export async function reconnectLocalFolder(): Promise<SyncResult> {
  const store = useAppStore.getState();
  const meta = await vaultDb.vaultMeta.get('active');
  const handle = activeLocalDirHandle ?? meta?.localDirHandle ?? null;
  if (!handle) {
    return connectLocalFolder();
  }

  const granted = await ensureHandlePermission(handle, 'read');
  if (!granted) {
    throw new Error('Permission to access the local vault folder was denied.');
  }

  activeLocalDirHandle = handle;
  store.setSyncState('syncing');
  store.setSyncError(null);

  try {
    const result = await indexLocalDirectory(
      handle,
      store.ignorePatterns,
      store.repoConfig,
      (progress) => store.setSyncProgress(progress),
    );
    await refreshEntriesInStore();
    store.setVaultSource('local-fs');
    store.setLastSyncedAt(Date.now());
    store.setSyncState('idle');
    store.setSyncProgress(null);
    store.setSyncMessage(`Re-indexed ${result.totalFiles} files`);
    return result;
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Failed to re-index folder.';
    store.setSyncState('error');
    store.setSyncProgress(null);
    store.setSyncError(msg);
    throw err;
  }
}

export async function syncNow(
  options: { forceFullSync?: boolean; silent?: boolean } = {},
): Promise<SyncResult | null> {
  if (inFlightSync) {
    return inFlightSync;
  }

  const store = useAppStore.getState();
  if (store.vaultSource === 'local-fs') {
    inFlightSync = reconnectLocalFolder().finally(() => {
      inFlightSync = null;
    });
    return inFlightSync;
  }

  if (!store.runtimeToken) {
    if (!options.silent) {
      if (store.vaultLocked) {
        store.setOnboardingOpen(true);
        store.setSyncError('Unlock your passphrase-protected vault to sync.');
      } else {
        store.setSyncError('Connect a GitHub token or local folder to sync.');
      }
    }
    return null;
  }

  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    if (!options.silent) {
      store.setSyncError('Offline — cached vault files remain browsable.');
    }
    return null;
  }

  const task = (async (): Promise<SyncResult | null> => {
    store.setSyncState('syncing');
    store.setSyncError(null);
    store.setSyncProgress({ phase: 'checking', done: 0, total: 1 });

    try {
      let pushedCount = 0;
      let autoMergedCount = 0;
      const pushRes = await pushOutboxToGitHub({
        config: useAppStore.getState().repoConfig,
        token: useAppStore.getState().runtimeToken!,
        ignorePatterns: useAppStore.getState().ignorePatterns,
        onProgress: (p) => useAppStore.getState().setSyncProgress(p),
      });

      pushedCount = pushRes.pushedCount;
      autoMergedCount = pushRes.autoMergedPaths.length;
      if (pushRes.rateLimit) {
        useAppStore.getState().setRateLimit(pushRes.rateLimit);
      }

      if (pushRes.conflictPaths.length > 0) {
        await refreshEntriesInStore();
        const current = useAppStore.getState();
        current.setSyncState('idle');
        current.setSyncProgress(null);
        current.setConflictModalOpen(true);
        current.setSyncError(
          `Sync paused: ${pushRes.conflictPaths.length} merge conflict(s) require resolution.`,
        );
        return null;
      }

      const result = await syncGitHubVault({
        config: useAppStore.getState().repoConfig,
        token: useAppStore.getState().runtimeToken!,
        ignorePatterns: useAppStore.getState().ignorePatterns,
        forceFullSync: options.forceFullSync,
        onProgress: (p) => useAppStore.getState().setSyncProgress(p),
      });

      await refreshEntriesInStore();
      triggerSearchCacheInvalidation();

      const updatedStore = useAppStore.getState();
      updatedStore.setVaultSource('github');
      updatedStore.setLastSyncedAt(Date.now());
      if (pushRes.commitSha || result.commitSha) {
        updatedStore.setLastSyncedCommitSha(
          pushRes.commitSha ?? result.commitSha ?? null,
        );
      }
      if (result.rateLimit) {
        updatedStore.setRateLimit(result.rateLimit);
      }
      updatedStore.setSyncState('idle');
      updatedStore.setSyncProgress(null);
      const summaryParts: string[] = [];
      if (pushedCount > 0) summaryParts.push(`Pushed ${pushedCount}`);
      if (autoMergedCount > 0) summaryParts.push(`Auto-merged ${autoMergedCount}`);
      summaryParts.push(
        result.status === 'up-to-date'
          ? 'Remote up to date'
          : `Pulled ${result.fetchedBlobs} file(s)`,
      );
      updatedStore.setSyncMessage(summaryParts.join(' · '));
      return result;
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'GitHub sync failed.';
      const current = useAppStore.getState();
      current.setSyncState('error');
      current.setSyncProgress(null);
      current.setSyncError(msg);
      throw err;
    } finally {
      inFlightSync = null;
    }
  })();

  inFlightSync = task;
  return task;
}

export async function unlockVaultWithPassphrase(
  passphrase: string,
): Promise<boolean> {
  const meta = await vaultDb.vaultMeta.get('active');
  if (!meta?.tokenEnvelope) {
    throw new Error('No encrypted credential found in local storage.');
  }

  if (meta.tokenEnvelope.mode === 'plain') {
    useAppStore.getState().setRuntimeToken(meta.tokenEnvelope.token);
    useAppStore.getState().setVaultLocked(false);
    return true;
  }

  const decrypted = await decryptToken(meta.tokenEnvelope, passphrase);
  const store = useAppStore.getState();
  store.setRuntimeToken(decrypted);
  store.setVaultLocked(false);
  store.setAuthError(null);
  store.setSyncError(null);

  if (typeof navigator === 'undefined' || navigator.onLine !== false) {
    void syncNow({ silent: true }).catch(() => {});
  }

  return true;
}

export function lockVaultNow(): void {
  const store = useAppStore.getState();
  if (!store.hasPassphraseLock) return;
  store.setRuntimeToken(null);
  store.setVaultLocked(true);
}

export async function enablePassphraseLock(passphrase: string): Promise<void> {
  const store = useAppStore.getState();
  if (!store.runtimeToken) {
    throw new Error('An active unlocked token is required to set a passphrase.');
  }
  const envelope = await encryptToken(store.runtimeToken, passphrase);
  const meta = await vaultDb.vaultMeta.get('active');
  if (!meta) {
    throw new Error('No active repository session found.');
  }
  await vaultDb.vaultMeta.put({
    ...meta,
    tokenEnvelope: envelope,
    passphraseLocked: true,
  });
  store.setHasPassphraseLock(true);
}

export async function disablePassphraseLock(): Promise<void> {
  const store = useAppStore.getState();
  if (!store.runtimeToken) {
    throw new Error('Unlock the vault first before removing the passphrase lock.');
  }
  const meta = await vaultDb.vaultMeta.get('active');
  if (!meta) return;
  await vaultDb.vaultMeta.put({
    ...meta,
    tokenEnvelope: { mode: 'plain', token: store.runtimeToken },
    passphraseLocked: false,
  });
  store.setHasPassphraseLock(false);
  store.setVaultLocked(false);
}

export async function readEntryText(path: string): Promise<string | null> {
  const state = useAppStore.getState();
  if (state.vaultSource === 'preview') return null;

  const provider = getActiveProvider();
  const content = await provider.readText(path);
  await refreshEntriesInStore();
  return content;
}

export async function readEntryBinary(path: string): Promise<BinaryReadResult> {
  const provider = getActiveProvider();
  const result = await provider.readBinary(path);
  await refreshEntriesInStore();
  return result;
}

export async function downloadAllBinariesOffline(
  onProgress?: (progress: SyncProgress) => void,
): Promise<{ downloaded: number; skipped: number; failed: number }> {
  const state = useAppStore.getState();
  if (state.vaultSource === 'preview') {
    return { downloaded: 0, skipped: 0, failed: 0 };
  }

  const provider = getActiveProvider();
  const binaries = (await vaultDb.files.toArray()).filter(
    (f) => f.isBinary && !f.isHidden,
  );
  const uncached = binaries.filter((f) => !f.isCached);
  const skipped = binaries.length - uncached.length;
  let downloaded = 0;
  let failed = 0;
  let done = 0;

  onProgress?.({ phase: 'binaries', done: 0, total: uncached.length });

  await runWithConcurrency(uncached, 3, async (file) => {
    try {
      await provider.readBinary(file.path);
      downloaded += 1;
    } catch {
      failed += 1;
    } finally {
      done += 1;
      onProgress?.({
        phase: 'binaries',
        done,
        total: uncached.length,
        currentPath: file.path,
      });
    }
  });

  await refreshEntriesInStore();
  return { downloaded, skipped, failed };
}

export async function getVaultStorageStats(): Promise<StorageStats> {
  const [estimate, binarySummary, files] = await Promise.all([
    getStorageEstimate(),
    getBinaryCacheSummary(),
    vaultDb.files.toArray(),
  ]);

  let textFileCount = 0;
  let cachedTextCount = 0;
  let binaryFileCount = 0;
  let cachedBinaryCount = 0;

  for (const file of files) {
    if (file.isBinary) {
      binaryFileCount += 1;
      if (file.isCached) cachedBinaryCount += 1;
    } else {
      textFileCount += 1;
      if (file.isCached) cachedTextCount += 1;
    }
  }

  return {
    usage: estimate.usage,
    quota: estimate.quota,
    persisted: estimate.persisted,
    binaryBackend: binarySummary.backend,
    textFileCount,
    cachedTextCount,
    binaryFileCount,
    cachedBinaryCount: Math.max(cachedBinaryCount, binarySummary.count),
    cachedBinaryBytes: binarySummary.totalBytes,
  };
}

export async function clearCachedBinaries(): Promise<void> {
  await clearAllBinaries();
  const binaries = await vaultDb.files.toArray();
  const toReset = binaries.filter((f) => f.isBinary && f.isCached);
  if (toReset.length > 0) {
    await vaultDb.files.bulkPut(
      toReset.map((f) => ({ ...f, isCached: false, updatedAt: Date.now() })),
    );
  }
  await refreshEntriesInStore();
}

export async function requestVaultPersistence(): Promise<boolean> {
  return requestPersistentStorage();
}

export async function getUserStateValue<T>(
  key: string,
  fallback: T,
): Promise<T> {
  try {
    const row = await vaultDb.userState.get(key);
    if (row && row.value !== undefined) {
      return row.value as T;
    }
  } catch {
    // Ignore IDB read issues in restricted environments
  }
  return fallback;
}

export async function setUserStateValue<T>(
  key: string,
  value: T,
): Promise<void> {
  try {
    await vaultDb.userState.put({
      key,
      value,
      updatedAt: Date.now(),
    });
  } catch {
    // Ignore IDB write issues
  }
}

export async function getVaultBacklinks(
  targetPath: string,
): Promise<BacklinkItem[]> {
  try {
    const files = await vaultDb.files.toArray();
    const enriched = files.map((file) => {
      if (
        (!file.outgoingLinks || file.outgoingLinks.length === 0) &&
        typeof file.content === 'string' &&
        (file.kind === 'markdown' || file.kind === 'canvas')
      ) {
        return {
          path: file.path,
          name: file.name,
          kind: file.kind,
          outgoingLinks: extractRawOutgoingTargets(file.kind, file.content),
        };
      }
      return {
        path: file.path,
        name: file.name,
        kind: file.kind,
        outgoingLinks: file.outgoingLinks,
      };
    });
    return computeBacklinksForTarget(targetPath, enriched);
  } catch {
    return [];
  }
}

export async function recordRecentFile(filePath: string): Promise<void> {
  const current = useAppStore.getState().recentFiles;
  const next = [filePath, ...current.filter((p) => p !== filePath)].slice(
    0,
    10,
  );
  useAppStore.getState().setRecentFiles(next);
  await setUserStateValue('recentFiles', next);
}

export async function togglePinnedFile(filePath: string): Promise<void> {
  const current = useAppStore.getState().pinnedFiles;
  const exists = current.includes(filePath);
  const next = exists
    ? current.filter((p) => p !== filePath)
    : [filePath, ...current];
  useAppStore.getState().setPinnedFiles(next);
  await setUserStateValue('pinnedFiles', next);
}

export async function saveLocalEdit(
  filePath: string,
  newContent: string,
): Promise<void> {
  const existing = await vaultDb.files.get(filePath);
  if (!existing) {
    throw new Error(`Cannot save unknown vault file: ${filePath}`);
  }

  const now = Date.now();
  const byteSize = new TextEncoder().encode(newContent).byteLength;
  const docMeta = extractDocumentMetadata(existing.kind, filePath, newContent);
  const source = useAppStore.getState().vaultSource;

  if (source === 'local-fs' && activeLocalDirHandle) {
    await writeLocalFileText(activeLocalDirHandle, filePath, newContent);
  }

  await vaultDb.transaction(
    'rw',
    [vaultDb.files, vaultDb.outboxEdits],
    async () => {
      await vaultDb.files.put({
        ...existing,
        size: byteSize,
        content: newContent,
        isCached: true,
        ...docMeta,
        updatedAt: now,
      });

      if (source === 'github') {
        const existingOutbox = await vaultDb.outboxEdits.get(filePath);
        const baseContent =
          existingOutbox?.baseContent ??
          (typeof existing.content === 'string' ? existing.content : '');
        const baseBlobSha =
          existingOutbox?.baseBlobSha ?? existing.blobSha;
        const op: OutboxEditRecord['op'] = existingOutbox?.op ?? 'update';

        if (op === 'update' && newContent === baseContent) {
          await vaultDb.outboxEdits.delete(filePath);
        } else {
          await vaultDb.outboxEdits.put({
            path: filePath,
            op,
            baseBlobSha,
            baseContent,
            localContent: newContent,
            status: 'pending',
            updatedAt: now,
          });
        }
      }
    },
  );

  triggerSearchCacheInvalidation();
  await refreshEntriesInStore();
}

export async function createNewVaultNote(
  rawPath: string,
  initialContent?: string,
): Promise<string> {
  let cleanPath = rawPath
    .trim()
    .replace(/\\/g, '/')
    .replace(/^\/+/, '');
  if (!cleanPath) {
    throw new Error('Enter a valid note path.');
  }
  if (!cleanPath.includes('.')) {
    cleanPath = `${cleanPath}.md`;
  }

  const existing = await vaultDb.files.get(cleanPath);
  if (existing) {
    useAppStore.getState().navigateToPath(cleanPath);
    return cleanPath;
  }

  const name = cleanPath.split('/').pop() ?? cleanPath;
  const title = name.replace(/\.md$/i, '');
  const content = initialContent ?? `# ${title}\n\n`;
  const kind = classifyFileKind(cleanPath);
  const ext = getFileExtension(cleanPath);
  const folder = cleanPath.includes('/')
    ? cleanPath.split('/').slice(0, -1).join('/')
    : '';
  const now = Date.now();
  const source = useAppStore.getState().vaultSource;
  const docMeta = extractDocumentMetadata(kind, cleanPath, content);

  if (source === 'local-fs' && activeLocalDirHandle) {
    await writeLocalFileText(activeLocalDirHandle, cleanPath, content);
  }

  await vaultDb.transaction(
    'rw',
    [vaultDb.files, vaultDb.outboxEdits],
    async () => {
      await vaultDb.files.put({
        path: cleanPath,
        name,
        ext,
        folder,
        kind,
        size: new TextEncoder().encode(content).byteLength,
        blobSha: `local-new-${now}`,
        isBinary: false,
        isHidden: isPathIgnored(cleanPath, useAppStore.getState().ignorePatterns),
        isCached: true,
        content,
        ...docMeta,
        updatedAt: now,
      });

      if (source === 'github') {
        await vaultDb.outboxEdits.put({
          path: cleanPath,
          op: 'create',
          baseBlobSha: '',
          baseContent: '',
          localContent: content,
          status: 'pending',
          updatedAt: now,
        });
      }
    },
  );

  triggerSearchCacheInvalidation();
  await refreshEntriesInStore();
  const store = useAppStore.getState();
  store.navigateToPath(cleanPath);
  store.setEditorMode('edit');
  return cleanPath;
}

export async function resolveConflictKeepLocal(filePath: string): Promise<void> {
  const edit = await vaultDb.outboxEdits.get(filePath);
  if (!edit) return;
  const now = Date.now();

  await vaultDb.outboxEdits.put({
    ...edit,
    baseContent: edit.remoteConflictContent ?? edit.baseContent,
    status: 'pending',
    remoteConflictContent: undefined,
    updatedAt: now,
  });

  await refreshEntriesInStore();
}

export async function resolveConflictKeepRemote(filePath: string): Promise<void> {
  const edit = await vaultDb.outboxEdits.get(filePath);
  const existing = await vaultDb.files.get(filePath);
  if (!edit) return;

  const remoteContent = edit.remoteConflictContent ?? '';
  const now = Date.now();

  await vaultDb.transaction(
    'rw',
    [vaultDb.files, vaultDb.outboxEdits],
    async () => {
      await vaultDb.outboxEdits.delete(filePath);
      if (existing) {
        if (!remoteContent && edit.op === 'update') {
          await vaultDb.files.delete(filePath);
        } else {
          const docMeta = extractDocumentMetadata(
            existing.kind,
            filePath,
            remoteContent,
          );
          await vaultDb.files.put({
            ...existing,
            blobSha: edit.baseBlobSha || existing.blobSha,
            content: remoteContent,
            size: new TextEncoder().encode(remoteContent).byteLength,
            isCached: true,
            ...docMeta,
            updatedAt: now,
          });
        }
      }
    },
  );

  triggerSearchCacheInvalidation();
  await refreshEntriesInStore();
}

export async function resolveConflictSaveCopy(
  filePath: string,
): Promise<string> {
  const edit = await vaultDb.outboxEdits.get(filePath);
  const existing = await vaultDb.files.get(filePath);
  if (!edit) {
    throw new Error(`No conflict found for ${filePath}`);
  }

  const copyPath = buildConflictCopyPath(filePath);
  const copyName = copyPath.split('/').pop() ?? copyPath;
  const copyKind = classifyFileKind(copyPath);
  const copyExt = getFileExtension(copyPath);
  const copyFolder = copyPath.includes('/')
    ? copyPath.split('/').slice(0, -1).join('/')
    : '';
  const copyMeta = extractDocumentMetadata(copyKind, copyPath, edit.localContent);

  const remoteContent = edit.remoteConflictContent ?? '';
  const now = Date.now();

  await vaultDb.transaction(
    'rw',
    [vaultDb.files, vaultDb.outboxEdits],
    async () => {
      await vaultDb.outboxEdits.delete(filePath);

      if (existing) {
        if (!remoteContent) {
          await vaultDb.files.delete(filePath);
        } else {
          const remoteMeta = extractDocumentMetadata(
            existing.kind,
            filePath,
            remoteContent,
          );
          await vaultDb.files.put({
            ...existing,
            blobSha: edit.baseBlobSha || existing.blobSha,
            content: remoteContent,
            size: new TextEncoder().encode(remoteContent).byteLength,
            isCached: true,
            ...remoteMeta,
            updatedAt: now,
          });
        }
      }

      await vaultDb.files.put({
        path: copyPath,
        name: copyName,
        ext: copyExt,
        folder: copyFolder,
        kind: copyKind,
        size: new TextEncoder().encode(edit.localContent).byteLength,
        blobSha: `local-conflict-${now}`,
        isBinary: false,
        isHidden: isPathIgnored(copyPath, useAppStore.getState().ignorePatterns),
        isCached: true,
        content: edit.localContent,
        ...copyMeta,
        updatedAt: now,
      });

      await vaultDb.outboxEdits.put({
        path: copyPath,
        op: 'create',
        baseBlobSha: '',
        baseContent: '',
        localContent: edit.localContent,
        status: 'pending',
        updatedAt: now,
      });
    },
  );

  triggerSearchCacheInvalidation();
  await refreshEntriesInStore();
  return copyPath;
}

export async function getVaultGraphData(): Promise<VaultGraphData> {
  const files = await vaultDb.files.toArray();
  return buildVaultGraph(files);
}

export async function listVaultRadarFiles(): Promise<
  Array<{ path: string; name: string; doc: RadarDocument; updatedAt: number }>
> {
  try {
    const files = await vaultDb.files.toArray();
    const detected: Array<{
      path: string;
      name: string;
      doc: RadarDocument;
      updatedAt: number;
    }> = [];
    for (const file of files) {
      if (file.ext !== 'json' || typeof file.content !== 'string') continue;
      if (!isRadarJsonString(file.content)) continue;
      const parsed = parseRadarJson(file.content, {
        allowUntypedShorthand: false,
      });
      if (parsed.ok) {
        detected.push({
          path: file.path,
          name: file.name,
          doc: parsed.doc,
          updatedAt: file.updatedAt,
        });
      }
    }
    return detected.sort((a, b) => a.path.localeCompare(b.path));
  } catch {
    return [];
  }
}

export async function saveRadarFileToVault(
  rawPath: string,
  doc: RadarDocument,
): Promise<string> {
  let cleanPath = rawPath
    .trim()
    .replace(/\\/g, '/')
    .replace(/^\/+/, '');
  if (!cleanPath) {
    throw new Error('Enter a valid radar JSON file path.');
  }
  if (!cleanPath.toLowerCase().endsWith('.json')) {
    cleanPath = `${cleanPath}.radar.json`;
  }

  const json = serializeRadarJson(doc);
  const existing = await vaultDb.files.get(cleanPath);
  if (existing) {
    await saveLocalEdit(cleanPath, json);
    return cleanPath;
  }

  const name = cleanPath.split('/').pop() ?? cleanPath;
  const ext = getFileExtension(cleanPath);
  const folder = cleanPath.includes('/')
    ? cleanPath.split('/').slice(0, -1).join('/')
    : '';
  const now = Date.now();
  const source = useAppStore.getState().vaultSource;
  const docMeta = extractDocumentMetadata('code', cleanPath, json);

  if (source === 'local-fs' && activeLocalDirHandle) {
    await writeLocalFileText(activeLocalDirHandle, cleanPath, json);
  }

  await vaultDb.transaction(
    'rw',
    [vaultDb.files, vaultDb.outboxEdits],
    async () => {
      await vaultDb.files.put({
        path: cleanPath,
        name,
        ext,
        folder,
        kind: 'code',
        size: new TextEncoder().encode(json).byteLength,
        blobSha: `local-new-${now}`,
        isBinary: false,
        isHidden: isPathIgnored(cleanPath, useAppStore.getState().ignorePatterns),
        isCached: true,
        content: json,
        ...docMeta,
        updatedAt: now,
      });

      if (source === 'github') {
        await vaultDb.outboxEdits.put({
          path: cleanPath,
          op: 'create',
          baseBlobSha: '',
          baseContent: '',
          localContent: json,
          status: 'pending',
          updatedAt: now,
        });
      }
    },
  );

  triggerSearchCacheInvalidation();
  await refreshEntriesInStore();
  return cleanPath;
}

export async function getLocalCustomRadars(): Promise<SavedCustomRadar[]> {
  return getUserStateValue<SavedCustomRadar[]>('customRadars', []);
}

export async function saveLocalCustomRadar(
  radar: SavedCustomRadar,
): Promise<SavedCustomRadar[]> {
  const current = await getLocalCustomRadars();
  const next = [radar, ...current.filter((r) => r.id !== radar.id)];
  await setUserStateValue('customRadars', next);
  return next;
}

export async function deleteLocalCustomRadar(
  id: string,
): Promise<SavedCustomRadar[]> {
  const current = await getLocalCustomRadars();
  const next = current.filter((r) => r.id !== id);
  await setUserStateValue('customRadars', next);
  return next;
}

export async function forgetTokenAndWipeCache(): Promise<void> {
  activeLocalDirHandle = null;
  inFlightSync = null;
  triggerSearchCacheInvalidation();

  await clearAllBinaries();
  await clearAllDexieTables();

  const store = useAppStore.getState();
  store.clearAuthSession();
  store.setVaultSource('preview');
  store.setSyncedEntries([]);
  store.setOutboxEdits([]);
  store.setRecentFiles([]);
  store.setPinnedFiles([]);
  store.setConflictModalOpen(false);
  store.setCommandPaletteOpen(false);
  store.setEditorMode('read');
  store.setStageView('document');
  store.setLocalFolderName(null);
  store.setLastSyncedAt(null);
  store.setLastSyncedCommitSha(null);
  store.setRateLimit(null);
  store.setSyncState('idle');
  store.setSyncProgress(null);
  store.setSyncMessage(null);
  store.setSyncError(null);
  store.setAuthError(null);
  store.setActivePath(null);
  store.setActiveHeadings([]);
  store.setActiveBacklinks([]);
  store.setPendingHeadingSlug(null);
}
