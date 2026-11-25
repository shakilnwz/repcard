import {
  AlertTriangle,
  ArrowLeft,
  ChevronRight,
  FolderOpen,
  FolderTree,
  Home,
  Lock,
  Menu,
  Network,
  Palette,
  PanelRight,
  Radar,
  RefreshCw,
  Search,
  Settings,
  ShieldCheck,
  UploadCloud,
  WifiOff,
} from '@/shared/ui/MaterialIcons';
import { formatTimestamp } from '@/shared/lib/format';
import { COLOR_MODE_LABELS } from '@/shared/lib/theme';
import { syncNow } from '@/features/vault/lib/vaultService';
import { useAppStore } from '@/shared/store/useAppStore';

interface TopBarProps {
  onOpenMobileDrawer: () => void;
  onFocusSearch: () => void;
  onToggleInspector?: () => void;
}

export function TopBar({
  onOpenMobileDrawer,
  onFocusSearch,
  onToggleInspector,
}: TopBarProps) {
  const colorMode = useAppStore((s) => s.colorMode);
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

  const cycleColorMode = useAppStore((s) => s.cycleColorMode);
  const toggleSidebar = useAppStore((s) => s.toggleSidebar);
  const toggleInspector = useAppStore((s) => s.toggleInspector);
  const setActivePath = useAppStore((s) => s.setActivePath);
  const setOnboardingOpen = useAppStore((s) => s.setOnboardingOpen);
  const setSettingsOpen = useAppStore((s) => s.setSettingsOpen);
  const setStageView = useAppStore((s) => s.setStageView);
  const setConflictModalOpen = useAppStore((s) => s.setConflictModalOpen);

  const conflictCount = outboxEdits.filter((e) => e.status === 'conflict').length;

  const pathSegments = activePath ? activePath.split('/') : [];
  const activeFileName = pathSegments.length > 0 ? pathSegments[pathSegments.length - 1] : null;
  const mobileTitle =
    stageView === 'graph' ? 'Graph' : stageView === 'radar' ? 'Radar' : 'Docs';
  const showMobileInspector = stageView === 'document' && Boolean(activePath);

  const syncTooltip = [
    lastSyncedAt ? `Last synced: ${formatTimestamp(lastSyncedAt)}` : 'Not synced yet',
    lastSyncedCommitSha ? `Commit: ${lastSyncedCommitSha.slice(0, 7)}` : null,
    rateLimit ? `API quota: ${rateLimit.remaining}/${rateLimit.limit}` : null,
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <header className="relative z-20 flex shrink-0 items-center justify-between gap-2 bg-[var(--bg-canvas)] px-4 pt-[max(0.75rem,env(safe-area-inset-top))] pb-2 lg:h-13 lg:bg-[var(--bg-surface)] lg:px-3 lg:pt-[env(safe-area-inset-top,0px)] lg:pb-0 lg:shadow-[var(--header-shadow)]">
      {/* Mobile Left: Cards-philosophy bold display header or compact back + filename */}
      <div className="flex min-w-0 flex-1 items-center gap-1.5 lg:hidden">
        {stageView === 'document' && activeFileName ? (
          <>
            <button
              type="button"
              onClick={() => setActivePath(null)}
              aria-label="Back to docs overview"
              className="-ml-2 inline-flex min-h-[44px] min-w-[44px] shrink-0 items-center justify-center rounded-xl text-[var(--fg-app)] opacity-85 transition-all hover:opacity-100 active:scale-90"
            >
              <ArrowLeft className="h-6 w-6" />
            </button>
            <span className="min-w-0 truncate text-lg font-bold tracking-tight text-[var(--fg-app)] select-none">
              {activeFileName}
            </span>
          </>
        ) : (
          <span className="text-3xl font-bold tracking-tight text-[var(--fg-app)] select-none">
            {mobileTitle}
          </span>
        )}
      </div>

      {/* Desktop Left: Sidebar toggle + Breadcrumb */}
      <div className="hidden min-w-0 items-center gap-2 lg:flex">
        <button
          type="button"
          onClick={toggleSidebar}
          aria-label="Toggle sidebar"
          title="Toggle sidebar (Ctrl/Cmd+\)"
          className="inline-flex h-8 w-8 items-center justify-center rounded-xl text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]"
        >
          <Menu className="h-4 w-4" />
        </button>

        <nav aria-label="Breadcrumb" className="flex min-w-0 items-center gap-1 text-sm">
          <button
            type="button"
            onClick={() => setActivePath(null)}
            className="flex items-center gap-1.5 rounded-xl px-2 py-1 font-bold text-[var(--text-primary)] hover:bg-[var(--bg-hover)]"
          >
            <Home className="h-3.5 w-3.5 text-[var(--accent-primary)]" />
            <span>RepCard</span>
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
                      : 'text-[var(--text-muted)]'
                  }`}
                >
                  {seg}
                </span>
              </span>
            );
          })}
        </nav>
      </div>

      {/* Right Actions: single button per action so aria-labels remain unique */}
      <div className="flex shrink-0 items-center gap-0.5 lg:gap-1.5">
        {!isOnline && (
          <span
            title="Network offline — cached notes & assets stay readable"
            className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-2 py-1 text-[11px] font-medium text-amber-300"
          >
            <WifiOff className="h-3 w-3" />
            <span className="hidden sm:inline">Offline</span>
          </span>
        )}

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
            className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold shadow-xs ${
              conflictCount > 0
                ? 'bg-rose-500/20 text-rose-300 hover:bg-rose-500/30'
                : 'bg-amber-500/15 text-amber-300 hover:bg-amber-500/25'
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

        {vaultLocked && (
          <button
            type="button"
            onClick={() => setOnboardingOpen(true)}
            aria-label="Unlock vault passphrase"
            className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/15 px-2.5 py-1 text-xs font-medium text-amber-300 hover:bg-amber-500/25"
          >
            <Lock className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Unlock Vault</span>
          </button>
        )}

        <button
          type="button"
          onClick={onOpenMobileDrawer}
          aria-label="Open vault navigation"
          title="Vault Explorer"
          className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl text-[var(--fg-app)] opacity-85 transition-all hover:opacity-100 active:scale-90 lg:hidden"
        >
          <FolderTree className="h-6 w-6" />
        </button>

        <button
          type="button"
          onClick={onFocusSearch}
          aria-label="Open global search"
          className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl text-[var(--fg-app)] opacity-85 transition-all hover:opacity-100 active:scale-90 lg:min-h-0 lg:min-w-0 lg:h-8 lg:gap-2 lg:bg-[var(--bg-canvas)] lg:px-2.5 lg:py-1 lg:text-xs lg:text-[var(--text-muted)] lg:opacity-100 lg:shadow-xs lg:hover:bg-[var(--bg-hover)] lg:hover:text-[var(--text-primary)] lg:active:scale-100"
        >
          <Search className="h-6 w-6 lg:h-3.5 lg:w-3.5" />
          <span className="hidden lg:inline">Search</span>
          <kbd className="hidden lg:inline rounded-md bg-[var(--bg-elevated)] px-1 text-[10px]">⌘K</kbd>
        </button>

        <button
          type="button"
          onClick={() => setStageView(stageView === 'graph' ? 'document' : 'graph')}
          aria-label="Toggle graph view"
          aria-pressed={stageView === 'graph'}
          title="Knowledge Graph View"
          className={`hidden lg:inline-flex h-8 w-8 items-center justify-center rounded-xl transition-colors ${
            stageView === 'graph'
              ? 'bg-[var(--button-primary-bg)] text-[var(--button-primary-fg)]'
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
          className={`hidden lg:inline-flex h-8 w-8 items-center justify-center rounded-xl transition-colors ${
            stageView === 'radar'
              ? 'bg-[var(--button-primary-bg)] text-[var(--button-primary-fg)]'
              : 'text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]'
          }`}
        >
          <Radar className="h-4 w-4" />
        </button>

        {!vaultLocked && vaultSource !== 'preview' && (
          <button
            type="button"
            onClick={() => void syncNow().catch(() => {})}
            disabled={syncState === 'syncing' || (!isOnline && vaultSource === 'github')}
            aria-label="Sync now"
            title={syncTooltip}
            className="hidden lg:inline-flex h-8 items-center gap-1.5 rounded-xl bg-[var(--bg-canvas)] px-2.5 text-xs font-medium text-[var(--text-secondary)] shadow-xs hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)] disabled:opacity-50"
          >
            <RefreshCw
              className={`h-3.5 w-3.5 ${syncState === 'syncing' ? 'animate-spin text-[var(--accent-primary)]' : ''}`}
            />
            <span>{syncState === 'syncing' ? 'Syncing' : 'Sync'}</span>
          </button>
        )}

        <button
          type="button"
          onClick={() => setOnboardingOpen(true)}
          className={`hidden lg:inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium shadow-xs transition-colors ${
            vaultSource === 'local-fs'
              ? 'bg-[var(--bg-hover)] text-[var(--accent-primary)]'
              : authSession
                ? 'bg-[var(--bg-hover)] text-[var(--accent-primary)]'
                : 'bg-[var(--bg-canvas)] text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]'
          }`}
        >
          {vaultSource === 'local-fs' ? (
            <FolderOpen className="h-3.5 w-3.5" />
          ) : (
            <ShieldCheck className="h-3.5 w-3.5" />
          )}
          <span>
            {vaultSource === 'local-fs'
              ? localFolderName || 'Local Folder'
              : authSession
                ? `@${authSession.user}`
                : 'Preview Mode'}
          </span>
        </button>

        <button
          type="button"
          onClick={cycleColorMode}
          aria-label={`Switch theme (current: ${COLOR_MODE_LABELS[colorMode]})`}
          title={`Palette: ${COLOR_MODE_LABELS[colorMode]} (click to cycle)`}
          className="hidden lg:inline-flex h-8 items-center gap-1.5 rounded-xl bg-[var(--bg-canvas)] px-2.5 text-xs text-[var(--text-secondary)] shadow-xs hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]"
        >
          <Palette className="h-4 w-4 text-[var(--accent-primary)]" />
          <span className="hidden xl:inline">{COLOR_MODE_LABELS[colorMode]}</span>
        </button>

        <button
          type="button"
          onClick={() => (onToggleInspector ? onToggleInspector() : toggleInspector())}
          aria-label="Toggle inspector"
          aria-pressed={inspectorOpen}
          title="Toggle inspector (Ctrl/Cmd+Shift+\)"
          className={`${
            showMobileInspector ? 'inline-flex' : 'hidden lg:inline-flex'
          } min-h-[44px] min-w-[44px] items-center justify-center rounded-xl text-[var(--fg-app)] opacity-85 transition-all hover:opacity-100 active:scale-90 lg:min-h-0 lg:min-w-0 lg:h-8 lg:w-8 lg:text-[var(--text-secondary)] lg:opacity-100 lg:hover:bg-[var(--bg-hover)] lg:hover:text-[var(--text-primary)] lg:active:scale-100`}
        >
          <PanelRight className="h-6 w-6 lg:h-4 lg:w-4" />
        </button>

        <button
          type="button"
          onClick={() => setSettingsOpen(true)}
          aria-label="Open settings"
          title="Settings (Ctrl/Cmd+,)"
          className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl text-[var(--fg-app)] opacity-85 transition-all hover:opacity-100 active:scale-90 lg:min-h-0 lg:min-w-0 lg:h-8 lg:w-8 lg:text-[var(--text-secondary)] lg:opacity-100 lg:hover:bg-[var(--bg-hover)] lg:hover:text-[var(--text-primary)] lg:active:scale-100"
        >
          <Settings className="h-6 w-6 lg:h-4 lg:w-4" />
        </button>
      </div>
    </header>
  );
}
