import Dexie, { type EntityTable } from 'dexie';
import type { FsaDirectoryHandle } from '@/features/vault/types/fsa';
import type {
  AuthMode,
  RateLimitInfo,
  TokenEnvelope,
  VaultFileEntry,
  VaultSource,
} from '@/features/vault/types/vault';

export interface VaultMetaRecord {
  id: 'active';
  source: VaultSource;
  owner: string;
  repo: string;
  branch: string;
  authMode: AuthMode;
  user?: string;
  avatarUrl?: string;
  lastSyncedCommitSha?: string;
  lastSyncedAt?: number;
  refEtag?: string;
  tokenEnvelope?: TokenEnvelope;
  passphraseLocked?: boolean;
  deviceLabel?: string;
  rateLimit?: RateLimitInfo;
  localFolderName?: string;
  localDirHandle?: FsaDirectoryHandle;
}

export interface VaultFileRecord extends VaultFileEntry {
  folder: string;
  blobSha: string;
  isBinary: boolean;
  isCached: boolean;
  updatedAt: number;
  content?: string;
  tags?: string[];
  topic?: string;
  frontmatter?: Record<string, unknown>;
  headings?: string[];
  outgoingLinks?: string[];
}

export interface OutboxEditRecord {
  path: string;
  op: 'update' | 'create' | 'delete';
  baseBlobSha: string;
  baseContent: string;
  localContent: string;
  status: 'pending' | 'conflict';
  remoteConflictContent?: string;
  updatedAt: number;
}

export interface SearchIndexRecord {
  id: string;
  serializedJson: string;
  commitSha: string;
  updatedAt: number;
}

export interface UserStateRecord {
  key: string;
  value: unknown;
  updatedAt: number;
}

export interface BinaryBlobRecord {
  blobSha: string;
  bytes: ArrayBuffer;
  mimeType: string;
  size: number;
  updatedAt: number;
}

export class GenForgeVaultDb extends Dexie {
  vaultMeta!: EntityTable<VaultMetaRecord, 'id'>;
  files!: EntityTable<VaultFileRecord, 'path'>;
  outboxEdits!: EntityTable<OutboxEditRecord, 'path'>;
  searchIndex!: EntityTable<SearchIndexRecord, 'id'>;
  userState!: EntityTable<UserStateRecord, 'key'>;
  binaryBlobs!: EntityTable<BinaryBlobRecord, 'blobSha'>;

  constructor(dbName = 'genforge-kb-db') {
    super(dbName);
    this.version(1).stores({
      vaultMeta: 'id',
      files:
        '&path, folder, ext, kind, *tags, topic, blobSha, isBinary, isCached',
      outboxEdits: '&path, status, updatedAt',
      searchIndex: 'id',
      userState: 'key',
      binaryBlobs: '&blobSha, updatedAt',
    });
  }
}

export const vaultDb = new GenForgeVaultDb();

/**
 * Clears all IndexedDB tables inside a single read-write transaction.
 */
export async function clearAllDexieTables(
  db: GenForgeVaultDb = vaultDb,
): Promise<void> {
  await db.transaction(
    'rw',
    [
      db.vaultMeta,
      db.files,
      db.outboxEdits,
      db.searchIndex,
      db.userState,
      db.binaryBlobs,
    ],
    async () => {
      await Promise.all([
        db.vaultMeta.clear(),
        db.files.clear(),
        db.outboxEdits.clear(),
        db.searchIndex.clear(),
        db.userState.clear(),
        db.binaryBlobs.clear(),
      ]);
    },
  );
}
