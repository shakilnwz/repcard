import { beforeEach, describe, expect, it, vi } from 'vitest';
import { clearAllDexieTables, vaultDb } from '@/db/vaultDb';
import { clearAllBinaries } from '@/lib/binaryStore';
import { bytesToBase64 } from '@/lib/crypto';
import {
  GitHubApiError,
  syncGitHubVault,
  testGitHubConnection,
} from '@/lib/githubApi';
import { DEFAULT_IGNORE_PATTERNS } from '@/lib/ignore';
import { forgetTokenAndWipeCache } from '@/lib/vaultService';
import { GitHubVaultProvider } from '@/providers/githubProvider';
import type { RepoConfig } from '@/types/vault';

const REPO_CONFIG: RepoConfig = {
  owner: 'shakilnwz',
  repo: 'genforge-lab-knowledgebase',
  branch: 'main',
};

function encodeGitHubBase64Text(text: string): string {
  const b64 = bytesToBase64(new TextEncoder().encode(text));
  // GitHub wraps base64 blob responses every 60 chars with newlines
  return b64.replace(/(.{60})/g, '$1\n');
}

function encodeGitHubBase64Bytes(bytes: Uint8Array): string {
  return bytesToBase64(bytes).replace(/(.{60})/g, '$1\n');
}

function jsonResponse(
  body: unknown,
  status = 200,
  extraHeaders: Record<string, string> = {},
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'x-ratelimit-remaining': '4990',
      'x-ratelimit-limit': '5000',
      'x-ratelimit-reset': '1900000000',
      ...extraHeaders,
    },
  });
}

describe('GitHub Git Data API Delta Sync & Push-Access Gate', () => {
  beforeEach(async () => {
    await clearAllBinaries();
    await clearAllDexieTables();
  });

  it('enforces permissions.push === true and rejects unauthorized or read-only tokens', async () => {
    const readOnlyFetch = vi.fn<typeof fetch>(async (url) => {
      if (String(url).includes('/repos/')) {
        return jsonResponse({
          full_name: 'shakilnwz/genforge-lab-knowledgebase',
          private: true,
          permissions: { pull: true, push: false, admin: false },
        });
      }
      return jsonResponse({ login: 'viewer' });
    });

    await expect(
      testGitHubConnection(REPO_CONFIG, 'tok-readonly', readOnlyFetch),
    ).rejects.toMatchObject({
      name: 'GitHubApiError',
      code: 'push_access_required',
    } satisfies Partial<GitHubApiError>);

    const unauthFetch = vi.fn<typeof fetch>(async () =>
      jsonResponse({ message: 'Bad credentials' }, 401),
    );
    await expect(
      testGitHubConnection(REPO_CONFIG, 'bad-tok', unauthFetch),
    ).rejects.toMatchObject({
      code: 'unauthorized',
    });

    const pushFetch = vi.fn<typeof fetch>(async (url) => {
      if (String(url).endsWith('/user')) {
        return jsonResponse({
          login: 'shakilnwz',
          avatar_url: 'https://avatars.githubusercontent.com/u/1?v=4',
        });
      }
      return jsonResponse({
        full_name: 'shakilnwz/genforge-lab-knowledgebase',
        default_branch: 'main',
        private: true,
        permissions: { pull: true, push: true, admin: true },
      });
    });

    const ok = await testGitHubConnection(REPO_CONFIG, 'tok-push', pushFetch);
    expect(ok.user).toBe('shakilnwz');
    expect(ok.isPrivate).toBe(true);
    expect(ok.rateLimit?.remaining).toBe(4990);
  });

  it('performs initial text sync, handles UTF-8 Base64, skips binaries, honors 304, and diffs deltas', async () => {
    const mdV1 =
      '# AI Engineer 🚀 → Vault\n\n- [x] Phase 1 complete\n- [ ] Phase 2 sync\n';
    const canvasV1 = JSON.stringify({
      nodes: [
        { id: '1', type: 'text', x: 0, y: 0, width: 200, height: 100, text: '- [x] Done\n- [ ] Next' },
      ],
      edges: [],
    });
    const pdfBytes = new Uint8Array([37, 80, 68, 70, 45, 49, 46, 55, 10]);

    const blobRequestedShas: string[] = [];
    const seenIfNoneMatch: Array<string | null> = [];
    let serverCommit = 'commit-sha-1';
    let serverEtag = '"etag-commit-1"';
    let return304 = false;

    const mockFetch = vi.fn<typeof fetch>(async (input, init) => {
      const url = String(input);
      const headers = new Headers(init?.headers);

      if (url.includes('/git/ref/heads/main')) {
        seenIfNoneMatch.push(headers.get('If-None-Match'));
        if (return304 && headers.get('If-None-Match') === serverEtag) {
          return new Response(null, {
            status: 304,
            headers: {
              'x-ratelimit-remaining': '4989',
              'x-ratelimit-limit': '5000',
              'x-ratelimit-reset': '1900000000',
            },
          });
        }
        return jsonResponse(
          { object: { sha: serverCommit } },
          200,
          { ETag: serverEtag },
        );
      }

      if (url.includes('/git/trees/commit-sha-1')) {
        return jsonResponse({
          tree: [
            { path: 'roadmaps/ai-engineer.md', type: 'blob', sha: 'sha-md-1', size: mdV1.length },
            { path: 'roadmaps/python.canvas', type: 'blob', sha: 'sha-canvas-1', size: canvasV1.length },
            { path: 'laravel/clean-code-in-laravel.pdf', type: 'blob', sha: 'sha-pdf-1', size: 6883828 },
            { path: 'app/package.json', type: 'blob', sha: 'sha-ignored-app', size: 800 },
            { path: '.obsidian/app.json', type: 'blob', sha: 'sha-ignored-obs', size: 90 },
          ],
        });
      }

      if (url.includes('/git/trees/commit-sha-2')) {
        const mdV2 = '# AI Engineer v2\n- [x] Updated\n';
        return jsonResponse({
          tree: [
            { path: 'roadmaps/ai-engineer.md', type: 'blob', sha: 'sha-md-2', size: mdV2.length },
            { path: 'laravel/clean-code-in-laravel.pdf', type: 'blob', sha: 'sha-pdf-1', size: 6883828 },
          ],
        });
      }

      const blobSha = url.split('/git/blobs/')[1];
      blobRequestedShas.push(blobSha);

      if (blobSha === 'sha-md-1') {
        return jsonResponse({ content: encodeGitHubBase64Text(mdV1), encoding: 'base64' });
      }
      if (blobSha === 'sha-canvas-1') {
        return jsonResponse({ content: encodeGitHubBase64Text(canvasV1), encoding: 'base64' });
      }
      if (blobSha === 'sha-md-2') {
        return jsonResponse({
          content: encodeGitHubBase64Text('# AI Engineer v2\n- [x] Updated\n'),
          encoding: 'base64',
        });
      }
      if (blobSha === 'sha-pdf-1') {
        return jsonResponse({
          content: encodeGitHubBase64Bytes(pdfBytes),
          encoding: 'base64',
        });
      }

      return jsonResponse({ message: 'Not found' }, 404);
    });

    // 1. Initial sync
    const res1 = await syncGitHubVault({
      config: REPO_CONFIG,
      token: 'tok-push',
      ignorePatterns: DEFAULT_IGNORE_PATTERNS,
      fetchImpl: mockFetch,
    });

    expect(res1.status).toBe('synced');
    expect(res1.fetchedBlobs).toBe(2); // ONLY non-ignored text files
    expect(blobRequestedShas).toEqual(expect.arrayContaining(['sha-md-1', 'sha-canvas-1']));
    expect(blobRequestedShas).not.toContain('sha-pdf-1');
    expect(blobRequestedShas).not.toContain('sha-ignored-app');
    expect(blobRequestedShas).not.toContain('sha-ignored-obs');

    const mdRecord = await vaultDb.files.get('roadmaps/ai-engineer.md');
    expect(mdRecord?.content).toBe(mdV1); // Verifies multi-byte UTF-8 Rocket & Arrow decoded accurately
    expect(mdRecord?.taskTotal).toBe(2);
    expect(mdRecord?.taskDone).toBe(1);

    const canvasRecord = await vaultDb.files.get('roadmaps/python.canvas');
    expect(canvasRecord?.taskTotal).toBe(2);
    expect(canvasRecord?.taskDone).toBe(1);

    const pdfRecord = await vaultDb.files.get('laravel/clean-code-in-laravel.pdf');
    expect(pdfRecord?.isBinary).toBe(true);
    expect(pdfRecord?.isCached).toBe(false);

    // 2. Conditional 304 check consumes 1 check call, 0 tree/blob calls
    return304 = true;
    const callsBefore304 = mockFetch.mock.calls.length;
    const res304 = await syncGitHubVault({
      config: REPO_CONFIG,
      token: 'tok-push',
      ignorePatterns: DEFAULT_IGNORE_PATTERNS,
      fetchImpl: mockFetch,
    });

    expect(res304.status).toBe('up-to-date');
    expect(res304.fetchedBlobs).toBe(0);
    expect(mockFetch.mock.calls.length - callsBefore304).toBe(1);
    expect(seenIfNoneMatch.at(-1)).toBe('"etag-commit-1"');

    // 3. On-demand lazy PDF download -> 2nd open hits cache with 0 network calls
    const provider = new GitHubVaultProvider({
      mode: 'pat',
      config: REPO_CONFIG,
      getToken: () => 'tok-push',
      fetchImpl: mockFetch,
    });

    const firstPdfRead = await provider.readBinary('laravel/clean-code-in-laravel.pdf');
    expect(firstPdfRead.fromCache).toBe(false);
    expect(Array.from(firstPdfRead.bytes)).toEqual(Array.from(pdfBytes));

    const networkOfflineFetch = vi.fn<typeof fetch>(async () => {
      throw new Error('Offline!');
    });
    const offlineProvider = new GitHubVaultProvider({
      mode: 'pat',
      config: REPO_CONFIG,
      getToken: () => null,
      fetchImpl: networkOfflineFetch,
    });

    const cachedPdfRead = await offlineProvider.readBinary('laravel/clean-code-in-laravel.pdf');
    expect(cachedPdfRead.fromCache).toBe(true);
    expect(cachedPdfRead.mimeType).toBe('application/pdf');
    await expect(
      offlineProvider.readText('roadmaps/ai-engineer.md'),
    ).resolves.toBe(mdV1);
    expect(networkOfflineFetch).not.toHaveBeenCalled();

    // 4. Incremental delta commit-sha-2 -> updates changed MD only, deletes removed canvas, preserves cached PDF
    return304 = false;
    serverCommit = 'commit-sha-2';
    serverEtag = '"etag-commit-2"';
    blobRequestedShas.length = 0;

    const res2 = await syncGitHubVault({
      config: REPO_CONFIG,
      token: 'tok-push',
      ignorePatterns: DEFAULT_IGNORE_PATTERNS,
      fetchImpl: mockFetch,
    });

    expect(res2.status).toBe('synced');
    expect(res2.fetchedBlobs).toBe(1);
    expect(blobRequestedShas).toEqual(['sha-md-2']);
    expect(await vaultDb.files.get('roadmaps/python.canvas')).toBeUndefined();
    expect((await vaultDb.files.get('laravel/clean-code-in-laravel.pdf'))?.isCached).toBe(true);

    // 5. Forget & Wipe clears everything
    await forgetTokenAndWipeCache();
    expect(await vaultDb.files.count()).toBe(0);
    expect(await vaultDb.vaultMeta.get('active')).toBeUndefined();
  });
});
