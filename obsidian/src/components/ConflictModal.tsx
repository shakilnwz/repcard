import { AlertTriangle, Check, Copy, GitMerge, Trash2, X } from 'lucide-react';
import { useState } from 'react';
import {
  resolveConflictKeepLocal,
  resolveConflictKeepRemote,
  resolveConflictSaveCopy,
  syncNow,
} from '@/lib/vaultService';
import { useAppStore } from '@/store/useAppStore';

export function ConflictModal() {
  const open = useAppStore((s) => s.conflictModalOpen);
  const outboxEdits = useAppStore((s) => s.outboxEdits);
  const setConflictModalOpen = useAppStore((s) => s.setConflictModalOpen);
  const navigateToPath = useAppStore((s) => s.navigateToPath);

  const [busyPath, setBusyPath] = useState<string | null>(null);
  const [statusNote, setStatusNote] = useState<string | null>(null);

  if (!open) return null;

  const conflicts = outboxEdits.filter((e) => e.status === 'conflict');

  const handleResolve = async (
    path: string,
    mode: 'local' | 'remote' | 'copy',
  ) => {
    setBusyPath(path);
    setStatusNote(null);
    try {
      if (mode === 'local') {
        await resolveConflictKeepLocal(path);
        setStatusNote(`Kept local edits for ${path} (queued to push).`);
      } else if (mode === 'remote') {
        await resolveConflictKeepRemote(path);
        setStatusNote(`Accepted remote Obsidian version for ${path}.`);
      } else {
        const copyPath = await resolveConflictSaveCopy(path);
        setStatusNote(
          `Saved local changes to ${copyPath} and restored remote ${path}.`,
        );
      }

      const remaining = useAppStore
        .getState()
        .outboxEdits.filter((e) => e.status === 'conflict').length;
      if (remaining === 0) {
        setConflictModalOpen(false);
        void syncNow({ silent: true }).catch(() => {});
      }
    } finally {
      setBusyPath(null);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Resolve Sync Conflicts"
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#0B132B]/80 p-4 backdrop-blur-xs"
    >
      <div className="flex max-h-[90vh] w-full max-w-4xl flex-col rounded-xl border border-rose-500/40 bg-[var(--bg-surface)] shadow-2xl">
        <div className="flex items-center justify-between border-b border-[var(--border-subtle)] px-5 py-4">
          <div className="flex items-center gap-2 text-rose-400">
            <GitMerge className="h-5 w-5" />
            <h2 className="text-base font-bold text-[var(--text-primary)]">
              Sync Conflicts Detected ({conflicts.length})
            </h2>
          </div>
          <button
            type="button"
            onClick={() => setConflictModalOpen(false)}
            aria-label="Close conflict resolver"
            className="rounded-md p-1 text-[var(--text-muted)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 space-y-5 overflow-y-auto p-5 text-xs">
          <div className="flex items-start gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-amber-200">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
            <p>
              Both this app and the remote repository (for example, desktop Obsidian <code className="text-amber-300">github-sync</code>) edited the same lines. Choose how to resolve each file before pushing.
            </p>
          </div>

          {statusNote && (
            <div className="rounded-lg border border-[var(--accent-primary)]/40 bg-[var(--bg-hover)] px-3 py-2 text-[var(--accent-primary)]">
              {statusNote}
            </div>
          )}

          {conflicts.length === 0 ? (
            <div className="py-8 text-center text-[var(--text-muted)]">
              All conflicts resolved.
            </div>
          ) : (
            conflicts.map((item) => (
              <div
                key={item.path}
                className="space-y-3 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-canvas)] p-4"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setConflictModalOpen(false);
                      navigateToPath(item.path);
                    }}
                    className="font-mono font-semibold text-[var(--accent-primary)] hover:underline"
                  >
                    {item.path}
                  </button>

                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      disabled={busyPath === item.path}
                      onClick={() => void handleResolve(item.path, 'local')}
                      className="inline-flex items-center gap-1 rounded-md border border-[var(--accent-primary)]/40 bg-[var(--bg-hover)] px-2.5 py-1 font-semibold text-[var(--accent-primary)] hover:bg-[var(--accent-primary)]/20 disabled:opacity-50"
                    >
                      <Check className="h-3.5 w-3.5" />
                      <span>Keep Local</span>
                    </button>

                    <button
                      type="button"
                      disabled={busyPath === item.path}
                      onClick={() => void handleResolve(item.path, 'remote')}
                      className="inline-flex items-center gap-1 rounded-md border border-rose-500/40 bg-rose-500/10 px-2.5 py-1 font-semibold text-rose-300 hover:bg-rose-500/20 disabled:opacity-50"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      <span>Keep Remote</span>
                    </button>

                    <button
                      type="button"
                      disabled={busyPath === item.path}
                      onClick={() => void handleResolve(item.path, 'copy')}
                      className="inline-flex items-center gap-1 rounded-md bg-[var(--accent-primary)] px-2.5 py-1 font-semibold text-[var(--accent-on-primary)] hover:opacity-90 disabled:opacity-50"
                    >
                      <Copy className="h-3.5 w-3.5" />
                      <span>Save Local as Conflict Copy</span>
                    </button>
                  </div>
                </div>

                <div className="grid gap-3 md:grid-cols-2">
                  <div>
                    <div className="mb-1 text-[11px] font-semibold text-[var(--accent-primary)]">
                      Your Local Edits
                    </div>
                    <pre className="max-h-56 overflow-auto rounded-lg border border-[var(--accent-primary)]/30 bg-[var(--bg-surface)] p-3 font-mono text-[11px] leading-relaxed whitespace-pre-wrap text-[var(--text-primary)]">
                      {item.localContent}
                    </pre>
                  </div>

                  <div>
                    <div className="mb-1 text-[11px] font-semibold text-rose-400">
                      Remote Repository Version
                    </div>
                    <pre className="max-h-56 overflow-auto rounded-lg border border-rose-500/30 bg-[var(--bg-surface)] p-3 font-mono text-[11px] leading-relaxed whitespace-pre-wrap text-[var(--text-primary)]">
                      {item.remoteConflictContent ?? '(File deleted remotely)'}
                    </pre>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
