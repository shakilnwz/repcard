import { beforeEach, describe, expect, it } from 'vitest';
import { clearAllDexieTables, vaultDb } from '@/db/vaultDb';
import { bytesToBase64 } from '@/lib/crypto';
import { pushOutboxToGitHub } from '@/lib/githubPush';
import { DEFAULT_IGNORE_PATTERNS } from '@/lib/ignore';
import {
  resolveConflictKeepLocal,
  resolveConflictKeepRemote,
  resolveConflictSaveCopy,
} from '@/lib/vaultService';

const TEST_CONFIG = {
  owner: 'shakilnwz',
  repo: 'genforge-lab-knowledgebase',
  branch: 'main',
};

describe('githubPush and conflict resolution', () => {
  beforeEach(async () => {
    await clearAllDexieTables();
    await vaultDb.vaultMeta.put({
      id: 'active',
      owner: TEST_CONFIG.owner,
      repo: TEST_CONFIG.repo,
      branch: TEST_CONFIG.branch,
      source: 'github',
      authMode: 'pat',
      lastSyncedCommitSha: 'commit-base-1',
      lastSyncedAt: 1000,
    });
  });

  it('pushes multi-file outbox edits atomically with force: false and clears outboxEdits', async () => {
    await vaultDb.outboxEdits.bulkPut([
      {
        path: 'roadmaps/ai-engineer.md',
        op: 'update',
        baseBlobSha: 'sha-md-1',
        baseContent: '- [ ] Phase 1\n- [ ] Phase 2',
        localContent: '- [x] Phase 1\n- [ ] Phase 2',
        status: 'pending',
        updatedAt: 2000,
      },
      {
        path: 'roadmaps/python.canvas',
        op: 'update',
        baseBlobSha: 'sha-canvas-1',
        baseContent: '{"nodes":[],"edges":[]}',
        localContent: '{"nodes":[{"id":"n1","type":"text","text":"- [x] Done"}],"edges":[]}',
        status: 'pending',
        updatedAt: 2001,
      },
    ]);

    const calls: Array<{ method: string; url: string; body?: unknown }> = [];

    const mockFetch: typeof fetch = async (input, init) => {
      const url = String(input);
      const method = init?.method ?? 'GET';
      const body =
        typeof init?.body === 'string' ? JSON.parse(init.body) : undefined;
      calls.push({ method, url, body });

      if (method === 'GET' && url.includes('/git/ref/heads/main')) {
        return new Response(JSON.stringify({ object: { sha: 'commit-base-1' } }), {
          status: 200,
        });
      }
      if (method === 'GET' && url.includes('/git/commits/commit-base-1')) {
        return new Response(JSON.stringify({ tree: { sha: 'tree-base-1' } }), {
          status: 200,
        });
      }
      if (method === 'POST' && url.includes('/git/blobs')) {
        const idx = calls.filter((c) => c.url.includes('/git/blobs')).length;
        return new Response(JSON.stringify({ sha: `new-blob-${idx}` }), {
          status: 201,
        });
      }
      if (method === 'POST' && url.includes('/git/trees')) {
        return new Response(JSON.stringify({ sha: 'tree-new-1' }), {
          status: 201,
        });
      }
      if (method === 'POST' && url.includes('/git/commits')) {
        return new Response(JSON.stringify({ sha: 'commit-new-1' }), {
          status: 201,
        });
      }
      if (method === 'PATCH' && url.includes('/git/refs/heads/main')) {
        return new Response(JSON.stringify({ object: { sha: 'commit-new-1' } }), {
          status: 200,
        });
      }
      return new Response('Not Found', { status: 404 });
    };

    const res = await pushOutboxToGitHub({
      config: TEST_CONFIG,
      token: 'token-123',
      ignorePatterns: DEFAULT_IGNORE_PATTERNS,
      fetchImpl: mockFetch,
    });

    expect(res.pushedCount).toBe(2);
    expect(res.conflictPaths).toEqual([]);
    expect(res.commitSha).toBe('commit-new-1');

    const patchCall = calls.find((c) => c.method === 'PATCH');
    expect(patchCall?.body).toEqual({ sha: 'commit-new-1', force: false });

    const treeCall = calls.find(
      (c) => c.method === 'POST' && c.url.includes('/git/trees'),
    );
    expect(treeCall?.body).toMatchObject({ base_tree: 'tree-base-1' });

    expect(await vaultDb.outboxEdits.count()).toBe(0);
    const meta = await vaultDb.vaultMeta.get('active');
    expect(meta?.lastSyncedCommitSha).toBe('commit-new-1');
  });

  it('auto-merges non-overlapping concurrent remote commits cleanly without conflict', async () => {
    const baseText = '- [ ] Task A\n- [ ] Task B\n- [ ] Task C\n- [ ] Task D';
    const localText = '- [x] Task A\n- [ ] Task B\n- [ ] Task C\n- [ ] Task D';
    const remoteText = '- [ ] Task A\n- [ ] Task B\n- [ ] Task C\n- [x] Task D';

    await vaultDb.outboxEdits.put({
      path: 'notes/plan.md',
      op: 'update',
      baseBlobSha: 'sha-base',
      baseContent: baseText,
      localContent: localText,
      status: 'pending',
      updatedAt: 2000,
    });

    let pushedBlobDecoded = '';
    const mockFetch: typeof fetch = async (input, init) => {
      const url = String(input);
      const method = init?.method ?? 'GET';
      if (method === 'GET' && url.includes('/git/ref/heads/main')) {
        return new Response(JSON.stringify({ object: { sha: 'commit-remote-2' } }), {
          status: 200,
        });
      }
      if (method === 'GET' && url.includes('/git/commits/commit-remote-2')) {
        return new Response(JSON.stringify({ tree: { sha: 'tree-remote-2' } }), {
          status: 200,
        });
      }
      if (method === 'GET' && url.includes('/git/trees/tree-remote-2')) {
        return new Response(
          JSON.stringify({
            tree: [{ path: 'notes/plan.md', type: 'blob', sha: 'sha-remote-2' }],
          }),
          { status: 200 },
        );
      }
      if (method === 'GET' && url.includes('/git/blobs/sha-remote-2')) {
        return new Response(
          JSON.stringify({
            content: bytesToBase64(new TextEncoder().encode(remoteText)),
            encoding: 'base64',
          }),
          { status: 200 },
        );
      }
      if (method === 'POST' && url.includes('/git/blobs')) {
        const parsed = JSON.parse(String(init?.body)) as { content: string };
        pushedBlobDecoded = atob(parsed.content);
        return new Response(JSON.stringify({ sha: 'sha-merged-1' }), { status: 201 });
      }
      if (method === 'POST' && url.includes('/git/trees')) {
        return new Response(JSON.stringify({ sha: 'tree-merged-1' }), { status: 201 });
      }
      if (method === 'POST' && url.includes('/git/commits')) {
        return new Response(JSON.stringify({ sha: 'commit-merged-1' }), { status: 201 });
      }
      if (method === 'PATCH' && url.includes('/git/refs/heads/main')) {
        return new Response(JSON.stringify({ object: { sha: 'commit-merged-1' } }), {
          status: 200,
        });
      }
      return new Response('Not Found', { status: 404 });
    };

    const res = await pushOutboxToGitHub({
      config: TEST_CONFIG,
      token: 'token-123',
      ignorePatterns: DEFAULT_IGNORE_PATTERNS,
      fetchImpl: mockFetch,
    });

    expect(res.pushedCount).toBe(1);
    expect(res.autoMergedPaths).toEqual(['notes/plan.md']);
    expect(res.conflictPaths).toEqual([]);
    expect(pushedBlobDecoded).toContain('- [x] Task A');
    expect(pushedBlobDecoded).toContain('- [x] Task D');
  });

  it('halts push on overlapping conflict and supports Keep Local, Keep Remote, and Save Conflict Copy', async () => {
    const filePath = 'notes/shared.md';
    await vaultDb.files.put({
      path: filePath,
      name: 'shared.md',
      folder: 'notes',
      ext: '.md',
      kind: 'markdown',
      size: 20,
      blobSha: 'sha-base',
      isHidden: false,
      isBinary: false,
      isCached: true,
      content: 'Line 1\nLocal change',
      updatedAt: 2000,
    });
    await vaultDb.outboxEdits.put({
      path: filePath,
      op: 'update',
      baseBlobSha: 'sha-base',
      baseContent: 'Line 1\nOriginal',
      localContent: 'Line 1\nLocal change',
      status: 'pending',
      updatedAt: 2000,
    });

    const mockFetch: typeof fetch = async (input, init) => {
      const url = String(input);
      const method = init?.method ?? 'GET';
      if (method === 'GET' && url.includes('/git/ref/heads/main')) {
        return new Response(JSON.stringify({ object: { sha: 'commit-remote-2' } }), {
          status: 200,
        });
      }
      if (method === 'GET' && url.includes('/git/commits/commit-remote-2')) {
        return new Response(JSON.stringify({ tree: { sha: 'tree-remote-2' } }), {
          status: 200,
        });
      }
      if (method === 'GET' && url.includes('/git/trees/tree-remote-2')) {
        return new Response(
          JSON.stringify({
            tree: [{ path: filePath, type: 'blob', sha: 'sha-remote-conflict' }],
          }),
          { status: 200 },
        );
      }
      if (method === 'GET' && url.includes('/git/blobs/sha-remote-conflict')) {
        return new Response(
          JSON.stringify({
            content: bytesToBase64(new TextEncoder().encode('Line 1\nRemote Obsidian change')),
            encoding: 'base64',
          }),
          { status: 200 },
        );
      }
      throw new Error(`Unexpected write call during conflict: ${method} ${url}`);
    };

    const res = await pushOutboxToGitHub({
      config: TEST_CONFIG,
      token: 'token-123',
      ignorePatterns: DEFAULT_IGNORE_PATTERNS,
      fetchImpl: mockFetch,
    });

    expect(res.pushedCount).toBe(0);
    expect(res.conflictPaths).toEqual([filePath]);

    const flagged = await vaultDb.outboxEdits.get(filePath);
    expect(flagged?.status).toBe('conflict');
    expect(flagged?.remoteConflictContent).toBe('Line 1\nRemote Obsidian change');

    // Test Save Conflict Copy resolution
    const copyPath = await resolveConflictSaveCopy(filePath);
    expect(copyPath).toMatch(/^notes\/shared\.conflict-\d{8}-\d{6}\.md$/);
    expect(await vaultDb.outboxEdits.get(filePath)).toBeUndefined();
    const copyOutbox = await vaultDb.outboxEdits.get(copyPath);
    expect(copyOutbox?.op).toBe('create');
    expect(copyOutbox?.localContent).toBe('Line 1\nLocal change');
    expect((await vaultDb.files.get(filePath))?.content).toBe(
      'Line 1\nRemote Obsidian change',
    );

    // Verify Keep Local & Keep Remote flows
    await vaultDb.outboxEdits.put({
      path: filePath,
      op: 'update',
      baseBlobSha: 'sha-remote-conflict',
      baseContent: 'Line 1\nOriginal',
      localContent: 'Line 1\nOverride local',
      remoteConflictContent: 'Line 1\nRemote Obsidian change',
      status: 'conflict',
      updatedAt: 3000,
    });
    await resolveConflictKeepLocal(filePath);
    expect((await vaultDb.outboxEdits.get(filePath))?.status).toBe('pending');

    await vaultDb.outboxEdits.put({
      path: filePath,
      op: 'update',
      baseBlobSha: 'sha-remote-conflict',
      baseContent: 'Line 1\nOriginal',
      localContent: 'Line 1\nOverride local',
      remoteConflictContent: 'Line 1\nRemote Obsidian change',
      status: 'conflict',
      updatedAt: 4000,
    });
    await resolveConflictKeepRemote(filePath);
    expect(await vaultDb.outboxEdits.get(filePath)).toBeUndefined();
  });
});
