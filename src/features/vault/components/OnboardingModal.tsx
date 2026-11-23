import {
  AlertTriangle,
  CheckCircle2,
  FolderOpen,
  KeyRound,
  Lock,
  ShieldCheck,
  Unlock,
  X,
} from 'lucide-react';
import { useState } from 'react';
import { isLocalFolderSupported } from '@/features/vault/providers/localFsProvider';
import {
  connectLocalFolder,
  connectWithPat,
  forgetTokenAndWipeCache,
  reconnectLocalFolder,
  testPatConnection,
  unlockVaultWithPassphrase,
} from '@/features/vault/lib/vaultService';
import type { ConnectionTestResult } from '@/features/vault/lib/githubApi';
import { useAppStore } from '@/shared/store/useAppStore';

function GitHubMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
      className={className}
    >
      <path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0 1 12 6.844a9.59 9.59 0 0 1 2.504.337c1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.02 10.02 0 0 0 22 12.017C22 6.484 17.522 2 12 2Z" />
    </svg>
  );
}

export function OnboardingModal() {
  const open = useAppStore((s) => s.onboardingOpen);
  const authMode = useAppStore((s) => s.authMode);
  const authError = useAppStore((s) => s.authError);
  const authSession = useAppStore((s) => s.authSession);
  const repoConfig = useAppStore((s) => s.repoConfig);
  const vaultLocked = useAppStore((s) => s.vaultLocked);
  const vaultSource = useAppStore((s) => s.vaultSource);
  const localFolderName = useAppStore((s) => s.localFolderName);
  const syncProgress = useAppStore((s) => s.syncProgress);

  const setOnboardingOpen = useAppStore((s) => s.setOnboardingOpen);
  const setAuthMode = useAppStore((s) => s.setAuthMode);
  const setAuthError = useAppStore((s) => s.setAuthError);
  const setRepoConfig = useAppStore((s) => s.setRepoConfig);

  const [tab, setTab] = useState<'oauth' | 'pat' | 'local'>(
    authMode === 'pat' ? 'pat' : authMode === 'local-fs' ? 'local' : 'oauth',
  );
  const [owner, setOwner] = useState(repoConfig.owner);
  const [repo, setRepo] = useState(repoConfig.repo);
  const [branch, setBranch] = useState(repoConfig.branch);
  const [patInput, setPatInput] = useState('');
  const [passphraseInput, setPassphraseInput] = useState('');
  const [unlockPassphrase, setUnlockPassphrase] = useState('');

  const [busy, setBusy] = useState(false);
  const [testResult, setTestResult] = useState<ConnectionTestResult | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);

  if (!open) return null;

  const localFsSupported = isLocalFolderSupported();

  const buildConfig = () => ({
    owner: owner.trim() || 'shakilnwz',
    repo: repo.trim() || 'genforge-lab-knowledgebase',
    branch: branch.trim() || 'main',
  });

  const handleUnlock = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);
    setBusy(true);
    try {
      await unlockVaultWithPassphrase(unlockPassphrase);
      setUnlockPassphrase('');
      setOnboardingOpen(false);
    } catch (err) {
      setLocalError(
        err instanceof Error ? err.message : 'Failed to unlock vault.',
      );
    } finally {
      setBusy(false);
    }
  };

  const handleTestPat = async () => {
    setLocalError(null);
    setTestResult(null);
    if (!patInput.trim()) {
      setLocalError('Paste a GitHub Fine-Grained PAT first to test access.');
      return;
    }

    setBusy(true);
    try {
      const res = await testPatConnection(buildConfig(), patInput);
      setTestResult(res);
    } catch (err) {
      setLocalError(
        err instanceof Error ? err.message : 'Connection test failed.',
      );
    } finally {
      setBusy(false);
    }
  };

  const handleSavePat = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);
    const nextConfig = buildConfig();

    if (!patInput.trim()) {
      setRepoConfig(nextConfig);
      setAuthMode('pat');
      setOnboardingOpen(false);
      return;
    }

    setBusy(true);
    try {
      await connectWithPat({
        config: nextConfig,
        token: patInput,
        passphrase: passphraseInput.trim() || undefined,
      });
      setPatInput('');
      setPassphraseInput('');
      setTestResult(null);
      setOnboardingOpen(false);
    } catch (err) {
      setLocalError(
        err instanceof Error ? err.message : 'Failed to verify or sync repo.',
      );
    } finally {
      setBusy(false);
    }
  };

  const handlePickLocalFolder = async () => {
    setLocalError(null);
    setBusy(true);
    try {
      await connectLocalFolder();
      setOnboardingOpen(false);
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        return;
      }
      setLocalError(
        err instanceof Error ? err.message : 'Failed to connect local folder.',
      );
    } finally {
      setBusy(false);
    }
  };

  const handleReconnectLocal = async () => {
    setLocalError(null);
    setBusy(true);
    try {
      await reconnectLocalFolder();
      setOnboardingOpen(false);
    } catch (err) {
      setLocalError(
        err instanceof Error ? err.message : 'Failed to reconnect folder.',
      );
    } finally {
      setBusy(false);
    }
  };

  const handleSignOutAndWipe = async () => {
    setBusy(true);
    try {
      await forgetTokenAndWipeCache();
      setTestResult(null);
      setLocalError(null);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Repository Connection & Setup"
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#0B132B]/80 p-4 backdrop-blur-xs"
    >
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] shadow-2xl">
        <div className="flex items-center justify-between border-b border-[var(--border-subtle)] px-5 py-4">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-[var(--accent-primary)]" />
            <h2 className="text-base font-bold text-[var(--text-primary)]">
              Connect Private Repository
            </h2>
          </div>
          <button
            type="button"
            onClick={() => setOnboardingOpen(false)}
            aria-label="Close setup modal"
            className="rounded-md p-1 text-[var(--text-muted)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-4 p-5">
          {vaultLocked && (
            <form
              onSubmit={handleUnlock}
              className="space-y-2.5 rounded-lg border border-amber-500/40 bg-amber-500/10 p-3.5 text-xs"
            >
              <div className="flex items-center gap-2 font-semibold text-amber-300">
                <Lock className="h-4 w-4" />
                <span>Vault Credentials Encrypted (AES-GCM)</span>
              </div>
              <p className="text-amber-200/80">
                Enter your local passphrase to decrypt your GitHub token in memory for syncing.
              </p>
              <div className="flex gap-2">
                <input
                  type="password"
                  value={unlockPassphrase}
                  onChange={(e) => setUnlockPassphrase(e.target.value)}
                  aria-label="Vault passphrase"
                  placeholder="Enter passphrase..."
                  autoFocus
                  className="min-w-0 flex-1 rounded-md border border-amber-500/40 bg-[var(--bg-canvas)] px-2.5 py-1.5 text-xs text-[var(--text-primary)] focus:border-[var(--accent-primary)] focus:outline-none"
                />
                <button
                  type="submit"
                  disabled={busy}
                  className="inline-flex items-center gap-1 rounded-md bg-amber-400 px-3 py-1.5 font-semibold text-slate-950 hover:opacity-90 disabled:opacity-50"
                >
                  <Unlock className="h-3.5 w-3.5" />
                  Unlock Vault
                </button>
              </div>
            </form>
          )}

          {authError && (
            <div className="flex items-start gap-2.5 rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-xs text-amber-300">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <div className="flex-1">
                <p className="font-semibold">Authentication notice: {authError}</p>
                <p className="mt-0.5 text-amber-200/80">
                  {authError === 'push_access_required'
                    ? 'Your GitHub account does not currently have push access on the target repository.'
                    : authError === 'oauth_not_configured'
                      ? 'GitHub OAuth environment variables are not set on this host yet. Use Fine-Grained PAT for local testing, or configure Cloudflare Pages OAuth.'
                      : 'Sign-in could not be completed. Please try again or use a Fine-Grained PAT.'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setAuthError(null)}
                aria-label="Dismiss auth notice"
                className="text-amber-300 hover:text-white"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          )}

          {localError && (
            <div
              role="alert"
              className="flex items-start gap-2 rounded-lg border border-rose-500/40 bg-rose-500/10 p-3 text-xs text-rose-300"
            >
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <span className="flex-1">{localError}</span>
            </div>
          )}

          {(authSession || vaultSource === 'local-fs') && (
            <div className="flex items-center justify-between rounded-lg border border-[var(--accent-primary)]/30 bg-[var(--bg-hover)] px-3 py-2 text-xs text-[var(--accent-primary)]">
              <span>
                {vaultSource === 'local-fs'
                  ? `Local folder: ${localFolderName ?? 'Connected'}`
                  : `Active session: @${authSession?.user}`}
              </span>
              <button
                type="button"
                disabled={busy}
                onClick={() => void handleSignOutAndWipe()}
                className="rounded border border-[var(--accent-primary)]/40 px-2 py-0.5 hover:bg-[var(--accent-primary)]/20 disabled:opacity-50"
              >
                Sign out
              </button>
            </div>
          )}

          <div className="grid grid-cols-3 gap-1.5 rounded-lg bg-[var(--bg-canvas)] p-1">
            <button
              type="button"
              onClick={() => {
                setTab('oauth');
                setLocalError(null);
              }}
              className={`flex items-center justify-center gap-1.5 rounded-md px-2 py-1.5 text-xs font-semibold transition-colors ${
                tab === 'oauth'
                  ? 'bg-[var(--bg-surface)] text-[var(--accent-primary)] shadow-xs'
                  : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
              }`}
            >
              <GitHubMark className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">GitHub OAuth (Free)</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setTab('pat');
                setLocalError(null);
              }}
              className={`flex items-center justify-center gap-1.5 rounded-md px-2 py-1.5 text-xs font-semibold transition-colors ${
                tab === 'pat'
                  ? 'bg-[var(--bg-surface)] text-[var(--accent-primary)] shadow-xs'
                  : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
              }`}
            >
              <KeyRound className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">Fine-Grained PAT</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setTab('local');
                setLocalError(null);
              }}
              className={`flex items-center justify-center gap-1.5 rounded-md px-2 py-1.5 text-xs font-semibold transition-colors ${
                tab === 'local'
                  ? 'bg-[var(--bg-surface)] text-[var(--accent-primary)] shadow-xs'
                  : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
              }`}
            >
              <FolderOpen className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">Local Folder</span>
            </button>
          </div>

          {tab === 'oauth' && (
            <div className="space-y-4">
              <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-canvas)] p-3.5 text-xs leading-relaxed text-[var(--text-secondary)]">
                <p className="font-semibold text-[var(--text-primary)]">
                  Zero-cost collaborator access control ($0 Cloudflare Pages)
                </p>
                <ul className="mt-2 list-disc space-y-1 pl-4 text-[var(--text-muted)]">
                  <li>
                    Authenticates with your GitHub account via{' '}
                    <code className="text-[var(--accent-primary)]">/api/auth/login</code>.
                  </li>
                  <li>
                    Verifies <code className="text-[var(--accent-primary)]">permissions.push === true</code>{' '}
                    on <span className="font-mono">{repoConfig.owner}/{repoConfig.repo}</span>.
                  </li>
                  <li>
                    Syncs delta commits via GitHub Git Data API into IndexedDB & OPFS.
                  </li>
                </ul>
              </div>

              <a
                href="/api/auth/login"
                onClick={() => setAuthMode('github-oauth')}
                className="flex w-full items-center justify-center gap-2 rounded-lg bg-[var(--accent-primary)] px-4 py-2.5 text-sm font-semibold text-[var(--accent-on-primary)] transition-opacity hover:opacity-90"
              >
                <GitHubMark className="h-4 w-4" />
                <span>Sign in with GitHub</span>
              </a>

              <p className="text-center text-[11px] text-[var(--text-muted)]">
                Running on localhost without Wrangler? Use the Fine-Grained PAT or Local Folder tab.
              </p>
            </div>
          )}

          {tab === 'pat' && (
            <form onSubmit={handleSavePat} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <label className="block text-xs">
                  <span className="mb-1 block text-[var(--text-muted)]">Owner</span>
                  <input
                    type="text"
                    value={owner}
                    onChange={(e) => setOwner(e.target.value)}
                    className="w-full rounded-md border border-[var(--border-subtle)] bg-[var(--bg-canvas)] px-2.5 py-1.5 text-xs text-[var(--text-primary)] focus:border-[var(--accent-primary)] focus:outline-none"
                  />
                </label>
                <label className="block text-xs">
                  <span className="mb-1 block text-[var(--text-muted)]">Branch</span>
                  <input
                    type="text"
                    value={branch}
                    onChange={(e) => setBranch(e.target.value)}
                    className="w-full rounded-md border border-[var(--border-subtle)] bg-[var(--bg-canvas)] px-2.5 py-1.5 text-xs text-[var(--text-primary)] focus:border-[var(--accent-primary)] focus:outline-none"
                  />
                </label>
              </div>

              <label className="block text-xs">
                <span className="mb-1 block text-[var(--text-muted)]">Repository Name</span>
                <input
                  type="text"
                  value={repo}
                  onChange={(e) => setRepo(e.target.value)}
                  className="w-full rounded-md border border-[var(--border-subtle)] bg-[var(--bg-canvas)] px-2.5 py-1.5 text-xs text-[var(--text-primary)] focus:border-[var(--accent-primary)] focus:outline-none"
                />
              </label>

              <label className="block text-xs">
                <span className="mb-1 block text-[var(--text-muted)]">
                  GitHub Fine-Grained PAT (Contents: Read & Write)
                </span>
                <input
                  type="password"
                  value={patInput}
                  onChange={(e) => {
                    setPatInput(e.target.value);
                    setTestResult(null);
                  }}
                  placeholder="github_pat_..."
                  autoComplete="off"
                  className="w-full rounded-md border border-[var(--border-subtle)] bg-[var(--bg-canvas)] px-2.5 py-1.5 text-xs text-[var(--text-primary)] focus:border-[var(--accent-primary)] focus:outline-none"
                />
              </label>

              <label className="block text-xs">
                <span className="mb-1 block text-[var(--text-muted)]">
                  Local Passphrase Lock (AES-GCM, optional)
                </span>
                <input
                  type="password"
                  value={passphraseInput}
                  onChange={(e) => setPassphraseInput(e.target.value)}
                  placeholder="Optional passphrase to encrypt token at rest"
                  autoComplete="new-password"
                  className="w-full rounded-md border border-[var(--border-subtle)] bg-[var(--bg-canvas)] px-2.5 py-1.5 text-xs text-[var(--text-primary)] focus:border-[var(--accent-primary)] focus:outline-none"
                />
              </label>

              {testResult && (
                <div className="flex items-start gap-2 rounded-lg border border-[var(--accent-primary)]/40 bg-[var(--bg-hover)] p-2.5 text-xs text-[var(--accent-primary)]">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
                  <div>
                    <div className="font-semibold">
                      Verified @{testResult.user} · Push Access Granted
                    </div>
                    <div className="text-[11px] text-[var(--text-secondary)]">
                      {testResult.fullName} ({testResult.isPrivate ? 'Private' : 'Public'})
                      {testResult.rateLimit
                        ? ` · Quota ${testResult.rateLimit.remaining}/${testResult.rateLimit.limit}`
                        : ''}
                    </div>
                  </div>
                </div>
              )}

              {busy && syncProgress && (
                <div className="text-[11px] text-[var(--accent-primary)]">
                  Syncing {syncProgress.phase} ({syncProgress.done}/{syncProgress.total})
                  {syncProgress.currentPath ? ` — ${syncProgress.currentPath}` : ''}
                </div>
              )}

              <div className="flex flex-wrap items-center justify-between gap-2 pt-2">
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void handleTestPat()}
                  className="rounded-md border border-[var(--border-subtle)] px-3 py-1.5 text-xs font-medium text-[var(--text-secondary)] hover:border-[var(--accent-primary)]/50 hover:text-[var(--text-primary)] disabled:opacity-50"
                >
                  Test Connection
                </button>

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setOnboardingOpen(false)}
                    className="rounded-md border border-[var(--border-subtle)] px-3 py-1.5 text-xs text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={busy}
                    className="rounded-md bg-[var(--accent-primary)] px-4 py-1.5 text-xs font-semibold text-[var(--accent-on-primary)] hover:opacity-90 disabled:opacity-50"
                  >
                    {busy
                      ? 'Syncing Vault...'
                      : patInput.trim()
                        ? 'Verify & Sync'
                        : 'Save Configuration'}
                  </button>
                </div>
              </div>
            </form>
          )}

          {tab === 'local' && (
            <div className="space-y-4">
              {localFsSupported ? (
                <>
                  <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-canvas)] p-3.5 text-xs leading-relaxed text-[var(--text-secondary)]">
                    <p className="font-semibold text-[var(--text-primary)]">
                      Desktop Chromium Local Folder Mode
                    </p>
                    <p className="mt-1 text-[var(--text-muted)]">
                      Select your local <span className="font-mono">genforge-lab-knowledgebase</span> checkout directly from disk via the File System Access API (<code className="text-[var(--accent-primary)]">showDirectoryPicker</code>) with zero API quota usage.
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void handlePickLocalFolder()}
                      className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-[var(--accent-primary)] px-4 py-2.5 text-xs font-semibold text-[var(--accent-on-primary)] hover:opacity-90 disabled:opacity-50"
                    >
                      <FolderOpen className="h-4 w-4" />
                      <span>
                        {busy ? 'Indexing Folder...' : 'Choose Local Vault Folder'}
                      </span>
                    </button>

                    {vaultSource === 'local-fs' && localFolderName && (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => void handleReconnectLocal()}
                        className="rounded-lg border border-[var(--border-subtle)] px-3 py-2 text-xs font-medium text-[var(--text-primary)] hover:bg-[var(--bg-hover)] disabled:opacity-50"
                      >
                        Re-index {localFolderName}
                      </button>
                    )}
                  </div>
                </>
              ) : (
                <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-4 text-xs text-amber-200">
                  <p className="font-semibold text-amber-300">
                    Local Folder Picker Unsupported in This Browser
                  </p>
                  <p className="mt-1.5 leading-relaxed text-amber-200/80">
                    <code>window.showDirectoryPicker()</code> is only supported on Desktop Chromium browsers (Chrome, Brave, Edge, Opera). On Firefox, Safari, Android, and iOS, connect via <strong>GitHub OAuth (Free)</strong> or <strong>Fine-Grained PAT</strong> for full offline storage.
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
