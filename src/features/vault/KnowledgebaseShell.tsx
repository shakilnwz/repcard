import { X } from 'lucide-react';
import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { CommandPaletteModal } from '@/shared/components/CommandPaletteModal';
import { InstallBanner } from '@/shared/components/InstallBanner';

const ConflictModal = lazy(() =>
  import('@/features/vault/components/ConflictModal').then((m) => ({
    default: m.ConflictModal,
  })),
);
import { OnboardingModal } from '@/features/vault/components/OnboardingModal';
import { RightInspector } from '@/features/vault/components/RightInspector';
import { SettingsModal } from '@/features/vault/components/SettingsModal';
import { Sidebar } from '@/features/vault/components/Sidebar';
import { DocumentStage } from '@/features/vault/components/DocumentStage';
import { SwUpdateToast } from '@/shared/components/SwUpdateToast';
import { TopBar } from '@/features/vault/components/TopBar';
import { SAMPLE_VAULT_ENTRIES } from '@/features/vault/lib/sampleVault';
import { applyTheme } from '@/shared/lib/theme';
import {
  connectWithOAuthToken,
  hydrateVaultFromDb,
  syncNow,
} from '@/features/vault/lib/vaultService';
import { useAppStore } from '@/shared/store/useAppStore';
import type { VaultFileEntry } from '@/features/vault/types/vault';

interface KnowledgebaseShellProps {
  entries?: VaultFileEntry[];
}

const FOREGROUND_SYNC_STALE_MS = 30_000;

export function KnowledgebaseShell({ entries }: KnowledgebaseShellProps) {
  const theme = useAppStore((s) => s.theme);
  const sidebarOpen = useAppStore((s) => s.sidebarOpen);
  const inspectorOpen = useAppStore((s) => s.inspectorOpen);
  const vaultSource = useAppStore((s) => s.vaultSource);
  const syncedEntries = useAppStore((s) => s.syncedEntries);

  const toggleSidebar = useAppStore((s) => s.toggleSidebar);
  const toggleInspector = useAppStore((s) => s.toggleInspector);
  const setOnboardingOpen = useAppStore((s) => s.setOnboardingOpen);
  const setSettingsOpen = useAppStore((s) => s.setSettingsOpen);
  const setCommandPaletteOpen = useAppStore((s) => s.setCommandPaletteOpen);
  const setConflictModalOpen = useAppStore((s) => s.setConflictModalOpen);
  const conflictModalOpen = useAppStore((s) => s.conflictModalOpen);
  const setAuthError = useAppStore((s) => s.setAuthError);
  const setIsOnline = useAppStore((s) => s.setIsOnline);
  const navigateBack = useAppStore((s) => s.navigateBack);
  const navigateForward = useAppStore((s) => s.navigateForward);

  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);
  const [mobileInspectorOpen, setMobileInspectorOpen] = useState(false);
  const desktopFilterRef = useRef<HTMLInputElement | null>(null);
  const mobileFilterRef = useRef<HTMLInputElement | null>(null);

  const effectiveEntries =
    entries ?? (vaultSource === 'preview' ? SAMPLE_VAULT_ENTRIES : syncedEntries);

  useEffect(() => {
    return applyTheme(theme);
  }, [theme]);

  // Hydrate offline database & handle GitHub OAuth callback fragment cleanly
  useEffect(() => {
    void hydrateVaultFromDb();

    if (typeof window === 'undefined') return;
    const url = new URL(window.location.href);
    const authErrorParam = url.searchParams.get('auth_error');
    const hashParams = new URLSearchParams(url.hash.replace(/^#/, ''));
    const authToken = hashParams.get('auth_token');
    const authUser = hashParams.get('auth_user');
    const authAvatar = hashParams.get('auth_avatar') || undefined;

    if (authToken && authUser) {
      window.history.replaceState(null, '', url.pathname);
      void connectWithOAuthToken({
        token: authToken,
        user: authUser,
        avatarUrl: authAvatar,
      }).catch((err) => {
        setAuthError(
          err instanceof Error ? err.message : 'GitHub OAuth connection failed.',
        );
      });
    } else if (authErrorParam) {
      setAuthError(authErrorParam);
      setOnboardingOpen(true);
      window.history.replaceState(null, '', url.pathname);
    }
  }, [setAuthError, setOnboardingOpen]);

  // Network & foreground visibility delta sync triggers
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const triggerSilentDeltaSync = () => {
      const s = useAppStore.getState();
      if (s.vaultSource === 'github' && s.runtimeToken && !s.vaultLocked) {
        void syncNow({ silent: true }).catch(() => {});
      }
    };

    const handleOnline = () => {
      setIsOnline(true);
      triggerSilentDeltaSync();
    };

    const handleOffline = () => {
      setIsOnline(false);
    };

    const handleVisibility = () => {
      if (document.visibilityState !== 'visible') return;
      const s = useAppStore.getState();
      const stale =
        !s.lastSyncedAt || Date.now() - s.lastSyncedAt > FOREGROUND_SYNC_STALE_MS;
      if (stale && navigator.onLine !== false) {
        triggerSilentDeltaSync();
      }
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    document.addEventListener('visibilitychange', handleVisibility);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [setIsOnline]);

  // Global keyboard shortcuts
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const inEditable = Boolean(
        target &&
          (target.tagName === 'INPUT' ||
            target.tagName === 'TEXTAREA' ||
            target.isContentEditable),
      );
      const mod = e.metaKey || e.ctrlKey;
      if (mod && e.key === '\\') {
        e.preventDefault();
        if (e.shiftKey) {
          if (window.innerWidth >= 1280) {
            toggleInspector();
          } else {
            setMobileInspectorOpen((o) => !o);
          }
        } else {
          toggleSidebar();
        }
      } else if (mod && e.key === ',') {
        e.preventDefault();
        setSettingsOpen(true);
      } else if (mod && e.shiftKey && e.key.toLowerCase() === 's') {
        e.preventDefault();
        void syncNow().catch(() => {});
      } else if (mod && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setCommandPaletteOpen(true);
      } else if (mod && !e.shiftKey && e.key.toLowerCase() === 'e') {
        const s = useAppStore.getState();
        const entry = (s.vaultSource === 'preview' ? SAMPLE_VAULT_ENTRIES : s.syncedEntries).find(
          (item) => item.path === s.activePath,
        );
        if (s.vaultSource !== 'preview' && entry?.kind === 'markdown') {
          e.preventDefault();
          s.setStageView('document');
          s.setEditorMode(s.editorMode === 'read' ? 'edit' : 'read');
        }
      } else if (!mod && !e.altKey && !inEditable && e.key === '[') {
        e.preventDefault();
        navigateBack();
      } else if (!mod && !e.altKey && !inEditable && e.key === ']') {
        e.preventDefault();
        navigateForward();
      } else if (e.key === 'Escape') {
        setMobileDrawerOpen(false);
        setMobileInspectorOpen(false);
        setOnboardingOpen(false);
        setSettingsOpen(false);
        setCommandPaletteOpen(false);
        setConflictModalOpen(false);
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [
    toggleSidebar,
    toggleInspector,
    setSettingsOpen,
    setOnboardingOpen,
    setCommandPaletteOpen,
    setConflictModalOpen,
    navigateBack,
    navigateForward,
  ]);

  const handleFocusSearch = () => {
    setCommandPaletteOpen(true);
  };

  return (
    <div className="flex h-dvh w-full flex-col overflow-hidden bg-[var(--bg-canvas)] text-[var(--text-primary)]">
      <TopBar
        onOpenMobileDrawer={() => setMobileDrawerOpen(true)}
        onFocusSearch={handleFocusSearch}
        onToggleInspector={() => {
          if (typeof window !== 'undefined' && window.innerWidth >= 1280) {
            toggleInspector();
          } else {
            setMobileInspectorOpen((o) => !o);
          }
        }}
      />

      <InstallBanner />

      <div className="relative flex min-h-0 flex-1 overflow-hidden">
        {sidebarOpen && (
          <aside
            aria-label="Vault sidebar"
            className="hidden h-full w-68 shrink-0 border-r border-[var(--border-subtle)] lg:block"
          >
            <Sidebar entries={effectiveEntries} filterInputRef={desktopFilterRef} />
          </aside>
        )}

        <main className="min-w-0 flex-1 overflow-y-auto">
          <DocumentStage entries={effectiveEntries} />
        </main>

        {inspectorOpen && (
          <div className="hidden h-full w-70 shrink-0 border-l border-[var(--border-subtle)] xl:block">
            <RightInspector entries={effectiveEntries} />
          </div>
        )}

        {mobileDrawerOpen && (
          <div className="fixed inset-0 z-40 flex lg:hidden">
            <div
              className="fixed inset-0 bg-[#0B132B]/75"
              onClick={() => setMobileDrawerOpen(false)}
              aria-hidden="true"
            />
            <div
              role="dialog"
              aria-modal="true"
              aria-label="Vault navigation drawer"
              className="relative z-10 flex h-full w-80 max-w-[85vw] flex-col border-r border-[var(--border-subtle)] bg-[var(--bg-surface)] shadow-2xl"
            >
              <div className="flex items-center justify-between border-b border-[var(--border-subtle)] px-3 py-2.5">
                <span className="text-xs font-semibold tracking-wide text-[var(--text-secondary)] uppercase">
                  Vault Explorer
                </span>
                <button
                  type="button"
                  onClick={() => setMobileDrawerOpen(false)}
                  aria-label="Close vault drawer"
                  className="rounded p-1 text-[var(--text-muted)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="min-h-0 flex-1">
                <Sidebar
                  entries={effectiveEntries}
                  filterInputRef={mobileFilterRef}
                  onSelectFile={() => {
                    setMobileDrawerOpen(false);
                  }}
                />
              </div>
            </div>
          </div>
        )}

        {mobileInspectorOpen && (
          <div className="fixed inset-0 z-40 flex justify-end xl:hidden">
            <div
              className="fixed inset-0 bg-[#0B132B]/75"
              onClick={() => setMobileInspectorOpen(false)}
              aria-hidden="true"
            />
            <div
              role="dialog"
              aria-modal="true"
              aria-label="Document inspector drawer"
              className="relative z-10 flex h-full w-80 max-w-[85vw] flex-col border-l border-[var(--border-subtle)] bg-[var(--bg-surface)] shadow-2xl"
            >
              <div className="flex items-center justify-between border-b border-[var(--border-subtle)] px-3 py-2.5">
                <span className="text-xs font-semibold tracking-wide text-[var(--text-secondary)] uppercase">
                  Document Inspector
                </span>
                <button
                  type="button"
                  onClick={() => setMobileInspectorOpen(false)}
                  aria-label="Close inspector drawer"
                  className="rounded p-1 text-[var(--text-muted)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto">
                <RightInspector entries={effectiveEntries} />
              </div>
            </div>
          </div>
        )}
      </div>

      <OnboardingModal />
      <SettingsModal />
      <CommandPaletteModal />
      {conflictModalOpen && (
        <Suspense fallback={null}>
          <ConflictModal />
        </Suspense>
      )}
      <SwUpdateToast />
    </div>
  );
}

export default KnowledgebaseShell;
