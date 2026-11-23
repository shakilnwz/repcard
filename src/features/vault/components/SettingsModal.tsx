import {
  Check,
  Database,
  Download,
  Lock,
  Palette,
  RotateCcw,
  ShieldAlert,
  Trash2,
  Unlock,
  X,
} from '@/shared/ui/MaterialIcons';
import { useEffect, useState } from 'react';
import { COLOR_MODES } from '@/features/repcard/lib/colorModes';
import { COLOR_MODE_LABELS } from '@/shared/lib/theme';
import { formatBytes, formatTimestamp } from '@/shared/lib/format';
import { DEFAULT_IGNORE_PATTERNS } from '@/features/vault/lib/ignore';
import { isStandaloneMode } from '@/shared/lib/pwa';
import {
  clearCachedBinaries,
  disablePassphraseLock,
  downloadAllBinariesOffline,
  enablePassphraseLock,
  forgetTokenAndWipeCache,
  getVaultStorageStats,
  lockVaultNow,
  requestVaultPersistence,
} from '@/features/vault/lib/vaultService';
import { useAppStore } from '@/shared/store/useAppStore';
import type { AuthMode, StorageStats, SyncProgress } from '@/features/vault/types/vault';

export function SettingsModal() {
  const open = useAppStore((s) => s.settingsOpen);
  const colorMode = useAppStore((s) => s.colorMode);
  const vimMode = useAppStore((s) => s.vimMode);
  const showHiddenFiles = useAppStore((s) => s.showHiddenFiles);
  const ignorePatterns = useAppStore((s) => s.ignorePatterns);
  const repoConfig = useAppStore((s) => s.repoConfig);
  const authMode = useAppStore((s) => s.authMode);
  const authSession = useAppStore((s) => s.authSession);
  const vaultSource = useAppStore((s) => s.vaultSource);
  const lastSyncedAt = useAppStore((s) => s.lastSyncedAt);
  const lastSyncedCommitSha = useAppStore((s) => s.lastSyncedCommitSha);
  const rateLimit = useAppStore((s) => s.rateLimit);
  const hasPassphraseLock = useAppStore((s) => s.hasPassphraseLock);
  const vaultLocked = useAppStore((s) => s.vaultLocked);
  const runtimeToken = useAppStore((s) => s.runtimeToken);

  const setSettingsOpen = useAppStore((s) => s.setSettingsOpen);
  const setOnboardingOpen = useAppStore((s) => s.setOnboardingOpen);
  const setColorMode = useAppStore((s) => s.setColorMode);
  const setVimMode = useAppStore((s) => s.setVimMode);
  const setShowHiddenFiles = useAppStore((s) => s.setShowHiddenFiles);
  const setIgnorePatterns = useAppStore((s) => s.setIgnorePatterns);
  const setRepoConfig = useAppStore((s) => s.setRepoConfig);
  const setAuthMode = useAppStore((s) => s.setAuthMode);

  const [owner, setOwner] = useState(repoConfig.owner);
  const [repo, setRepo] = useState(repoConfig.repo);
  const [branch, setBranch] = useState(repoConfig.branch);
  const [patternsText, setPatternsText] = useState(ignorePatterns.join('\n'));
  const [savedNotice, setSavedNotice] = useState(false);

  const [storageStats, setStorageStats] = useState<StorageStats | null>(null);
  const [binaryProgress, setBinaryProgress] = useState<SyncProgress | null>(null);
  const [storageNotice, setStorageNotice] = useState<string | null>(null);
  const [newPassphrase, setNewPassphrase] = useState('');
  const [confirmWipe, setConfirmWipe] = useState(false);

  const refreshStats = () => {
    void getVaultStorageStats()
      .then(setStorageStats)
      .catch(() => {});
  };

  useEffect(() => {
    if (open) {
      setOwner(repoConfig.owner);
      setRepo(repoConfig.repo);
      setBranch(repoConfig.branch);
      setPatternsText(ignorePatterns.join('\n'));
      setConfirmWipe(false);
      setStorageNotice(null);
      refreshStats();
    }
  }, [open, repoConfig, ignorePatterns]);

  if (!open) return null;

  const standalone = isStandaloneMode();

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setRepoConfig({
      owner: owner.trim() || 'shakilnwz',
      repo: repo.trim() || 'genforge-lab-knowledgebase',
      branch: branch.trim() || 'main',
    });
    const nextPatterns = patternsText
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean);
    setIgnorePatterns(nextPatterns);
    setSavedNotice(true);
    setTimeout(() => setSavedNotice(false), 1800);
  };

  const resetDefaults = () => {
    setIgnorePatterns(DEFAULT_IGNORE_PATTERNS);
    setPatternsText(DEFAULT_IGNORE_PATTERNS.join('\n'));
  };

  const handleEnablePassphrase = async () => {
    if (!newPassphrase.trim()) return;
    try {
      await enablePassphraseLock(newPassphrase.trim());
      setNewPassphrase('');
      setStorageNotice('Token encrypted at rest with AES-GCM.');
    } catch (err) {
      setStorageNotice(
        err instanceof Error ? err.message : 'Failed to enable passphrase lock.',
      );
    }
  };

  const handleDisablePassphrase = async () => {
    try {
      await disablePassphraseLock();
      setStorageNotice('Passphrase lock removed.');
    } catch (err) {
      setStorageNotice(
        err instanceof Error ? err.message : 'Failed to remove passphrase.',
      );
    }
  };

  const handleRequestPersistence = async () => {
    const granted = await requestVaultPersistence();
    setStorageNotice(
      granted
        ? 'Browser granted persistent offline storage.'
        : 'Browser kept best-effort storage mode.',
    );
    refreshStats();
  };

  const handleDownloadAllBinaries = async () => {
    setStorageNotice(null);
    const res = await downloadAllBinariesOffline((p) => setBinaryProgress(p));
    setBinaryProgress(null);
    setStorageNotice(
      `Downloaded ${res.downloaded} binary asset(s) (${res.skipped} already cached${res.failed ? `, ${res.failed} failed` : ''}).`,
    );
    refreshStats();
  };

  const handleClearBinaries = async () => {
    await clearCachedBinaries();
    setStorageNotice('Binary cache cleared (text notes kept offline).');
    refreshStats();
  };

  const handleForgetAndWipe = async () => {
    await forgetTokenAndWipeCache();
    setConfirmWipe(false);
    setStorageNotice('Credentials forgotten and all IndexedDB/OPFS caches wiped.');
    refreshStats();
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Application Settings"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs"
    >
      <div className="flex max-h-[90vh] w-full max-w-xl flex-col overflow-hidden rounded-3xl bg-[var(--bg-surface)] shadow-2xl">
        <div
          style={{ boxShadow: 'var(--header-shadow)' }}
          className="relative z-10 flex items-center justify-between bg-[var(--bg-surface)] px-5 py-4"
        >
          <h2 className="text-base font-bold text-[var(--text-primary)]">
            Workspace Settings
          </h2>
          <button
            type="button"
            onClick={() => setSettingsOpen(false)}
            aria-label="Close settings"
            className="rounded-xl p-1.5 text-[var(--text-muted)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSave} className="space-y-5 overflow-y-auto p-5 text-xs">
          <section className="space-y-3">
            <h3 className="font-semibold tracking-wide text-[var(--text-muted)] uppercase">
              Appearance
            </h3>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              {COLOR_MODES.map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setColorMode(mode)}
                  aria-pressed={colorMode === mode}
                  className={`flex items-center justify-center gap-1.5 rounded-xl px-3 py-2.5 text-[11px] font-bold transition-all shadow-xs ${
                    colorMode === mode
                      ? 'bg-[var(--button-primary-bg)] text-[var(--button-primary-fg)]'
                      : 'bg-[var(--bg-canvas)] text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]'
                  }`}
                >
                  <Palette className="h-3.5 w-3.5 shrink-0" />
                  <span>{COLOR_MODE_LABELS[mode]}</span>
                </button>
              ))}
            </div>
          </section>

          <section className="space-y-3">
            <h3 className="font-semibold tracking-wide text-[var(--text-muted)] uppercase">
              Repository & Authentication
            </h3>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <label className="block">
                <span className="mb-1 block text-[var(--text-muted)]">Owner</span>
                <input
                  type="text"
                  value={owner}
                  onChange={(e) => setOwner(e.target.value)}
                  className="w-full rounded-xl bg-[var(--bg-canvas)] px-3 py-2 text-[var(--text-primary)] shadow-xs focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)]"
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-[var(--text-muted)]">Repository</span>
                <input
                  type="text"
                  value={repo}
                  onChange={(e) => setRepo(e.target.value)}
                  className="w-full rounded-xl bg-[var(--bg-canvas)] px-3 py-2 text-[var(--text-primary)] shadow-xs focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)]"
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-[var(--text-muted)]">Branch</span>
                <input
                  type="text"
                  value={branch}
                  onChange={(e) => setBranch(e.target.value)}
                  className="w-full rounded-xl bg-[var(--bg-canvas)] px-3 py-2 text-[var(--text-primary)] shadow-xs focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)]"
                />
              </label>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-[var(--bg-canvas)] p-3.5 shadow-xs">
              <div className="space-y-1">
                <span className="block font-medium text-[var(--text-primary)]">
                  Auth Strategy & Sync Status
                </span>
                <span className="block text-[11px] text-[var(--text-muted)]">
                  {vaultSource === 'local-fs'
                    ? 'Source: Local Folder (File System Access)'
                    : authSession
                      ? `Signed in as @${authSession.user}${lastSyncedCommitSha ? ` · Commit ${lastSyncedCommitSha.slice(0, 7)}` : ''}`
                      : 'Push-access required on target repository'}
                </span>
                {(lastSyncedAt || rateLimit) && (
                  <span className="block text-[11px] text-[var(--text-muted)]">
                    Last sync: {formatTimestamp(lastSyncedAt)}
                    {rateLimit
                      ? ` · Rate limit: ${rateLimit.remaining}/${rateLimit.limit}`
                      : ''}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <select
                  aria-label="Auth mode"
                  value={authMode}
                  onChange={(e) => setAuthMode(e.target.value as AuthMode)}
                  className="rounded-xl bg-[var(--bg-surface)] px-2.5 py-1.5 text-[var(--text-primary)] shadow-xs focus:outline-none"
                >
                  <option value="github-oauth">GitHub OAuth (Free)</option>
                  <option value="pat">Fine-Grained PAT</option>
                  <option value="local-fs">Local Folder (Desktop)</option>
                </select>
              </div>
            </div>

            {vaultSource === 'github' && (
              <div className="space-y-2 rounded-2xl bg-[var(--bg-canvas)] p-3.5 shadow-xs">
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1.5 font-medium text-[var(--text-primary)]">
                    <Lock className="h-3.5 w-3.5 text-[var(--accent-primary)]" />
                    Passphrase Encryption (AES-GCM)
                  </span>
                  <span className="rounded-lg bg-[var(--bg-elevated)] px-2 py-0.5 text-[10px] text-[var(--text-secondary)]">
                    {hasPassphraseLock
                      ? vaultLocked
                        ? 'Locked'
                        : 'Unlocked (Protected)'
                      : 'Off'}
                  </span>
                </div>

                {hasPassphraseLock ? (
                  <div className="flex flex-wrap gap-2">
                    {vaultLocked ? (
                      <button
                        type="button"
                        onClick={() => {
                          setSettingsOpen(false);
                          setOnboardingOpen(true);
                        }}
                        className="inline-flex items-center gap-1 rounded-xl bg-amber-500/15 px-3 py-1.5 font-semibold text-amber-300 hover:bg-amber-500/25"
                      >
                        <Unlock className="h-3 w-3" /> Unlock Vault
                      </button>
                    ) : (
                      <>
                        <button
                          type="button"
                          onClick={() => lockVaultNow()}
                          className="inline-flex items-center gap-1 rounded-xl bg-[var(--bg-elevated)] px-3 py-1.5 text-[var(--text-primary)] hover:bg-[var(--bg-hover)]"
                        >
                          <Lock className="h-3 w-3" /> Lock Now
                        </button>
                        <button
                          type="button"
                          onClick={() => void handleDisablePassphrase()}
                          className="inline-flex items-center gap-1 rounded-xl bg-[var(--bg-elevated)] px-3 py-1.5 text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                        >
                          Remove Passphrase
                        </button>
                      </>
                    )}
                  </div>
                ) : (
                  runtimeToken && (
                    <div className="flex gap-2">
                      <input
                        type="password"
                        value={newPassphrase}
                        onChange={(e) => setNewPassphrase(e.target.value)}
                        placeholder="Set local passphrase to encrypt token..."
                        className="min-w-0 flex-1 rounded-xl bg-[var(--bg-surface)] px-3 py-1.5 text-[var(--text-primary)] shadow-xs focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)]"
                      />
                      <button
                        type="button"
                        onClick={() => void handleEnablePassphrase()}
                        className="rounded-xl bg-[var(--bg-hover)] px-3 py-1.5 font-semibold text-[var(--accent-primary)] hover:opacity-90"
                      >
                        Encrypt Token
                      </button>
                    </div>
                  )
                )}
              </div>
            )}
          </section>

          <section className="space-y-2.5">
            <h3 className="flex items-center gap-1.5 font-semibold tracking-wide text-[var(--text-muted)] uppercase">
              <Database className="h-3.5 w-3.5 text-[var(--accent-primary)]" />
              <span>Offline Storage Manager</span>
            </h3>

            <div className="space-y-3 rounded-2xl bg-[var(--bg-canvas)] p-3.5 shadow-xs">
              {storageStats ? (
                <dl className="grid grid-cols-2 gap-2 text-[11px] sm:grid-cols-3">
                  <div>
                    <dt className="text-[var(--text-muted)]">Indexed Text Notes</dt>
                    <dd className="font-semibold tabular-nums text-[var(--text-primary)]">
                      {storageStats.cachedTextCount} / {storageStats.textFileCount}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[var(--text-muted)]">Cached Binaries</dt>
                    <dd className="font-semibold tabular-nums text-[var(--text-primary)]">
                      {storageStats.cachedBinaryCount} / {storageStats.binaryFileCount} (
                      {formatBytes(storageStats.cachedBinaryBytes)})
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[var(--text-muted)]">Binary Backend</dt>
                    <dd className="font-mono font-semibold text-[var(--accent-primary)] uppercase">
                      {storageStats.binaryBackend}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[var(--text-muted)]">Storage Used / Quota</dt>
                    <dd className="font-semibold tabular-nums text-[var(--text-primary)]">
                      {formatBytes(storageStats.usage)}
                      {storageStats.quota > 0
                        ? ` / ${formatBytes(storageStats.quota)}`
                        : ''}
                    </dd>
                  </div>
                  <div className="col-span-2 flex items-center justify-between">
                    <span className="text-[var(--text-muted)]">
                      Persistence:{' '}
                      <strong className="text-[var(--text-primary)]">
                        {storageStats.persisted ? 'Persistent' : 'Best-Effort'}
                      </strong>
                    </span>
                    {!storageStats.persisted && (
                      <button
                        type="button"
                        onClick={() => void handleRequestPersistence()}
                        className="text-[var(--accent-primary)] hover:underline"
                      >
                        Request Persistence
                      </button>
                    )}
                  </div>
                </dl>
              ) : (
                <div className="text-[11px] text-[var(--text-muted)]">
                  Inspecting IndexedDB & OPFS storage...
                </div>
              )}

              {binaryProgress && (
                <div className="text-[11px] text-[var(--accent-primary)]">
                  Caching binaries ({binaryProgress.done}/{binaryProgress.total})
                  {binaryProgress.currentPath ? ` — ${binaryProgress.currentPath}` : ''}
                </div>
              )}

              {storageNotice && (
                <div className="rounded-xl bg-[var(--bg-surface)] px-3 py-2 text-[11px] text-[var(--text-secondary)] shadow-xs">
                  {storageNotice}
                </div>
              )}

              <div className="flex flex-wrap gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => void handleDownloadAllBinaries()}
                  disabled={vaultSource === 'preview' || Boolean(binaryProgress)}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-[var(--bg-surface)] px-3 py-1.5 text-[11px] font-medium text-[var(--text-primary)] shadow-xs hover:bg-[var(--bg-hover)] disabled:opacity-50"
                >
                  <Download className="h-3 w-3 text-[var(--accent-primary)]" />
                  <span>Download All Binaries Offline</span>
                </button>

                <button
                  type="button"
                  onClick={() => void handleClearBinaries()}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-[var(--bg-surface)] px-3 py-1.5 text-[11px] font-medium text-[var(--text-secondary)] shadow-xs hover:text-[var(--text-primary)]"
                >
                  <Trash2 className="h-3 w-3" />
                  <span>Clear Binary Cache</span>
                </button>

                {!confirmWipe ? (
                  <button
                    type="button"
                    onClick={() => setConfirmWipe(true)}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-rose-500/15 px-3 py-1.5 text-[11px] font-medium text-rose-300 hover:bg-rose-500/25"
                  >
                    <ShieldAlert className="h-3 w-3" />
                    <span>Forget Token & Wipe Local Cache</span>
                  </button>
                ) : (
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => void handleForgetAndWipe()}
                      className="rounded-xl bg-rose-500 px-3 py-1.5 text-[11px] font-bold text-white hover:bg-rose-600"
                    >
                      Confirm Wipe Everything
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmWipe(false)}
                      className="rounded-xl bg-[var(--bg-surface)] px-2.5 py-1.5 text-[11px] text-[var(--text-muted)]"
                    >
                      Cancel
                    </button>
                  </div>
                )}
              </div>
            </div>
          </section>

          <section className="space-y-2.5">
            <h3 className="font-semibold tracking-wide text-[var(--text-muted)] uppercase">
              Editor & Vault Tree
            </h3>

            <label className="flex cursor-pointer items-center justify-between rounded-2xl bg-[var(--bg-canvas)] px-3.5 py-3 shadow-xs">
              <span>
                <span className="block font-medium text-[var(--text-primary)]">
                  Vim Mode in Editor
                </span>
                <span className="block text-[11px] text-[var(--text-muted)]">
                  Mirrors .obsidian/app.json vimMode: true
                </span>
              </span>
              <input
                type="checkbox"
                checked={vimMode}
                onChange={(e) => setVimMode(e.target.checked)}
                className="h-4 w-4 accent-[var(--accent-primary)]"
              />
            </label>

            <label className="flex cursor-pointer items-center justify-between rounded-2xl bg-[var(--bg-canvas)] px-3.5 py-3 shadow-xs">
              <span>
                <span className="block font-medium text-[var(--text-primary)]">
                  Show hidden & ignored files
                </span>
                <span className="block text-[11px] text-[var(--text-muted)]">
                  Exposes .obsidian/, .ai/, app/, .venv/, stores/ in file tree
                </span>
              </span>
              <input
                type="checkbox"
                checked={showHiddenFiles}
                onChange={(e) => setShowHiddenFiles(e.target.checked)}
                className="h-4 w-4 accent-[var(--accent-primary)]"
              />
            </label>

            <div>
              <div className="mb-1 flex items-center justify-between">
                <span className="text-[var(--text-muted)]">
                  Ignore Patterns (one per line)
                </span>
                <button
                  type="button"
                  onClick={resetDefaults}
                  className="inline-flex items-center gap-1 text-[11px] text-[var(--accent-primary)] hover:underline"
                >
                  <RotateCcw className="h-3 w-3" />
                  Reset defaults
                </button>
              </div>
              <textarea
                rows={4}
                value={patternsText}
                onChange={(e) => setPatternsText(e.target.value)}
                className="w-full rounded-xl bg-[var(--bg-canvas)] p-2.5 font-mono text-[11px] text-[var(--text-primary)] shadow-xs focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)]"
              />
            </div>
          </section>

          <section className="rounded-2xl bg-[var(--bg-canvas)] p-3.5 text-[11px] text-[var(--text-muted)] shadow-xs">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-[var(--text-secondary)]">
                PWA Runtime Mode
              </span>
              <span className="rounded-lg bg-[var(--bg-elevated)] px-2.5 py-0.5 text-[var(--accent-primary)]">
                {standalone ? 'Installed Standalone' : 'Browser Tab'}
              </span>
            </div>
          </section>

          <div className="flex items-center justify-between pt-3">
            <span className="text-[var(--accent-success)]">
              {savedNotice && (
                <span className="inline-flex items-center gap-1">
                  <Check className="h-3.5 w-3.5" /> Settings saved
                </span>
              )}
            </span>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setSettingsOpen(false)}
                className="rounded-xl bg-[var(--bg-canvas)] px-3.5 py-2 font-medium text-[var(--text-secondary)] shadow-xs hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]"
              >
                Close
              </button>
              <button
                type="submit"
                className="key-depth rounded-xl bg-[var(--button-primary-bg)] px-4 py-2 font-bold text-[var(--button-primary-fg)] hover:opacity-90"
              >
                Save Changes
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
