import {
  AlertTriangle,
  ChevronRight,
  FolderOpen,
  Home,
  Lock,
  Menu,
  Monitor,
  Moon,
  Network,
  PanelRight,
  Radar,
  RefreshCw,
  Search,
  Settings,
  ShieldCheck,
  Sun,
  UploadCloud,
  WifiOff,
} from 'lucide-react';
import { formatTimestamp } from '@/shared/lib/format';
import { syncNow } from '@/features/vault/lib/vaultService';
import { useAppStore } from '@/shared/store/useAppStore';
import type { ThemeMode } from '@/features/vault/types/vault';

interface TopBarProps {
  onOpenMobileDrawer: () => void;
  onFocusSearch: () => void;
  onToggleInspector?: () => void;
}

const THEME_LABELS: Record<ThemeMode, string> = {
  dark: 'Dark',
  light: 'Light',
  system: 'System',
};

const NEXT_THEME: Record<ThemeMode, ThemeMode> = {
  dark: 'light',
  light: 'system',
  system: 'dark',
};

function ThemeIcon({ mode }: { mode: ThemeMode }) {
  if (mode === 'light') return <Sun className="h-4 w-4 text-[var(--accent-primary)]" />;
  if (mode === 'system')
    return <Monitor className="h-4 w-4 text-[var(--accent-secondary)]" />;
  return <Moon className="h-4 w-4 text-[var(--accent-primary)]" />;
}

export function TopBar({
  onOpenMobileDrawer,
  onFocusSearch,
  onToggleInspector,
}: TopBarProps) {
  const theme = useAppStore((s) => s.theme);
  const activePath = useAppStore((s) => s.activePath);
  const authSession = useAppStore((s) => s.authSession);
  const inspectorOpen = useAppStore((s) => s.inspectorOpen);
  const vaultSource = useAppStore((s) => s.vaultSource);
  const vaultLocked = useAppStore((s) => s.vaultLocked);
  const localFolderName = useAppStore((s) => s.localFolderName);
  const isOnline = useAppStore((s) => s.isOnline);
  const syncState = useAppStore((s) => s.syncState);
  const lastSyncedAt = useAppStore((s) => s.lastSyncedAt);
  const lastSyncedCommitSha = useAppStore((s) => s.lastSyncedCommitSha);
  const rateLimit = useAppStore((s) => s.rateLimit);
  const outboxEdits = useAppStore((s) => s.outboxEdits);
  const stageView = useAppStore((s) => s.stageView);

  const setTheme = useAppStore((s) => s.setTheme);
  const toggleSidebar = useAppStore((s) => s.toggleSidebar);
  const toggleInspector = useAppStore((s) => s.toggleInspector);
  const setActivePath = useAppStore((s) => s.setActivePath);
  const setOnboardingOpen = useAppStore((s) => s.setOnboardingOpen);
  const setSettingsOpen = useAppStore((s) => s.setSettingsOpen);
  const setStageView = useAppStore((s) => s.setStageView);
  const setConflictModalOpen = useAppStore((s) => s.setConflictModalOpen);

  const conflictCount = outboxEdits.filter((e) => e.status === 'conflict').length;

  const pathSegments = activePath ? activePath.split('/') : [];

  const syncTooltip = [
    lastSyncedAt ? `Last synced: ${formatTimestamp(lastSyncedAt)}` : 'Not synced yet',
    lastSyncedCommitSha ? `Commit: ${lastSyncedCommitSha.slice(0, 7)}` : null,
    rateLimit ? `API quota: ${rateLimit.remaining}/${rateLimit.limit}` : null,
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <header className="pt-safe flex h-13 shrink-0 items-center justify-between gap-2 border-b border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3">
      <div className="flex min-w-0 items-center gap-2">
        <button
          type="button"
          onClick={onOpenMobileDrawer}
          aria-label="Open vault navigation"
          className="inline-flex h-8 w-8 items-center justify-center rounded-md text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)] lg:hidden"
        >
          <Menu className="h-4 w-4" />
        </button>

        <button
          type="button"
          onClick={toggleSidebar}
          aria-label="Toggle sidebar"
          title="Toggle sidebar (Ctrl/Cmd+\)"
          className="hidden h-8 w-8 items-center justify-center rounded-md text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)] lg:inline-flex"
        >
          <Menu className="h-4 w-4" />
        </button>

        <nav aria-label="Breadcrumb" className="flex min-w-0 items-center gap-1 text-sm">
          <button
            type="button"
            onClick={() => setActivePath(null)}
            className="flex items-center gap-1.5 rounded px-1.5 py-0.5 font-semibold text-[var(--text-primary)] hover:bg-[var(--bg-hover)]"
          >
            <Home className="h-3.5 w-3.5 text-[var(--accent-primary)]" />
            <span className="hidden sm:inline">GenForge KB</span>
          </button>

          {pathSegments.map((seg, idx) => {
            const isLast = idx === pathSegments.length - 1;
            return (
              <span key={`${seg}-${idx}`} className="flex min-w-0 items-center gap-1">
                <ChevronRight className="h-3.5 w-3.5 shrink-0 text-[var(--text-muted)]" />
                <span
                  className={`truncate ${
                    isLast
                      ? 'font-medium text-[var(--text-primary)]'
                      : 'hidden text-[var(--text-muted)] md:inline'
                  }`}
                >
                  {seg}
                </span>
              </span>
            );
          })}
        </nav>
      </div>

      <div className="flex shrink-0 items-center gap-1.5">
        {!isOnline && (
          <span
            title="Network offline — cached notes & assets stay readable"
            className="inline-flex items-center gap-1 rounded-full border border-amber-500/40 bg-amber-500/10 px-2 py-1 text-[11px] font-medium text-amber-300"
          >
            <WifiOff className="h-3 w-3" />
            <span className="hidden sm:inline">Offline</span>
          </span>
        )}

        <button
          type="button"
          onClick={onFocusSearch}
          aria-label="Open global search"
          className="inline-flex h-8 items-center gap-2 rounded-md border border-[var(--border-subtle)] bg-[var(--bg-canvas)] px-2 sm:px-2.5 py-1 text-xs text-[var(--text-muted)] hover:border-[var(--accent-primary)]/50 hover:text-[var(--text-primary)]"
        >
          <Search className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Search</span>
          <kbd className="hidden sm:inline rounded bg-[var(--bg-elevated)] px-1 text-[10px]">⌘K</kbd>
        </button>

        {outboxEdits.length > 0 && (
          <button
            type="button"
            onClick={() => {
              if (conflictCount > 0) {
                setConflictModalOpen(true);
              } else {
                void syncNow().catch(() => {});
              }
            }}
            data-testid="outbox-status-badge"
            className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-semibold ${
              conflictCount > 0
                ? 'border-rose-500/50 bg-rose-500/15 text-rose-300 hover:bg-rose-500/25'
                : 'border-amber-500/40 bg-amber-500/10 text-amber-300 hover:bg-amber-500/20'
            }`}
          >
            {conflictCount > 0 ? (
              <AlertTriangle className="h-3 w-3" />
            ) : (
              <UploadCloud className="h-3 w-3" />
            )}
            <span>
              {conflictCount > 0
                ? `${conflictCount} conflict${conflictCount === 1 ? '' : 's'}`
                : `${outboxEdits.length} unsynced`}
            </span>
          </button>
        )}

        <button
          type="button"
          onClick={() => setStageView(stageView === 'graph' ? 'document' : 'graph')}
          aria-label="Toggle graph view"
          aria-pressed={stageView === 'graph'}
          title="Knowledge Graph View"
          className={`inline-flex h-8 w-8 items-center justify-center rounded-md transition-colors ${
            stageView === 'graph'
              ? 'bg-[var(--accent-primary)]/15 text-[var(--accent-primary)]'
              : 'text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]'
          }`}
        >
          <Network className="h-4 w-4" />
        </button>

        <button
          type="button"
          onClick={() => setStageView(stageView === 'radar' ? 'document' : 'radar')}
          aria-label="Toggle radar chart view"
          aria-pressed={stageView === 'radar'}
          title="Interactive Radar & Studio"
          className={`inline-flex h-8 w-8 items-center justify-center rounded-md transition-colors ${
            stageView === 'radar'
              ? 'bg-[var(--accent-primary)]/15 text-[var(--accent-primary)]'
              : 'text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]'
          }`}
        >
          <Radar className="h-4 w-4" />
        </button>

        {vaultLocked ? (
          <button
            type="button"
            onClick={() => setOnboardingOpen(true)}
            aria-label="Unlock vault passphrase"
            className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/40 bg-amber-500/10 px-2.5 py-1 text-xs font-medium text-amber-300 hover:bg-amber-500/20"
          >
            <Lock className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Unlock Vault</span>
          </button>
        ) : (
          vaultSource !== 'preview' && (
            <button
              type="button"
              onClick={() => void syncNow().catch(() => {})}
              disabled={syncState === 'syncing' || (!isOnline && vaultSource === 'github')}
              aria-label="Sync now"
              title={syncTooltip}
              className="inline-flex h-8 items-center gap-1.5 rounded-md border border-[var(--border-subtle)] bg-[var(--bg-canvas)] px-2.5 text-xs font-medium text-[var(--text-secondary)] hover:border-[var(--accent-primary)]/50 hover:text-[var(--text-primary)] disabled:opacity-50"
            >
              <RefreshCw
                className={`h-3.5 w-3.5 ${syncState === 'syncing' ? 'animate-spin text-[var(--accent-primary)]' : ''}`}
              />
              <span className="hidden md:inline">
                {syncState === 'syncing' ? 'Syncing' : 'Sync'}
              </span>
            </button>
          )
        )}

        <button
          type="button"
          onClick={() => setOnboardingOpen(true)}
          className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors ${
            vaultSource === 'local-fs'
              ? 'border-[var(--accent-primary)]/40 bg-[var(--bg-hover)] text-[var(--accent-primary)]'
              : authSession
                ? 'border-[var(--accent-primary)]/40 bg-[var(--bg-hover)] text-[var(--accent-primary)]'
                : 'border-[var(--border-subtle)] bg-[var(--bg-canvas)] text-[var(--text-secondary)] hover:border-[var(--accent-primary)]/50'
          }`}
        >
          {vaultSource === 'local-fs' ? (
            <FolderOpen className="h-3.5 w-3.5" />
          ) : (
            <ShieldCheck className="h-3.5 w-3.5" />
          )}
          <span className="hidden md:inline">
            {vaultSource === 'local-fs'
              ? localFolderName || 'Local Folder'
              : authSession
                ? `@${authSession.user}`
                : 'Preview Mode'}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setTheme(NEXT_THEME[theme])}
          aria-label={`Switch theme (current: ${THEME_LABELS[theme]})`}
          title={`Theme: ${THEME_LABELS[theme]} (click to switch)`}
          className="inline-flex h-8 items-center gap-1.5 rounded-md border border-[var(--border-subtle)] bg-[var(--bg-canvas)] px-2 text-xs text-[var(--text-secondary)] hover:border-[var(--accent-primary)]/50 hover:text-[var(--text-primary)]"
        >
          <ThemeIcon mode={theme} />
          <span className="hidden xl:inline">{THEME_LABELS[theme]}</span>
        </button>

        <button
          type="button"
          onClick={() => (onToggleInspector ? onToggleInspector() : toggleInspector())}
          aria-label="Toggle inspector"
          aria-pressed={inspectorOpen}
          title="Toggle inspector (Ctrl/Cmd+Shift+\)"
          className="inline-flex h-8 w-8 items-center justify-center rounded-md text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]"
        >
          <PanelRight className="h-4 w-4" />
        </button>

        <button
          type="button"
          onClick={() => setSettingsOpen(true)}
          aria-label="Open settings"
          title="Settings (Ctrl/Cmd+,)"
          className="inline-flex h-8 w-8 items-center justify-center rounded-md text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]"
        >
          <Settings className="h-4 w-4" />
        </button>
      </div>
    </header>
  );
}
