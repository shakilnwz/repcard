import {
  CheckCircle2,
  Clock,
  Compass,
  GitMerge,
  LayoutGrid,
  Pin,
  RefreshCw,
  UploadCloud,
} from '@/shared/ui/MaterialIcons';
import { useMemo } from 'react';
import { syncNow } from '@/features/vault/lib/vaultService';
import { useAppStore } from '@/shared/store/useAppStore';
import type { VaultFileEntry } from '@/features/vault/types/vault';

interface RoadmapDashboardProps {
  entries: VaultFileEntry[];
}

interface TrackItem {
  key: string;
  label: string;
  mdPath?: string;
  canvasPath?: string;
  taskTotal: number;
  taskDone: number;
}

function ProgressRing({
  done,
  total,
  size = 44,
}: {
  done: number;
  total: number;
  size?: number;
}) {
  const strokeWidth = 4;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const pct = total > 0 ? Math.min(1, Math.max(0, done / total)) : 0;
  const dashOffset = circumference * (1 - pct);

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      className="shrink-0 -rotate-90"
      aria-hidden="true"
    >
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke="var(--bg-elevated)"
        strokeWidth={strokeWidth}
      />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke="var(--accent-primary)"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={dashOffset}
      />
    </svg>
  );
}

export function RoadmapDashboard({ entries }: RoadmapDashboardProps) {
  const outboxEdits = useAppStore((s) => s.outboxEdits);
  const recentFiles = useAppStore((s) => s.recentFiles);
  const pinnedFiles = useAppStore((s) => s.pinnedFiles);
  const syncState = useAppStore((s) => s.syncState);

  const navigateToPath = useAppStore((s) => s.navigateToPath);
  const setConflictModalOpen = useAppStore((s) => s.setConflictModalOpen);

  const { tracks, aggregateDone, aggregateTotal } = useMemo(() => {
    const map = new Map<string, TrackItem>();

    for (const entry of entries) {
      if (entry.isHidden) continue;
      if (entry.kind !== 'markdown' && entry.kind !== 'canvas') continue;
      const total = entry.taskTotal ?? 0;
      const done = entry.taskDone ?? 0;
      const isRoadmapFolder =
        entry.path.startsWith('roadmaps/') || total > 0;
      if (!isRoadmapFolder) continue;

      const stem = entry.path.replace(/\.(md|canvas)$/i, '');
      let existing = map.get(stem);
      if (!existing) {
        const baseName = stem.split('/').pop() ?? stem;
        const folderPrefix = stem.includes('/') ? `${stem.split('/')[0]} / ` : '';
        existing = {
          key: stem,
          label: `${folderPrefix}${baseName}`,
          taskTotal: 0,
          taskDone: 0,
        };
        map.set(stem, existing);
      }

      if (entry.kind === 'markdown') {
        existing.mdPath = entry.path;
        if (total > 0) {
          existing.taskTotal = total;
          existing.taskDone = done;
        }
      } else if (entry.kind === 'canvas') {
        existing.canvasPath = entry.path;
        if (existing.taskTotal === 0 && total > 0) {
          existing.taskTotal = total;
          existing.taskDone = done;
        }
      }
    }

    const items = Array.from(map.values())
      .filter((t) => t.taskTotal > 0)
      .sort((a, b) => a.key.localeCompare(b.key));

    let aggDone = 0;
    let aggTotal = 0;
    for (const item of items) {
      aggDone += item.taskDone;
      aggTotal += item.taskTotal;
    }

    return { tracks: items, aggregateDone: aggDone, aggregateTotal: aggTotal };
  }, [entries]);

  const conflictCount = outboxEdits.filter((e) => e.status === 'conflict').length;
  const pendingCount = outboxEdits.filter((e) => e.status === 'pending').length;
  const entrySet = useMemo(() => new Set(entries.map((e) => e.path)), [entries]);
  const validPinned = pinnedFiles.filter((p) => entrySet.has(p));
  const validRecent = recentFiles.filter((p) => entrySet.has(p)).slice(0, 6);
  const pct =
    aggregateTotal > 0 ? Math.round((aggregateDone / aggregateTotal) * 100) : 0;

  return (
    <div className="space-y-6">
      {(outboxEdits.length > 0 || validPinned.length > 0 || validRecent.length > 0) && (
        <section className="grid gap-3 md:grid-cols-2">
          {outboxEdits.length > 0 && (
            <div className="flex items-center justify-between gap-3 rounded-2xl bg-amber-500/15 p-4 text-xs shadow-sm">
              <div className="space-y-1">
                <div className="flex items-center gap-1.5 font-semibold text-amber-300">
                  {conflictCount > 0 ? (
                    <GitMerge className="h-4 w-4 text-rose-400" />
                  ) : (
                    <UploadCloud className="h-4 w-4 text-amber-400" />
                  )}
                  <span>
                    {conflictCount > 0
                      ? `${conflictCount} conflict(s) · ${pendingCount} pending push`
                      : `${pendingCount} unsynced local edit(s)`}
                  </span>
                </div>
                <p className="text-amber-200/80">
                  Saved offline in IndexedDB outbox. Push cleanly onto GitHub main.
                </p>
              </div>
              {conflictCount > 0 ? (
                <button
                  type="button"
                  onClick={() => setConflictModalOpen(true)}
                  className="shrink-0 rounded-xl bg-rose-500 px-3 py-1.5 font-bold text-white hover:bg-rose-600"
                >
                  Resolve
                </button>
              ) : (
                <button
                  type="button"
                  disabled={syncState === 'syncing'}
                  onClick={() => void syncNow().catch(() => {})}
                  className="inline-flex shrink-0 items-center gap-1 rounded-xl bg-amber-400 px-3 py-1.5 font-bold text-[#071a52] hover:opacity-90 disabled:opacity-50"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  <span>Push & Sync</span>
                </button>
              )}
            </div>
          )}

          {(validPinned.length > 0 || validRecent.length > 0) && (
            <div className="rounded-2xl bg-[var(--bg-surface)] p-4 text-xs shadow-sm">
              <div className="mb-2 flex items-center gap-1.5 font-semibold text-[var(--text-secondary)]">
                {validPinned.length > 0 ? (
                  <Pin className="h-3.5 w-3.5 text-[var(--accent-primary)]" />
                ) : (
                  <Clock className="h-3.5 w-3.5 text-[var(--accent-secondary)]" />
                )}
                <span>
                  {validPinned.length > 0 ? 'Pinned & Recent Notes' : 'Recently Opened'}
                </span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {Array.from(new Set([...validPinned, ...validRecent]))
                  .slice(0, 6)
                  .map((filePath) => (
                    <button
                      key={filePath}
                      type="button"
                      onClick={() => navigateToPath(filePath)}
                      className="inline-flex items-center gap-1 rounded-xl bg-[var(--bg-canvas)] px-2.5 py-1 text-[11px] text-[var(--text-primary)] shadow-xs hover:bg-[var(--bg-hover)]"
                      title={filePath}
                    >
                      {validPinned.includes(filePath) && (
                        <Pin className="h-2.5 w-2.5 text-[var(--accent-primary)]" />
                      )}
                      <span className="max-w-44 truncate">
                        {filePath.split('/').pop()}
                      </span>
                    </button>
                  ))}
              </div>
            </div>
          )}
        </section>
      )}

      {tracks.length > 0 && (
        <section>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Compass className="h-4 w-4 text-[var(--accent-primary)]" />
              <h2 className="text-sm font-semibold tracking-wide text-[var(--text-secondary)] uppercase">
                Roadmap Progress Dashboard
              </h2>
            </div>

            <div className="inline-flex items-center gap-2 rounded-full bg-[var(--bg-surface)] px-3.5 py-1 text-xs shadow-xs">
              <CheckCircle2 className="h-3.5 w-3.5 text-[var(--accent-primary)]" />
              <span className="font-semibold tabular-nums text-[var(--text-primary)]">
                {aggregateDone} / {aggregateTotal} tasks ({pct}%)
              </span>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {tracks.map((track) => {
              const trackPct =
                track.taskTotal > 0
                  ? Math.round((track.taskDone / track.taskTotal) * 100)
                  : 0;

              return (
                <div
                  key={track.key}
                  className="flex items-center gap-3 rounded-2xl bg-[var(--bg-surface)] p-4 shadow-sm"
                >
                  <div className="relative flex items-center justify-center">
                    <ProgressRing done={track.taskDone} total={track.taskTotal} />
                    <span className="absolute text-[10px] font-bold tabular-nums text-[var(--text-primary)]">
                      {trackPct}%
                    </span>
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="truncate text-xs font-semibold text-[var(--text-primary)]">
                      {track.label}
                    </div>
                    <div className="mt-0.5 text-[11px] tabular-nums text-[var(--text-muted)]">
                      {track.taskDone} / {track.taskTotal} completed
                    </div>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {track.mdPath && (
                        <button
                          type="button"
                          onClick={() => navigateToPath(track.mdPath!)}
                          className="rounded-lg bg-[var(--bg-canvas)] px-2.5 py-1 text-[11px] font-medium text-[var(--accent-primary)] shadow-xs hover:bg-[var(--bg-hover)]"
                        >
                          Open Guide
                        </button>
                      )}
                      {track.canvasPath && (
                        <button
                          type="button"
                          onClick={() => navigateToPath(track.canvasPath!)}
                          className="inline-flex items-center gap-1 rounded-lg bg-[var(--bg-canvas)] px-2.5 py-1 text-[11px] font-medium text-[var(--accent-secondary)] shadow-xs hover:bg-[var(--bg-hover)]"
                        >
                          <LayoutGrid className="h-2.5 w-2.5" />
                          <span>Canvas</span>
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}
