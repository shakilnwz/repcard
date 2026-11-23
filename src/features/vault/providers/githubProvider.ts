import { vaultDb } from '@/shared/db/vaultDb';
import { getBinary, guessMimeType, putBinary } from '@/features/vault/lib/binaryStore';
import { extractDocumentMetadata } from '@/features/vault/lib/documentIndex';
import { fetchGitHubBlobBytes } from '@/features/vault/lib/githubApi';
import type {
  AuthMode,
  BinaryReadResult,
  RepoConfig,
  VaultFileEntry,
  VaultProvider,
} from '@/features/vault/types/vault';

export interface GitHubVaultProviderOptions {
  mode: Extract<AuthMode, 'github-oauth' | 'pat'>;
  config: RepoConfig;
  getToken: () => string | null;
  fetchImpl?: typeof fetch;
}

export class GitHubVaultProvider implements VaultProvider {
  readonly mode: AuthMode;
  readonly label: string;
  private readonly config: RepoConfig;
  private readonly getToken: () => string | null;
  private readonly fetchImpl: typeof fetch;

  constructor({
    mode,
    config,
    getToken,
    fetchImpl = fetch,
  }: GitHubVaultProviderOptions) {
    this.mode = mode;
    this.label = `${config.owner}/${config.repo}`;
    this.config = config;
    this.getToken = getToken;
    this.fetchImpl = fetchImpl;
  }

  async listEntries(): Promise<VaultFileEntry[]> {
    return vaultDb.files.toArray();
  }

  async readText(path: string): Promise<string> {
    const record = await vaultDb.files.get(path);
    if (!record) {
      throw new Error(`File not found in vault index: ${path}`);
    }
    if (record.isBinary) {
      throw new Error(`Cannot read binary file as text: ${path}`);
    }
    if (record.isCached && typeof record.content === 'string') {
      return record.content;
    }

    const token = this.getToken();
    if (!token) {
      throw new Error(
        'File is not cached offline and the vault is locked or signed out.',
      );
    }

    const { bytes } = await fetchGitHubBlobBytes(
      this.config,
      token,
      record.blobSha,
      this.fetchImpl,
    );
    const text = new TextDecoder('utf-8').decode(bytes);
    const docMeta = extractDocumentMetadata(record.kind, path, text);

    await vaultDb.files.update(path, {
      content: text,
      isCached: true,
      ...docMeta,
      updatedAt: Date.now(),
    });

    return text;
  }

  async readBinary(path: string): Promise<BinaryReadResult> {
    const record = await vaultDb.files.get(path);
    if (!record) {
      throw new Error(`File not found in vault index: ${path}`);
    }

    const fallbackMime = guessMimeType(path);
    const cached = await getBinary(record.blobSha, fallbackMime);
    if (cached) {
      if (!record.isCached) {
        await vaultDb.files.update(path, {
          isCached: true,
          updatedAt: Date.now(),
        });
      }
      return {
        bytes: cached.bytes,
        mimeType: cached.mimeType,
        fromCache: true,
      };
    }

    const token = this.getToken();
    if (!token) {
      throw new Error(
        'Asset is not cached offline and no active GitHub token is unlocked.',
      );
    }

    const { bytes } = await fetchGitHubBlobBytes(
      this.config,
      token,
      record.blobSha,
      this.fetchImpl,
    );
    await putBinary(record.blobSha, bytes, fallbackMime);
    await vaultDb.files.update(path, {
      isCached: true,
      updatedAt: Date.now(),
    });

    return {
      bytes,
      mimeType: fallbackMime,
      fromCache: false,
    };
  }
}
