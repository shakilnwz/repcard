import {
  Compass,
  FileText,
  FolderTree,
  GitBranch,
  Layers,
  LayoutGrid,
  Radar,
  RefreshCw,
  ShieldCheck,
} from '@/shared/ui/MaterialIcons';
import { useMemo } from 'react';
import { RoadmapDashboard } from '@/features/radar/components/RoadmapDashboard';
import { countVaultFiles } from '@/features/vault/lib/tree';
import { syncNow } from '@/features/vault/lib/vaultService';
import type { VaultFileEntry } from '@/features/vault/types/vault';
import { formatTimestamp } from '@/shared/lib/format';
import { useAppStore } from '@/shared/store/useAppStore';

interface VaultHomeProps {
  entries: VaultFileEntry[];
  onOpenMobileDrawer?: () => void;
}

const FEATURED_ITEMS = [
  {
    path: 'roadmaps/ai-engineer.md',
    title: 'AI Engineer Roadmap',
    subtitle: '22 phases · 169 subtopics · Mermaid + checklist',
    badge: 'Markdown',
  },
  {
    path: 'roadmaps/python.canvas',
    title: 'Python Developer Canvas',
    subtitle: '101 positioned cards & groups · roadmap.sh 1:1',
    badge: 'Canvas',
  },
  {
    path: 'ai_enginnering/AI Radar.canvas',
    title: 'AI Radar (Nov 2026)',
    subtitle: 'Concentric rings · advanced-canvas shapes',
    badge: 'Advanced Canvas',
  },
  {
    path: 'ai_enginnering/rag/qwen-3.5-4b-lmstudio-rag-setup.md',
    title: 'Qwen 3.5 4B Local RAG Lab',
    subtitle: 'Obsidian callouts · Mermaid pipeline · Chroma & Qdrant',
    badge: 'Guide',
  },
];

export function VaultHome({ entries, onOpenMobileDrawer }: VaultHomeProps) {
  const ignorePatterns = useAppStore((s) => s.ignorePatterns);
  const showHiddenFiles = useAppStore((s) => s.showHiddenFiles);
  const repoConfig = useAppStore((s) => s.repoConfig);
  const authSession = useAppStore((s) => s.authSession);
  const vaultSource = useAppStore((s) => s.vaultSource);
  const localFolderName = useAppStore((s) => s.localFolderName);
  const syncState = useAppStore((s) => s.syncState);
  const syncProgress = useAppStore((s) => s.syncProgress);
  const syncMessage = useAppStore((s) => s.syncMessage);
  const syncError = useAppStore((s) => s.syncError);
  const lastSyncedAt = useAppStore((s) => s.lastSyncedAt);
  const lastSyncedCommitSha = useAppStore((s) => s.lastSyncedCommitSha);

  const navigateToPath = useAppStore((s) => s.navigateToPath);
  const expandFolder = useAppStore((s) => s.expandFolder);
  const setOnboardingOpen = useAppStore((s) => s.setOnboardingOpen);
  const setStageView = useAppStore((s) => s.setStageView);

  const counts = useMemo(
    () => countVaultFiles(entries, ignorePatterns, showHiddenFiles),
    [entries, ignorePatterns, showHiddenFiles],
  );

  const canvasCount = useMemo(
    () => entries.filter((e) => e.kind === 'canvas').length,
    [entries],
  );

  const openFeatured = (targetPath: string) => {
    const parts = targetPath.split('/');
    let acc = '';
    for (let i = 0; i < parts.length - 1; i += 1) {
      acc = acc ? `${acc}/${parts[i]}` : parts[i];
      expandFolder(acc);
    }
    navigateToPath(targetPath);
  };

  return (
    <div className="mx-auto max-w-5xl space-y-5 px-4 pt-1 pb-[calc(5.5rem+env(safe-area-inset-bottom))] sm:space-y-6 sm:p-6 lg:p-8">
      <section className="rounded-3xl bg-[var(--bg-surface)] p-5 shadow-[var(--card-shadow)] sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-2 rounded-full bg-[var(--bg-elevated)] px-3 py-1 text-xs font-medium text-[var(--accent-primary)] shadow-xs">
              <ShieldCheck className="h-3.5 w-3.5" />
              <span>
                {vaultSource === 'github'
                  ? `GitHub Synced${lastSyncedCommitSha ? ` · ${lastSyncedCommitSha.slice(0, 7)}` : ''}`
                  : vaultSource === 'local-fs'
                    ? `Local Folder · ${localFolderName ?? 'Mounted'}`
                    : 'Offline-First PWA · Collaborator Push-Gated'}
              </span>
            </div>
            <h1 className="mt-3 text-2xl font-bold tracking-tight text-[var(--text-primary)] sm:text-3xl">
              RepCard Knowledgebase
            </h1>
            <p className="mt-2 text-sm leading-relaxed text-[var(--text-secondary)]">
              Cross-device workspace for{' '}
              <code className="rounded-lg bg-[var(--bg-canvas)] px-1.5 py-0.5 text-xs text-[var(--accent-primary)]">
                {repoConfig.owner}/{repoConfig.repo}
              </code>
              . Built for direct Obsidian vault parity across roadmaps, Markdown notes, Mermaid flowcharts, and JSON Canvas boards.
            </p>
            {lastSyncedAt && (
              <p className="mt-1.5 text-xs text-[var(--text-muted)]">
                Last synced: {formatTimestamp(lastSyncedAt)}
                {syncMessage ? ` · ${syncMessage}` : ''}
              </p>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {onOpenMobileDrawer && (
              <button
                type="button"
                onClick={onOpenMobileDrawer}
                className="inline-flex min-h-[44px] items-center gap-2 rounded-2xl bg-[var(--bg-canvas)] px-4 py-2 text-xs font-bold text-[var(--fg-app)] shadow-xs hover:bg-[var(--bg-hover)] lg:hidden"
              >
                <FolderTree className="h-4 w-4" />
                <span>Browse Vault</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => setStageView('radar')}
              className="hidden min-h-[44px] items-center gap-2 rounded-2xl bg-[var(--bg-hover)] px-3.5 py-2 text-xs font-semibold text-[var(--accent-primary)] shadow-xs transition-opacity hover:opacity-90 lg:inline-flex"
            >
              <Radar className="h-3.5 w-3.5" />
              <span>Radar & Studio</span>
            </button>

            {vaultSource !== 'preview' && (
              <button
                type="button"
                onClick={() => void syncNow().catch(() => {})}
                disabled={syncState === 'syncing'}
                className="inline-flex min-h-[44px] items-center gap-2 rounded-2xl bg-[var(--bg-canvas)] px-3.5 py-2 text-xs font-semibold text-[var(--text-primary)] shadow-xs hover:bg-[var(--bg-hover)] disabled:opacity-50"
              >
                <RefreshCw
                  className={`h-3.5 w-3.5 ${syncState === 'syncing' ? 'animate-spin text-[var(--accent-primary)]' : ''}`}
                />
                <span>{syncState === 'syncing' ? 'Syncing...' : 'Sync Now'}</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => setOnboardingOpen(true)}
              className="key-depth inline-flex min-h-[44px] items-center gap-2 rounded-2xl bg-[var(--button-primary-bg)] px-4 py-2 text-sm font-bold text-[var(--button-primary-fg)] transition-opacity hover:opacity-90"
            >
              <GitBranch className="h-4 w-4" />
              <span>
                {vaultSource === 'local-fs'
                  ? `Local: ${localFolderName ?? 'Folder'}`
                  : authSession
                    ? `Signed in as @${authSession.user}`
                    : 'Connect GitHub Repo'}
              </span>
            </button>
          </div>
        </div>

        {syncProgress && (
          <div className="mt-4 rounded-2xl bg-[var(--bg-hover)] px-3.5 py-2 text-xs text-[var(--accent-primary)] shadow-xs">
            Syncing {syncProgress.phase} ({syncProgress.done}/{syncProgress.total})
            {syncProgress.currentPath ? ` — ${syncProgress.currentPath}` : ''}
          </div>
        )}

        {syncError && (
          <div className="mt-4 rounded-2xl bg-rose-500/15 px-3.5 py-2 text-xs text-rose-300 shadow-xs">
            {syncError}
          </div>
        )}

        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="rounded-2xl bg-[var(--bg-canvas)] p-3.5 shadow-xs">
            <div className="flex items-center gap-2 text-xs text-[var(--text-muted)]">
              <FolderTree className="h-3.5 w-3.5 text-[var(--accent-primary)]" />
              <span>Visible Vault Files</span>
            </div>
            <div className="mt-1 text-xl font-bold tabular-nums text-[var(--text-primary)]">
              {counts.visible}
            </div>
          </div>

          <div className="rounded-2xl bg-[var(--bg-canvas)] p-3.5 shadow-xs">
            <div className="flex items-center gap-2 text-xs text-[var(--text-muted)]">
              <Compass className="h-3.5 w-3.5 text-[var(--accent-highlight)]" />
              <span>Roadmaps Tracked</span>
            </div>
            <div className="mt-1 text-xl font-bold tabular-nums text-[var(--text-primary)]">
              {counts.roadmaps}
            </div>
          </div>

          <div className="rounded-2xl bg-[var(--bg-canvas)] p-3.5 shadow-xs">
            <div className="flex items-center gap-2 text-xs text-[var(--text-muted)]">
              <LayoutGrid className="h-3.5 w-3.5 text-[var(--accent-secondary)]" />
              <span>Canvas Boards</span>
            </div>
            <div className="mt-1 text-xl font-bold tabular-nums text-[var(--text-primary)]">
              {canvasCount}
            </div>
          </div>

          <div className="rounded-2xl bg-[var(--bg-canvas)] p-3.5 shadow-xs">
            <div className="flex items-center gap-2 text-xs text-[var(--text-muted)]">
              <Layers className="h-3.5 w-3.5 text-[var(--accent-primary)]" />
              <span>Ignored Paths</span>
            </div>
            <div className="mt-1 text-xl font-bold tabular-nums text-[var(--text-primary)]">
              {counts.hidden}
            </div>
          </div>
        </div>
      </section>

      <RoadmapDashboard entries={entries} />

      <section>
        <h2 className="mb-3 text-xs font-bold tracking-wider text-[var(--fg-app)] opacity-80 uppercase">
          Quick Jump — Vault Highlights
        </h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {FEATURED_ITEMS.map((item) => (
            <button
              key={item.path}
              type="button"
              onClick={() => openFeatured(item.path)}
              className="flex items-start justify-between gap-3 rounded-2xl bg-[var(--bg-surface)] p-4 text-left shadow-sm transition-colors hover:bg-[var(--bg-hover)]"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4 shrink-0 text-[var(--accent-primary)]" />
                  <span className="truncate font-semibold text-[var(--text-primary)]">
                    {item.title}
                  </span>
                </div>
                <p className="mt-1 text-xs text-[var(--text-muted)]">
                  {item.subtitle}
                </p>
                <p className="mt-2 truncate font-mono text-[11px] text-[var(--accent-secondary)]">
                  {item.path}
                </p>
              </div>
              <span className="shrink-0 rounded-md bg-[var(--bg-elevated)] px-2 py-0.5 text-[11px] font-medium text-[var(--text-secondary)]">
                {item.badge}
              </span>
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}
