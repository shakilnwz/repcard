export type FileKind =
  | 'markdown'
  | 'canvas'
  | 'pdf'
  | 'image'
  | 'code'
  | 'other';

export interface VaultFileEntry {
  path: string;
  name: string;
  ext: string;
  kind: FileKind;
  size: number;
  isHidden?: boolean;
  taskTotal?: number;
  taskDone?: number;
  folder?: string;
  blobSha?: string;
  isBinary?: boolean;
  isCached?: boolean;
  updatedAt?: number;
}

export interface VaultFolderNode {
  type: 'folder';
  name: string;
  path: string;
  fileCount: number;
  children: VaultTreeNode[];
}

export interface VaultFileNode {
  type: 'file';
  name: string;
  path: string;
  entry: VaultFileEntry;
}

export type VaultTreeNode = VaultFolderNode | VaultFileNode;

export type AuthMode = 'github-oauth' | 'pat' | 'local-fs';

export type VaultSource = 'preview' | 'github' | 'local-fs';

export type SyncState = 'idle' | 'syncing' | 'error';

export interface RepoConfig {
  owner: string;
  repo: string;
  branch: string;
}

export type ThemeMode = 'dark' | 'light' | 'system';

export type MobileTab = 'home' | 'files' | 'search' | 'sync' | 'settings';

export interface AuthSession {
  user: string;
  avatarUrl?: string;
}

export interface RateLimitInfo {
  remaining: number;
  limit: number;
  resetAt: number;
}

export interface SyncProgress {
  phase: 'checking' | 'tree' | 'blobs' | 'indexing' | 'binaries' | 'saving';
  done: number;
  total: number;
  currentPath?: string;
}

export interface SyncResult {
  status: 'up-to-date' | 'synced';
  commitSha?: string;
  fetchedBlobs: number;
  removedFiles: number;
  binaryCount: number;
  totalFiles: number;
  apiCalls: number;
  rateLimit?: RateLimitInfo;
  durationMs: number;
}

export type TokenEnvelope =
  | {
      mode: 'plain';
      token: string;
    }
  | {
      mode: 'aes-gcm';
      ciphertextB64: string;
      ivB64: string;
      saltB64: string;
      iterations: number;
    };

export interface BinaryReadResult {
  bytes: Uint8Array;
  mimeType: string;
  fromCache: boolean;
}

export interface StorageStats {
  usage: number;
  quota: number;
  persisted: boolean;
  binaryBackend: 'opfs' | 'indexeddb';
  textFileCount: number;
  cachedTextCount: number;
  binaryFileCount: number;
  cachedBinaryCount: number;
  cachedBinaryBytes: number;
}

export interface VaultProvider {
  readonly mode: AuthMode;
  readonly label: string;
  listEntries(): Promise<VaultFileEntry[]>;
  readText(path: string): Promise<string>;
  readBinary(path: string): Promise<BinaryReadResult>;
}
