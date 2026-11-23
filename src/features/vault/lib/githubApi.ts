import { vaultDb, type OutboxEditRecord, type VaultFileRecord, type VaultMetaRecord } from '@/shared/db/vaultDb';
import { requestPersistentStorage } from '@/features/vault/lib/binaryStore';
import { base64ToBytes } from '@/shared/lib/crypto';
import { countTasksInContent, extractDocumentMetadata } from '@/features/vault/lib/documentIndex';
import { isPathIgnored } from '@/features/vault/lib/ignore';
import { classifyFileKind, getFileExtension } from '@/features/vault/lib/tree';
import type {
  FileKind,
  RateLimitInfo,
  RepoConfig,
  SyncProgress,
  SyncResult,
} from '@/features/vault/types/vault';

export { countTasksInContent };

export const GITHUB_API_BASE = 'https://api.github.com';
export const DEFAULT_BLOB_CONCURRENCY = 6;
export const MAX_EAGER_TEXT_BYTES = 1_500_000;

export type GitHubErrorCode =
  | 'unauthorized'
  | 'push_access_required'
  | 'not_found'
  | 'rate_limited'
  | 'network'
  | 'unknown';

export class GitHubApiError extends Error {
  readonly code: GitHubErrorCode;
  readonly status?: number;
  readonly rateLimit?: RateLimitInfo;

  constructor(
    code: GitHubErrorCode,
    message: string,
    status?: number,
    rateLimit?: RateLimitInfo,
  ) {
    super(message);
    this.name = 'GitHubApiError';
    this.code = code;
    this.status = status;
    this.rateLimit = rateLimit;
  }
}

export function parseRateLimit(headers: Headers): RateLimitInfo | undefined {
  const remRaw = headers.get('x-ratelimit-remaining');
  const limitRaw = headers.get('x-ratelimit-limit');
  const resetRaw = headers.get('x-ratelimit-reset');
  if (remRaw === null || limitRaw === null) return undefined;

  const remaining = Number(remRaw);
  const limit = Number(limitRaw);
  const resetSec = resetRaw !== null ? Number(resetRaw) : 0;
  if (!Number.isFinite(remaining) || !Number.isFinite(limit)) return undefined;

  return {
    remaining,
    limit,
    resetAt: Number.isFinite(resetSec) ? resetSec * 1000 : 0,
  };
}

export function decodeBase64ToBytes(base64: string): Uint8Array {
  return base64ToBytes(base64);
}

export function decodeBase64ToUtf8(base64: string): string {
  return new TextDecoder('utf-8').decode(base64ToBytes(base64));
}

export function isBinaryFile(path: string): boolean {
  const kind = classifyFileKind(path);
  return kind === 'pdf' || kind === 'image' || kind === 'other';
}

export async function runWithConcurrency<T, R>(
  items: readonly T[],
  concurrency: number,
  worker: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  if (items.length === 0) return [];
  const limit = Math.max(1, Math.min(concurrency, items.length));
  const results = new Array<R>(items.length);
  let nextIndex = 0;

  async function runWorker() {
    while (nextIndex < items.length) {
      const current = nextIndex;
      nextIndex += 1;
      results[current] = await worker(items[current], current);
    }
  }

  await Promise.all(Array.from({ length: limit }, () => runWorker()));
  return results;
}

export function buildGitHubHeaders(token: string, etag?: string): HeadersInit {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
  };
  if (etag) {
    headers['If-None-Match'] = etag;
  }
  return headers;
}

async function fetchGitHub(
  url: string,
  token: string,
  fetchImpl: typeof fetch,
  etag?: string,
): Promise<Response> {
  try {
    return await fetchImpl(url, {
      headers: buildGitHubHeaders(token, etag),
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Network request failed';
    throw new GitHubApiError('network', msg);
  }
}

export async function buildHttpError(res: Response, fallbackMsg: string): Promise<GitHubApiError> {
  const rateLimit = parseRateLimit(res.headers);
  let apiMessage = fallbackMsg;
  try {
    const body = (await res.json()) as { message?: string };
    if (body?.message) apiMessage = body.message;
  } catch {
    // Ignore non-JSON error body
  }

  if (res.status === 401) {
    return new GitHubApiError(
      'unauthorized',
      `Authentication failed (401): ${apiMessage}`,
      401,
      rateLimit,
    );
  }
  if (res.status === 404) {
    return new GitHubApiError(
      'not_found',
      `Repository, branch, or object not found (404): ${apiMessage}`,
      404,
      rateLimit,
    );
  }
  if (res.status === 403 || res.status === 429) {
    if (rateLimit?.remaining === 0 || /rate limit/i.test(apiMessage)) {
      return new GitHubApiError(
        'rate_limited',
        `GitHub API rate limit exceeded: ${apiMessage}`,
        res.status,
        rateLimit,
      );
    }
    return new GitHubApiError(
      'push_access_required',
      `Repository access denied (${res.status}): ${apiMessage}`,
      res.status,
      rateLimit,
    );
  }

  return new GitHubApiError(
    'unknown',
    `GitHub API error (${res.status}): ${apiMessage}`,
    res.status,
    rateLimit,
  );
}

export interface ConnectionTestResult {
  user: string;
  avatarUrl?: string;
  fullName: string;
  defaultBranch: string;
  isPrivate: boolean;
  rateLimit?: RateLimitInfo;
}

export async function testGitHubConnection(
  config: RepoConfig,
  token: string,
  fetchImpl: typeof fetch = fetch,
): Promise<ConnectionTestResult> {
  const repoUrl = `${GITHUB_API_BASE}/repos/${encodeURIComponent(config.owner)}/${encodeURIComponent(config.repo)}`;
  const repoRes = await fetchGitHub(repoUrl, token, fetchImpl);
  let rateLimit = parseRateLimit(repoRes.headers);

  if (!repoRes.ok) {
    throw await buildHttpError(repoRes, 'Failed to inspect target repository.');
  }

  const repoData = (await repoRes.json()) as {
    full_name?: string;
    default_branch?: string;
    private?: boolean;
    permissions?: {
      push?: boolean;
      admin?: boolean;
      pull?: boolean;
    };
  };

  if (repoData.permissions?.push !== true) {
    throw new GitHubApiError(
      'push_access_required',
      `Push access is required on ${config.owner}/${config.repo}. Your token only grants read/other access.`,
      403,
      rateLimit,
    );
  }

  let user = config.owner;
  let avatarUrl: string | undefined;

  try {
    const userRes = await fetchGitHub(`${GITHUB_API_BASE}/user`, token, fetchImpl);
    rateLimit = parseRateLimit(userRes.headers) ?? rateLimit;
    if (userRes.ok) {
      const userData = (await userRes.json()) as {
        login?: string;
        avatar_url?: string;
      };
      if (userData.login) user = userData.login;
      if (userData.avatar_url) avatarUrl = userData.avatar_url;
    }
  } catch {
    // Fine-grained PATs scoped only to Contents may not expose /user; repo push check succeeded
  }

  return {
    user,
    avatarUrl,
    fullName: repoData.full_name ?? `${config.owner}/${config.repo}`,
    defaultBranch: repoData.default_branch ?? config.branch,
    isPrivate: Boolean(repoData.private),
    rateLimit,
  };
}

export async function fetchGitHubBlobBytes(
  config: RepoConfig,
  token: string,
  blobSha: string,
  fetchImpl: typeof fetch = fetch,
): Promise<{ bytes: Uint8Array; rateLimit?: RateLimitInfo }> {
  const url = `${GITHUB_API_BASE}/repos/${encodeURIComponent(config.owner)}/${encodeURIComponent(config.repo)}/git/blobs/${encodeURIComponent(blobSha)}`;
  const res = await fetchGitHub(url, token, fetchImpl);
  const rateLimit = parseRateLimit(res.headers);
  if (!res.ok) {
    throw await buildHttpError(res, `Failed to fetch blob ${blobSha.slice(0, 7)}.`);
  }

  const data = (await res.json()) as { content?: string; encoding?: string };
  if (typeof data.content !== 'string') {
    throw new GitHubApiError('unknown', `Blob ${blobSha.slice(0, 7)} returned no content.`);
  }

  return {
    bytes: decodeBase64ToBytes(data.content),
    rateLimit,
  };
}

interface GitTreeEntry {
  path: string;
  mode?: string;
  type: string;
  sha: string;
  size?: number;
}

export interface SyncGitHubVaultOptions {
  config: RepoConfig;
  token: string;
  ignorePatterns: string[];
  forceFullSync?: boolean;
  onProgress?: (progress: SyncProgress) => void;
  fetchImpl?: typeof fetch;
}

export async function syncGitHubVault({
  config,
  token,
  ignorePatterns,
  forceFullSync = false,
  onProgress,
  fetchImpl = fetch,
}: SyncGitHubVaultOptions): Promise<SyncResult> {
  const startedAt = Date.now();
  let apiCalls = 0;

  const existingMeta = await vaultDb.vaultMeta.get('active');
  const existingFiles = await vaultDb.files.toArray();
  const sameTarget = Boolean(
    existingMeta?.source === 'github' &&
      existingMeta.owner === config.owner &&
      existingMeta.repo === config.repo &&
      existingMeta.branch === config.branch,
  );

  onProgress?.({ phase: 'checking', done: 0, total: 1 });

  const refUrl = `${GITHUB_API_BASE}/repos/${encodeURIComponent(config.owner)}/${encodeURIComponent(config.repo)}/git/ref/heads/${encodeURIComponent(config.branch)}`;
  const useEtag =
    sameTarget && !forceFullSync && existingFiles.length > 0
      ? existingMeta?.refEtag
      : undefined;

  apiCalls += 1;
  const refRes = await fetchGitHub(refUrl, token, fetchImpl, useEtag);
  let rateLimit = parseRateLimit(refRes.headers);

  if (refRes.status === 304) {
    const now = Date.now();
    if (existingMeta) {
      await vaultDb.vaultMeta.put({
        ...existingMeta,
        source: 'github',
        lastSyncedAt: now,
        rateLimit: rateLimit ?? existingMeta.rateLimit,
      });
    }
    const binaryCount = existingFiles.filter((f) => f.isBinary).length;
    return {
      status: 'up-to-date',
      commitSha: existingMeta?.lastSyncedCommitSha,
      fetchedBlobs: 0,
      removedFiles: 0,
      binaryCount,
      totalFiles: existingFiles.length,
      apiCalls,
      rateLimit,
      durationMs: Date.now() - startedAt,
    };
  }

  if (!refRes.ok) {
    throw await buildHttpError(refRes, `Failed to check branch ${config.branch}.`);
  }

  const refData = (await refRes.json()) as { object?: { sha?: string } };
  const remoteCommitSha = refData.object?.sha;
  if (!remoteCommitSha) {
    throw new GitHubApiError('unknown', 'Branch reference did not include a commit SHA.');
  }
  const newEtag = refRes.headers.get('etag') ?? undefined;

  if (
    sameTarget &&
    !forceFullSync &&
    existingMeta?.lastSyncedCommitSha === remoteCommitSha &&
    existingFiles.length > 0
  ) {
    const now = Date.now();
    await vaultDb.vaultMeta.put({
      ...existingMeta,
      source: 'github',
      refEtag: newEtag ?? existingMeta.refEtag,
      lastSyncedAt: now,
      rateLimit: rateLimit ?? existingMeta.rateLimit,
    });
    const binaryCount = existingFiles.filter((f) => f.isBinary).length;
    return {
      status: 'up-to-date',
      commitSha: remoteCommitSha,
      fetchedBlobs: 0,
      removedFiles: 0,
      binaryCount,
      totalFiles: existingFiles.length,
      apiCalls,
      rateLimit,
      durationMs: Date.now() - startedAt,
    };
  }

  onProgress?.({ phase: 'tree', done: 0, total: 1 });
  const treeUrl = `${GITHUB_API_BASE}/repos/${encodeURIComponent(config.owner)}/${encodeURIComponent(config.repo)}/git/trees/${encodeURIComponent(remoteCommitSha)}?recursive=1`;
  apiCalls += 1;
  const treeRes = await fetchGitHub(treeUrl, token, fetchImpl);
  rateLimit = parseRateLimit(treeRes.headers) ?? rateLimit;

  if (!treeRes.ok) {
    throw await buildHttpError(treeRes, 'Failed to fetch repository tree.');
  }

  const treeData = (await treeRes.json()) as {
    tree?: GitTreeEntry[];
    truncated?: boolean;
  };
  const remoteBlobs = (treeData.tree ?? []).filter(
    (item): item is GitTreeEntry =>
      item.type === 'blob' && Boolean(item.path) && Boolean(item.sha),
  );

  const existingMap = new Map(existingFiles.map((file) => [file.path, file]));
  const outboxRows = await vaultDb.outboxEdits.toArray();
  const outboxMap = new Map(outboxRows.map((row) => [row.path, row]));
  const remotePathSet = new Set(remoteBlobs.map((item) => item.path));

  const removedPaths: string[] = [];
  for (const local of existingFiles) {
    if (!remotePathSet.has(local.path) && !outboxMap.has(local.path)) {
      removedPaths.push(local.path);
    }
  }

  interface PendingTextFetch {
    blob: GitTreeEntry;
    kind: FileKind;
    ext: string;
    folder: string;
    name: string;
    isHidden: boolean;
    outboxConflict?: OutboxEditRecord;
  }

  const toFetch: PendingTextFetch[] = [];
  const upserts: VaultFileRecord[] = [];
  const outboxUpdates: OutboxEditRecord[] = [];
  const now = Date.now();
  let binaryCount = 0;

  for (const item of remoteBlobs) {
    const filePath = item.path;
    const name = filePath.split('/').pop() ?? filePath;
    const folder = filePath.includes('/')
      ? filePath.split('/').slice(0, -1).join('/')
      : '';
    const ext = getFileExtension(filePath);
    const kind = classifyFileKind(filePath);
    const isBinary = isBinaryFile(filePath);
    const isHidden = isPathIgnored(filePath, ignorePatterns);
    const size = item.size ?? 0;

    if (isBinary) {
      binaryCount += 1;
    }

    const local = existingMap.get(filePath);
    const outbox = outboxMap.get(filePath);

    // Dirty outbox protection: never overwrite local unpushed edits
    if (outbox && local && local.blobSha !== item.sha && !isBinary) {
      toFetch.push({
        blob: item,
        kind,
        ext,
        folder,
        name,
        isHidden,
        outboxConflict: outbox,
      });
      upserts.push({
        ...local,
        folder,
        ext,
        kind,
        size,
        isHidden,
        updatedAt: now,
      });
      continue;
    }

    if (isBinary) {
      const sameBlob = Boolean(local && local.blobSha === item.sha);
      upserts.push({
        path: filePath,
        name,
        ext,
        folder,
        kind,
        size,
        blobSha: item.sha,
        isBinary: true,
        isHidden,
        isCached: Boolean(sameBlob && local?.isCached),
        updatedAt: sameBlob && local ? local.updatedAt : now,
      });
      continue;
    }

    const shouldEagerFetch = !isHidden && size <= MAX_EAGER_TEXT_BYTES;
    const hasFreshContent = Boolean(
      local &&
        local.blobSha === item.sha &&
        local.isCached &&
        typeof local.content === 'string',
    );

    if (shouldEagerFetch && (!hasFreshContent || forceFullSync)) {
      toFetch.push({
        blob: item,
        kind,
        ext,
        folder,
        name,
        isHidden,
      });
    } else {
      const sameBlob = Boolean(local && local.blobSha === item.sha);
      upserts.push({
        path: filePath,
        name,
        ext,
        folder,
        kind,
        size,
        blobSha: item.sha,
        isBinary: false,
        isHidden,
        isCached: Boolean(sameBlob && local?.isCached && typeof local.content === 'string'),
        content: sameBlob ? local?.content : undefined,
        taskTotal: sameBlob ? local?.taskTotal : undefined,
        taskDone: sameBlob ? local?.taskDone : undefined,
        updatedAt: sameBlob && local ? local.updatedAt : now,
      });
    }
  }

  let completedFetches = 0;
  onProgress?.({
    phase: 'blobs',
    done: 0,
    total: toFetch.length,
  });

  await runWithConcurrency(toFetch, DEFAULT_BLOB_CONCURRENCY, async (entry) => {
    apiCalls += 1;
    const { bytes, rateLimit: blobRateLimit } = await fetchGitHubBlobBytes(
      config,
      token,
      entry.blob.sha,
      fetchImpl,
    );
    if (blobRateLimit) {
      rateLimit = blobRateLimit;
    }

    const decodedText = new TextDecoder('utf-8').decode(bytes);
    if (entry.outboxConflict) {
      outboxUpdates.push({
        ...entry.outboxConflict,
        status: 'conflict',
        remoteConflictContent: decodedText,
        updatedAt: now,
      });
    } else {
      const docMeta = extractDocumentMetadata(
        entry.kind,
        entry.blob.path,
        decodedText,
      );
      upserts.push({
        path: entry.blob.path,
        name: entry.name,
        ext: entry.ext,
        folder: entry.folder,
        kind: entry.kind,
        size: entry.blob.size ?? bytes.byteLength,
        blobSha: entry.blob.sha,
        isBinary: false,
        isHidden: entry.isHidden,
        isCached: true,
        content: decodedText,
        ...docMeta,
        updatedAt: now,
      });
    }

    completedFetches += 1;
    onProgress?.({
      phase: 'blobs',
      done: completedFetches,
      total: toFetch.length,
      currentPath: entry.blob.path,
    });
  });

  onProgress?.({ phase: 'saving', done: 0, total: 1 });

  const nextMeta: VaultMetaRecord = {
    id: 'active',
    source: 'github',
    owner: config.owner,
    repo: config.repo,
    branch: config.branch,
    authMode: existingMeta?.authMode === 'local-fs' ? 'pat' : (existingMeta?.authMode ?? 'pat'),
    user: existingMeta?.user,
    avatarUrl: existingMeta?.avatarUrl,
    tokenEnvelope: existingMeta?.tokenEnvelope,
    passphraseLocked: existingMeta?.passphraseLocked,
    deviceLabel: existingMeta?.deviceLabel,
    lastSyncedCommitSha: remoteCommitSha,
    lastSyncedAt: now,
    refEtag: newEtag,
    rateLimit: rateLimit ?? existingMeta?.rateLimit,
  };

  await vaultDb.transaction(
    'rw',
    [vaultDb.files, vaultDb.vaultMeta, vaultDb.outboxEdits],
    async () => {
      if (removedPaths.length > 0) {
        await vaultDb.files.bulkDelete(removedPaths);
      }
      if (upserts.length > 0) {
        await vaultDb.files.bulkPut(upserts);
      }
      if (outboxUpdates.length > 0) {
        await vaultDb.outboxEdits.bulkPut(outboxUpdates);
      }
      await vaultDb.vaultMeta.put(nextMeta);
    },
  );

  void requestPersistentStorage();

  return {
    status: 'synced',
    commitSha: remoteCommitSha,
    fetchedBlobs: toFetch.length,
    removedFiles: removedPaths.length,
    binaryCount,
    totalFiles: remoteBlobs.length,
    apiCalls,
    rateLimit,
    durationMs: Date.now() - startedAt,
  };
}
