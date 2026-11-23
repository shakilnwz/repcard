import { ChevronDown, ChevronRight, FileCode2, Link2, ListTree, Network, Shield } from 'lucide-react';
import { lazy, Suspense, useMemo, useState } from 'react';
import { formatTimestamp } from '@/shared/lib/format';
import { scrollToHeadingSlug } from '@/shared/lib/scroll';
import { useAppStore } from '@/shared/store/useAppStore';
import type { VaultFileEntry } from '@/features/vault/types/vault';

const GraphView = lazy(() =>
  import('@/features/graph/components/GraphView').then((m) => ({
    default: m.GraphView,
  })),
);

interface RightInspectorProps {
  entries: VaultFileEntry[];
}

export function RightInspector({ entries }: RightInspectorProps) {
  const activePath = useAppStore((s) => s.activePath);
  const authMode = useAppStore((s) => s.authMode);
  const vimMode = useAppStore((s) => s.vimMode);
  const repoConfig = useAppStore((s) => s.repoConfig);
  const vaultSource = useAppStore((s) => s.vaultSource);
  const lastSyncedAt = useAppStore((s) => s.lastSyncedAt);
  const lastSyncedCommitSha = useAppStore((s) => s.lastSyncedCommitSha);
  const rateLimit = useAppStore((s) => s.rateLimit);
  const activeHeadings = useAppStore((s) => s.activeHeadings);
  const activeBacklinks = useAppStore((s) => s.activeBacklinks);

  const navigateToPath = useAppStore((s) => s.navigateToPath);
  const setStageView = useAppStore((s) => s.setStageView);
  const [localGraphOpen, setLocalGraphOpen] = useState(false);

  const selectedEntry = useMemo(
    () => entries.find((e) => e.path === activePath) ?? null,
    [entries, activePath],
  );

  const folder = selectedEntry
    ? selectedEntry.path.includes('/')
      ? selectedEntry.path.split('/').slice(0, -1).join('/')
      : '(root)'
    : '—';

  return (
    <aside
      aria-label="Document inspector"
      className="flex h-full flex-col gap-4 overflow-y-auto bg-[var(--bg-surface)] p-4"
    >
      <div>
        <div className="flex items-center gap-2 text-xs font-semibold tracking-wide text-[var(--text-muted)] uppercase">
          <FileCode2 className="h-3.5 w-3.5 text-[var(--accent-primary)]" />
          <span>File Properties</span>
        </div>
        {selectedEntry ? (
          <dl className="mt-2.5 space-y-2 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-canvas)] p-3 text-xs">
            <div className="flex justify-between gap-2">
              <dt className="text-[var(--text-muted)]">Folder</dt>
              <dd className="truncate font-mono text-[var(--text-primary)]">{folder}</dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-[var(--text-muted)]">Kind</dt>
              <dd className="font-medium capitalize text-[var(--accent-primary)]">
                {selectedEntry.kind}
              </dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-[var(--text-muted)]">Extension</dt>
              <dd className="font-mono text-[var(--text-primary)]">
                .{selectedEntry.ext || 'none'}
              </dd>
            </div>
            {selectedEntry.blobSha && (
              <div className="flex justify-between gap-2">
                <dt className="text-[var(--text-muted)]">Blob SHA</dt>
                <dd className="font-mono text-[var(--text-primary)]">
                  {selectedEntry.blobSha.slice(0, 7)}
                </dd>
              </div>
            )}
            <div className="flex justify-between gap-2">
              <dt className="text-[var(--text-muted)]">Offline Cache</dt>
              <dd
                className={
                  vaultSource === 'preview'
                    ? 'text-[var(--text-muted)]'
                    : selectedEntry.isCached
                      ? 'font-medium text-[var(--accent-primary)]'
                      : 'font-medium text-amber-300'
                }
              >
                {vaultSource === 'preview'
                  ? 'Sample'
                  : selectedEntry.isCached
                    ? 'Cached'
                    : 'Lazy On-Demand'}
              </dd>
            </div>
          </dl>
        ) : (
          <p className="mt-2 rounded-lg border border-dashed border-[var(--border-subtle)] p-3 text-xs text-[var(--text-muted)]">
            Select any note, roadmap, or canvas from the vault tree to inspect metadata.
          </p>
        )}
      </div>

      <div>
        <div className="flex items-center gap-2 text-xs font-semibold tracking-wide text-[var(--text-muted)] uppercase">
          <ListTree className="h-3.5 w-3.5 text-[var(--accent-secondary)]" />
          <span>Document Outline ({activeHeadings.length})</span>
        </div>
        <div className="mt-2 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-canvas)] p-2.5 text-xs">
          {activeHeadings.length > 0 ? (
            <ul className="max-h-56 space-y-1 overflow-y-auto">
              {activeHeadings.map((h) => (
                <li
                  key={h.slug}
                  style={{ paddingLeft: `${Math.max(0, h.depth - 1) * 10}px` }}
                >
                  <button
                    type="button"
                    onClick={() => scrollToHeadingSlug(h.slug)}
                    className="w-full truncate rounded px-1.5 py-1 text-left text-[11px] text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] hover:text-[var(--accent-primary)]"
                    title={h.text}
                  >
                    {h.text}
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="p-1 text-[11px] text-[var(--text-muted)]">
              {selectedEntry?.kind === 'markdown'
                ? vaultSource === 'preview'
                  ? 'Connect vault to extract note headings.'
                  : 'No headings in this note.'
                : 'Select a Markdown note to browse headings.'}
            </p>
          )}
        </div>
      </div>

      <div>
        <div className="flex items-center gap-2 text-xs font-semibold tracking-wide text-[var(--text-muted)] uppercase">
          <Link2 className="h-3.5 w-3.5 text-[var(--accent-primary)]" />
          <span>Backlinks ({activeBacklinks.length})</span>
        </div>
        <div className="mt-2 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-canvas)] p-2.5 text-xs">
          {activeBacklinks.length > 0 ? (
            <ul className="max-h-44 space-y-1 overflow-y-auto">
              {activeBacklinks.map((bl) => (
                <li key={bl.sourcePath}>
                  <button
                    type="button"
                    onClick={() => navigateToPath(bl.sourcePath)}
                    className="flex w-full items-center justify-between gap-2 rounded px-1.5 py-1 text-left text-[11px] text-[var(--accent-primary)] hover:bg-[var(--bg-hover)]"
                    title={bl.sourcePath}
                  >
                    <span className="truncate font-medium">{bl.sourceName}</span>
                    <span className="shrink-0 text-[10px] uppercase text-[var(--text-muted)]">
                      {bl.sourceKind}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="p-1 text-[11px] text-[var(--text-muted)]">
              {selectedEntry
                ? 'No incoming wikilinks to this file yet.'
                : 'Select a file to inspect incoming backlinks.'}
            </p>
          )}
        </div>
      </div>

      {activePath && vaultSource !== 'preview' && (
        <div>
          <div className="flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={() => setLocalGraphOpen((o) => !o)}
              className="flex items-center gap-1.5 text-xs font-semibold tracking-wide text-[var(--text-muted)] uppercase hover:text-[var(--text-primary)]"
            >
              <Network className="h-3.5 w-3.5 text-[var(--accent-primary)]" />
              <span>Local Graph</span>
              {localGraphOpen ? (
                <ChevronDown className="h-3.5 w-3.5" />
              ) : (
                <ChevronRight className="h-3.5 w-3.5" />
              )}
            </button>
            <button
              type="button"
              onClick={() => setStageView('graph')}
              className="text-[11px] font-medium text-[var(--accent-primary)] hover:underline"
            >
              Global Graph
            </button>
          </div>
          {localGraphOpen && (
            <div className="mt-2 h-56 overflow-hidden rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-canvas)]">
              <Suspense
                fallback={
                  <div className="flex h-full items-center justify-center text-[11px] text-[var(--text-muted)]">
                    Loading local graph...
                  </div>
                }
              >
                <GraphView
                  mode="local"
                  compact
                  centerPath={activePath}
                  onOpenGlobal={() => setStageView('graph')}
                />
              </Suspense>
            </div>
          )}
        </div>
      )}

      <div className="mt-auto">
        <div className="flex items-center gap-2 text-xs font-semibold tracking-wide text-[var(--text-muted)] uppercase">
          <Shield className="h-3.5 w-3.5 text-[var(--accent-primary)]" />
          <span>Workspace Policy</span>
        </div>
        <div className="mt-2 space-y-1.5 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-canvas)] p-3 text-xs text-[var(--text-secondary)]">
          <div>
            Repo:{' '}
            <span className="font-mono text-[var(--text-primary)]">
              {repoConfig.owner}/{repoConfig.repo}
            </span>
          </div>
          <div>
            Auth:{' '}
            <span className="font-medium text-[var(--accent-primary)]">
              {authMode === 'github-oauth'
                ? 'GitHub OAuth (Push Gate)'
                : authMode === 'pat'
                  ? 'Fine-Grained PAT'
                  : 'Local Folder'}
            </span>
          </div>
          <div>
            Source:{' '}
            <span className="font-medium capitalize text-[var(--text-primary)]">
              {vaultSource}
            </span>
          </div>
          {lastSyncedCommitSha && (
            <div>
              Commit:{' '}
              <span className="font-mono text-[var(--text-primary)]">
                {lastSyncedCommitSha.slice(0, 7)}
              </span>
            </div>
          )}
          {lastSyncedAt && (
            <div className="truncate">
              Synced:{' '}
              <span className="text-[var(--text-primary)]">
                {formatTimestamp(lastSyncedAt)}
              </span>
            </div>
          )}
          {rateLimit && (
            <div>
              API Quota:{' '}
              <span className="tabular-nums text-[var(--text-primary)]">
                {rateLimit.remaining}/{rateLimit.limit}
              </span>
            </div>
          )}
          <div>
            Editor Vim Mode:{' '}
            <span className="font-medium text-[var(--text-primary)]">
              {vimMode ? 'Enabled' : 'Disabled'}
            </span>
          </div>
        </div>
      </div>
    </aside>
  );
}
