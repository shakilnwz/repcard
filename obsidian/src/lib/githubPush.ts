import { vaultDb, type OutboxEditRecord, type VaultFileRecord } from '@/db/vaultDb';
import { bytesToBase64 } from '@/lib/crypto';
import { extractDocumentMetadata } from '@/lib/documentIndex';
import {
  buildGitHubHeaders,
  buildHttpError,
  fetchGitHubBlobBytes,
  GITHUB_API_BASE,
  GitHubApiError,
  parseRateLimit,
} from '@/lib/githubApi';
import { isPathIgnored } from '@/lib/ignore';
import { mergeThreeWay } from '@/lib/merge3way';
import { classifyFileKind, getFileExtension } from '@/lib/tree';
import type { RateLimitInfo, RepoConfig, SyncProgress } from '@/types/vault';

export interface PushOutboxOptions {
  config: RepoConfig;
  token: string;
  deviceLabel?: string;
  ignorePatterns: string[];
  onProgress?: (progress: SyncProgress) => void;
  fetchImpl?: typeof fetch;
}

export interface PushOutboxResult {
  pushedCount: number;
  autoMergedPaths: string[];
  conflictPaths: string[];
  commitSha?: string;
  remoteHadUpdates: boolean;
  rateLimit?: RateLimitInfo;
}

async function githubJson<T>(
  url: string,
  token: string,
  init: RequestInit,
  fetchImpl: typeof fetch,
  fallbackErr: string,
): Promise<{ data: T; rateLimit?: RateLimitInfo }> {
  let res: Response;
  try {
    res = await fetchImpl(url, {
      ...init,
      headers: {
        ...buildGitHubHeaders(token),
        ...(init.body ? { 'Content-Type': 'application/json' } : {}),
        ...(init.headers ?? {}),
      },
    });
  } catch (err) {
    throw new GitHubApiError(
      'network',
      err instanceof Error ? err.message : 'Network request failed.',
    );
  }

  const rateLimit = parseRateLimit(res.headers);
  if (!res.ok) {
    throw await buildHttpError(res, fallbackErr);
  }
  const data = (await res.json()) as T;
  return { data, rateLimit };
}

function buildCommitMessage(
  edits: readonly OutboxEditRecord[],
  deviceLabel = 'web',
): string {
  const cleanDevice = deviceLabel.replace(/[^a-zA-Z0-9._-]/g, '-').slice(0, 24) || 'web';
  if (edits.length === 1) {
    const file = edits[0];
    const verb =
      file.op === 'create'
        ? 'create'
        : file.op === 'delete'
          ? 'delete'
          : 'update';
    const shortName = file.path.split('/').pop() ?? file.path;
    return `kb-app(${cleanDevice}): ${verb} ${shortName}`;
  }
  const preview = edits
    .slice(0, 2)
    .map((e) => e.path.split('/').pop() ?? e.path)
    .join(', ');
  const suffix = edits.length > 2 ? `, +${edits.length - 2} more` : '';
  return `kb-app(${cleanDevice}): update ${edits.length} files (${preview}${suffix})`;
}

/**
 * Atomically pushes pending local edits from `outboxEdits` using the GitHub Git Data API
 * (`POST /git/blobs` -> `POST /git/trees` -> `POST /git/commits` -> `PATCH /git/refs/heads/{branch}`).
 * Automatically merges non-overlapping remote commits (Obsidian `github-sync` interop) and flags
 * overlapping conflicts without force-pushing or overwriting user work.
 */
export async function pushOutboxToGitHub({
  config,
  token,
  deviceLabel = 'pwa',
  ignorePatterns,
  onProgress,
  fetchImpl = fetch,
}: PushOutboxOptions): Promise<PushOutboxResult> {
  const allOutbox = await vaultDb.outboxEdits.toArray();
  const pendingEdits = allOutbox.filter((e) => e.status === 'pending');

  if (pendingEdits.length === 0) {
    const existingConflicts = allOutbox
      .filter((e) => e.status === 'conflict')
      .map((e) => e.path);
    return {
      pushedCount: 0,
      autoMergedPaths: [],
      conflictPaths: existingConflicts,
      remoteHadUpdates: false,
    };
  }

  onProgress?.({ phase: 'checking', done: 0, total: 1 });

  const owner = encodeURIComponent(config.owner);
  const repo = encodeURIComponent(config.repo);
  const branch = encodeURIComponent(config.branch);

  // 1. Inspect live remote HEAD ref & commit base tree
  const refRes = await githubJson<{ object: { sha: string } }>(
    `${GITHUB_API_BASE}/repos/${owner}/${repo}/git/ref/heads/${branch}`,
    token,
    { method: 'GET' },
    fetchImpl,
    `Failed to inspect remote branch ${config.branch}.`,
  );
  let rateLimit = refRes.rateLimit;
  const remoteHeadSha = refRes.data.object.sha;

  const commitRes = await githubJson<{ tree: { sha: string } }>(
    `${GITHUB_API_BASE}/repos/${owner}/${repo}/git/commits/${remoteHeadSha}`,
    token,
    { method: 'GET' },
    fetchImpl,
    'Failed to inspect remote commit tree.',
  );
  rateLimit = commitRes.rateLimit ?? rateLimit;
  const baseTreeSha = commitRes.data.tree.sha;

  const meta = await vaultDb.vaultMeta.get('active');
  const remoteHadUpdates = Boolean(
    meta?.lastSyncedCommitSha && meta.lastSyncedCommitSha !== remoteHeadSha,
  );

  const autoMergedPaths: string[] = [];
  const conflictPaths: string[] = [];
  const conflictRecords: OutboxEditRecord[] = [];
  const readyEdits: OutboxEditRecord[] = [];

  if (remoteHadUpdates) {
    const treeRes = await githubJson<{
      tree?: Array<{ path: string; type: string; sha: string }>;
    }>(
      `${GITHUB_API_BASE}/repos/${owner}/${repo}/git/trees/${baseTreeSha}?recursive=1`,
      token,
      { method: 'GET' },
      fetchImpl,
      'Failed to inspect remote tree for merge check.',
    );
    rateLimit = treeRes.rateLimit ?? rateLimit;

    const remoteBlobMap = new Map<string, string>();
    for (const item of treeRes.data.tree ?? []) {
      if (item.type === 'blob') {
        remoteBlobMap.set(item.path, item.sha);
      }
    }

    for (const edit of pendingEdits) {
      const remoteSha = remoteBlobMap.get(edit.path);

      if (edit.op === 'create') {
        if (!remoteSha) {
          readyEdits.push(edit);
          continue;
        }
        const remoteBlob = await fetchGitHubBlobBytes(
          config,
          token,
          remoteSha,
          fetchImpl,
        );
        rateLimit = remoteBlob.rateLimit ?? rateLimit;
        const remoteText = new TextDecoder('utf-8').decode(remoteBlob.bytes);
        const merged = mergeThreeWay('', edit.localContent, remoteText);
        if (merged.hasConflict) {
          conflictPaths.push(edit.path);
          conflictRecords.push({
            ...edit,
            status: 'conflict',
            baseBlobSha: remoteSha,
            remoteConflictContent: remoteText,
            updatedAt: Date.now(),
          });
        } else {
          autoMergedPaths.push(edit.path);
          readyEdits.push({
            ...edit,
            op: 'update',
            baseBlobSha: remoteSha,
            baseContent: remoteText,
            localContent: merged.merged,
            updatedAt: Date.now(),
          });
        }
        continue;
      }

      if (edit.op === 'delete') {
        if (!remoteSha || remoteSha === edit.baseBlobSha) {
          readyEdits.push(edit);
        } else {
          const remoteBlob = await fetchGitHubBlobBytes(
            config,
            token,
            remoteSha,
            fetchImpl,
          );
          rateLimit = remoteBlob.rateLimit ?? rateLimit;
          const remoteText = new TextDecoder('utf-8').decode(remoteBlob.bytes);
          conflictPaths.push(edit.path);
          conflictRecords.push({
            ...edit,
            status: 'conflict',
            baseBlobSha: remoteSha,
            remoteConflictContent: remoteText,
            updatedAt: Date.now(),
          });
        }
        continue;
      }

      // op === 'update'
      if (!remoteSha) {
        // Remote deleted the file while we edited it locally
        conflictPaths.push(edit.path);
        conflictRecords.push({
          ...edit,
          status: 'conflict',
          remoteConflictContent: '',
          updatedAt: Date.now(),
        });
        continue;
      }

      if (remoteSha === edit.baseBlobSha) {
        readyEdits.push(edit);
        continue;
      }

      const remoteBlob = await fetchGitHubBlobBytes(
        config,
        token,
        remoteSha,
        fetchImpl,
      );
      rateLimit = remoteBlob.rateLimit ?? rateLimit;
      const remoteText = new TextDecoder('utf-8').decode(remoteBlob.bytes);
      const mergeRes = mergeThreeWay(
        edit.baseContent,
        edit.localContent,
        remoteText,
      );

      if (mergeRes.hasConflict) {
        conflictPaths.push(edit.path);
        conflictRecords.push({
          ...edit,
          status: 'conflict',
          baseBlobSha: remoteSha,
          remoteConflictContent: remoteText,
          updatedAt: Date.now(),
        });
      } else {
        autoMergedPaths.push(edit.path);
        readyEdits.push({
          ...edit,
          baseBlobSha: remoteSha,
          baseContent: remoteText,
          localContent: mergeRes.merged,
          updatedAt: Date.now(),
        });
      }
    }
  } else {
    readyEdits.push(...pendingEdits);
  }

  // Persist any conflicts or pre-push auto-merged edits safely
  if (conflictRecords.length > 0) {
    await vaultDb.outboxEdits.bulkPut(conflictRecords);
    return {
      pushedCount: 0,
      autoMergedPaths,
      conflictPaths,
      remoteHadUpdates,
      rateLimit,
    };
  }

  // Also halt push if previous unresolved conflicts exist on other paths
  const preExistingConflicts = allOutbox
    .filter((e) => e.status === 'conflict')
    .map((e) => e.path);
  if (preExistingConflicts.length > 0) {
    return {
      pushedCount: 0,
      autoMergedPaths,
      conflictPaths: preExistingConflicts,
      remoteHadUpdates,
      rateLimit,
    };
  }

  // 2. Create Git blobs & prepare tree entries
  const treeEntries: Array<{
    path: string;
    mode: '100644';
    type: 'blob';
    sha: string | null;
  }> = [];
  const uploadedBlobShas = new Map<string, string>();
  const totalWork = readyEdits.length + 2;
  let doneWork = 0;

  for (const edit of readyEdits) {
    onProgress?.({
      phase: 'saving',
      done: doneWork,
      total: totalWork,
      currentPath: edit.path,
    });

    if (edit.op === 'delete') {
      treeEntries.push({
        path: edit.path,
        mode: '100644',
        type: 'blob',
        sha: null,
      });
    } else {
      const encodedB64 = bytesToBase64(
        new TextEncoder().encode(edit.localContent),
      );
      const blobRes = await githubJson<{ sha: string }>(
        `${GITHUB_API_BASE}/repos/${owner}/${repo}/git/blobs`,
        token,
        {
          method: 'POST',
          body: JSON.stringify({
            content: encodedB64,
            encoding: 'base64',
          }),
        },
        fetchImpl,
        `Failed to upload blob for ${edit.path}.`,
      );
      rateLimit = blobRes.rateLimit ?? rateLimit;
      uploadedBlobShas.set(edit.path, blobRes.data.sha);
      treeEntries.push({
        path: edit.path,
        mode: '100644',
        type: 'blob',
        sha: blobRes.data.sha,
      });
    }
    doneWork += 1;
  }

  // 3. Create tree -> commit -> non-forced ref update
  onProgress?.({ phase: 'saving', done: doneWork, total: totalWork });
  const newTreeRes = await githubJson<{ sha: string }>(
    `${GITHUB_API_BASE}/repos/${owner}/${repo}/git/trees`,
    token,
    {
      method: 'POST',
      body: JSON.stringify({
        base_tree: baseTreeSha,
        tree: treeEntries,
      }),
    },
    fetchImpl,
    'Failed to create remote Git tree.',
  );
  rateLimit = newTreeRes.rateLimit ?? rateLimit;

  const commitMessage = buildCommitMessage(readyEdits, deviceLabel);
  const newCommitRes = await githubJson<{ sha: string }>(
    `${GITHUB_API_BASE}/repos/${owner}/${repo}/git/commits`,
    token,
    {
      method: 'POST',
      body: JSON.stringify({
        message: commitMessage,
        tree: newTreeRes.data.sha,
        parents: [remoteHeadSha],
      }),
    },
    fetchImpl,
    'Failed to create remote commit.',
  );
  rateLimit = newCommitRes.rateLimit ?? rateLimit;
  const newCommitSha = newCommitRes.data.sha;

  const refPatchRes = await githubJson<{ object: { sha: string } }>(
    `${GITHUB_API_BASE}/repos/${owner}/${repo}/git/refs/heads/${branch}`,
    token,
    {
      method: 'PATCH',
      body: JSON.stringify({
        sha: newCommitSha,
        force: false,
      }),
    },
    fetchImpl,
    'Failed to update remote branch ref cleanly.',
  );
  rateLimit = refPatchRes.rateLimit ?? rateLimit;

  const now = Date.now();
  await vaultDb.transaction(
    'rw',
    [vaultDb.files, vaultDb.outboxEdits, vaultDb.vaultMeta],
    async () => {
      await vaultDb.outboxEdits.bulkDelete(readyEdits.map((e) => e.path));

      for (const edit of readyEdits) {
        if (edit.op === 'delete') {
          await vaultDb.files.delete(edit.path);
          continue;
        }
        const existing = await vaultDb.files.get(edit.path);
        const kind = existing?.kind ?? classifyFileKind(edit.path);
        const name =
          existing?.name ?? edit.path.split('/').pop() ?? edit.path;
        const folder =
          existing?.folder ??
          (edit.path.includes('/')
            ? edit.path.split('/').slice(0, -1).join('/')
            : '');
        const ext = existing?.ext ?? getFileExtension(edit.path);
        const blobSha =
          uploadedBlobShas.get(edit.path) ?? existing?.blobSha ?? '';
        const docMeta = extractDocumentMetadata(
          kind,
          edit.path,
          edit.localContent,
        );

        const nextFile: VaultFileRecord = {
          path: edit.path,
          name,
          ext,
          folder,
          kind,
          size: new TextEncoder().encode(edit.localContent).byteLength,
          blobSha,
          isBinary: false,
          isHidden: existing?.isHidden ?? isPathIgnored(edit.path, ignorePatterns),
          isCached: true,
          content: edit.localContent,
          ...docMeta,
          updatedAt: now,
        };
        await vaultDb.files.put(nextFile);
      }

      if (meta) {
        await vaultDb.vaultMeta.put({
          ...meta,
          lastSyncedCommitSha: newCommitSha,
          refEtag: undefined,
          lastSyncedAt: now,
          rateLimit: rateLimit ?? meta.rateLimit,
        });
      }
    },
  );

  return {
    pushedCount: readyEdits.length,
    autoMergedPaths,
    conflictPaths: [],
    commitSha: newCommitSha,
    remoteHadUpdates,
    rateLimit,
  };
}
