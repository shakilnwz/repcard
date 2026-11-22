import { Eye, EyeOff, FilePlus2, GitBranch, Lock, Network, Radar, Search, X } from 'lucide-react';
import { useMemo, useState, type RefObject } from 'react';
import { VaultTree } from '@/components/VaultTree';
import { buildVaultTree, countVaultFiles } from '@/lib/tree';
import { createNewVaultNote } from '@/lib/vaultService';
import { useAppStore } from '@/store/useAppStore';
import type { VaultFileEntry } from '@/types/vault';

interface SidebarProps {
  entries: VaultFileEntry[];
  filterInputRef?: RefObject<HTMLInputElement | null>;
  onSelectFile?: (path: string) => void;
}

export function Sidebar({ entries, filterInputRef, onSelectFile }: SidebarProps) {
  const repoConfig = useAppStore((s) => s.repoConfig);
  const authSession = useAppStore((s) => s.authSession);
  const vaultSource = useAppStore((s) => s.vaultSource);
  const activePath = useAppStore((s) => s.activePath);
  const stageView = useAppStore((s) => s.stageView);
  const expandedFolders = useAppStore((s) => s.expandedFolders);
  const treeFilter = useAppStore((s) => s.treeFilter);
  const ignorePatterns = useAppStore((s) => s.ignorePatterns);
  const showHiddenFiles = useAppStore((s) => s.showHiddenFiles);

  const setTreeFilter = useAppStore((s) => s.setTreeFilter);
  const toggleFolder = useAppStore((s) => s.toggleFolder);
  const setActivePath = useAppStore((s) => s.setActivePath);
  const setStageView = useAppStore((s) => s.setStageView);
  const setShowHiddenFiles = useAppStore((s) => s.setShowHiddenFiles);
  const setOnboardingOpen = useAppStore((s) => s.setOnboardingOpen);

  const [newNoteOpen, setNewNoteOpen] = useState(false);
  const [newNotePath, setNewNotePath] = useState('');
  const [newNoteError, setNewNoteError] = useState<string | null>(null);
  const [creatingNote, setCreatingNote] = useState(false);

  const handleCreateNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newNotePath.trim()) return;
    setCreatingNote(true);
    setNewNoteError(null);
    try {
      const created = await createNewVaultNote(newNotePath.trim());
      setNewNotePath('');
      setNewNoteOpen(false);
      onSelectFile?.(created);
    } catch (err) {
      setNewNoteError(err instanceof Error ? err.message : 'Unable to create note.');
    } finally {
      setCreatingNote(false);
    }
  };

  const treeNodes = useMemo(
    () =>
      buildVaultTree(entries, {
        ignorePatterns,
        showHidden: showHiddenFiles,
        filterQuery: treeFilter,
      }),
    [entries, ignorePatterns, showHiddenFiles, treeFilter],
  );

  const counts = useMemo(
    () => countVaultFiles(entries, ignorePatterns, showHiddenFiles),
    [entries, ignorePatterns, showHiddenFiles],
  );

  const handleFileClick = (filePath: string) => {
    setActivePath(filePath);
    onSelectFile?.(filePath);
  };

  return (
    <div className="flex h-full flex-col bg-[var(--bg-surface)]">
      <div className="border-b border-[var(--border-subtle)] p-3">
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 text-xs font-semibold tracking-wide text-[var(--accent-primary)] uppercase">
              <Lock className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">{repoConfig.repo}</span>
            </div>
            <div className="mt-0.5 flex items-center gap-1 text-[11px] text-[var(--text-muted)]">
              <GitBranch className="h-3 w-3 shrink-0" />
              <span className="truncate">
                {repoConfig.owner} · {repoConfig.branch}
              </span>
            </div>
          </div>
          <span className="rounded-full bg-[var(--bg-elevated)] px-2 py-0.5 text-[11px] font-medium tabular-nums text-[var(--text-secondary)]">
            {counts.visible}
          </span>
        </div>

        <div className="relative mt-3">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 h-3.5 w-3.5 -translate-y-1/2 text-[var(--text-muted)]" />
          <input
            ref={filterInputRef}
            type="search"
            value={treeFilter}
            onChange={(e) => setTreeFilter(e.target.value)}
            placeholder="Filter vault files..."
            aria-label="Filter vault files"
            className="w-full rounded-md border border-[var(--border-subtle)] bg-[var(--bg-canvas)] py-1.5 pr-7 pl-8 text-xs text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:border-[var(--accent-primary)] focus:outline-none"
          />
          {treeFilter && (
            <button
              type="button"
              onClick={() => setTreeFilter('')}
              aria-label="Clear file filter"
              className="absolute top-1/2 right-2 -translate-y-1/2 text-[var(--text-muted)] hover:text-[var(--text-primary)]"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-2">
        <VaultTree
          nodes={treeNodes}
          activePath={activePath}
          expandedFolders={expandedFolders}
          forceExpandAll={treeFilter.trim().length > 0}
          onToggleFolder={toggleFolder}
          onSelectFile={handleFileClick}
        />
      </div>

      <div className="space-y-2 border-t border-[var(--border-subtle)] p-3">
        {newNoteOpen && (
          <form onSubmit={(e) => void handleCreateNote(e)} className="space-y-1.5 rounded-md border border-[var(--border-subtle)] bg-[var(--bg-canvas)] p-2">
            <input
              type="text"
              value={newNotePath}
              onChange={(e) => setNewNotePath(e.target.value)}
              placeholder="folder/new-note.md"
              aria-label="New note path"
              autoFocus
              className="w-full rounded border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-2 py-1 text-xs text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:border-[var(--accent-primary)] focus:outline-none"
            />
            {newNoteError && (
              <p className="text-[11px] text-rose-400">{newNoteError}</p>
            )}
            <div className="flex items-center justify-end gap-1.5">
              <button
                type="button"
                onClick={() => {
                  setNewNoteOpen(false);
                  setNewNoteError(null);
                }}
                className="rounded px-2 py-1 text-[11px] text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={creatingNote || !newNotePath.trim()}
                className="rounded bg-[var(--accent-primary)] px-2.5 py-1 text-[11px] font-semibold text-[var(--accent-on-primary)] disabled:opacity-50"
              >
                {creatingNote ? 'Creating...' : 'Create'}
              </button>
            </div>
          </form>
        )}

        <div className="flex gap-1.5">
          {vaultSource !== 'preview' && (
            <button
              type="button"
              onClick={() => {
                setNewNoteOpen((o) => !o);
                setNewNoteError(null);
              }}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-md border border-[var(--border-subtle)] bg-[var(--bg-canvas)] px-2 py-1.5 text-xs font-medium text-[var(--text-secondary)] transition-colors hover:border-[var(--accent-primary)]/50 hover:text-[var(--text-primary)]"
            >
              <FilePlus2 className="h-3.5 w-3.5 text-[var(--accent-primary)]" />
              <span>New Note</span>
            </button>
          )}
          <button
            type="button"
            onClick={() => {
              setStageView(stageView === 'graph' ? 'document' : 'graph');
            }}
            aria-pressed={stageView === 'graph'}
            className={`flex flex-1 items-center justify-center gap-1.5 rounded-md border px-2 py-1.5 text-xs font-medium transition-colors ${
              stageView === 'graph'
                ? 'border-[var(--accent-primary)] bg-[var(--accent-primary)]/15 text-[var(--accent-primary)]'
                : 'border-[var(--border-subtle)] bg-[var(--bg-canvas)] text-[var(--text-secondary)] hover:border-[var(--accent-primary)]/50 hover:text-[var(--text-primary)]'
            }`}
          >
            <Network className="h-3.5 w-3.5" />
            <span>Graph</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setStageView(stageView === 'radar' ? 'document' : 'radar');
            }}
            aria-pressed={stageView === 'radar'}
            className={`flex flex-1 items-center justify-center gap-1.5 rounded-md border px-2 py-1.5 text-xs font-medium transition-colors ${
              stageView === 'radar'
                ? 'border-[var(--accent-primary)] bg-[var(--accent-primary)]/15 text-[var(--accent-primary)]'
                : 'border-[var(--border-subtle)] bg-[var(--bg-canvas)] text-[var(--text-secondary)] hover:border-[var(--accent-primary)]/50 hover:text-[var(--text-primary)]'
            }`}
          >
            <Radar className="h-3.5 w-3.5" />
            <span>Radar</span>
          </button>
        </div>

        <button
          type="button"
          onClick={() => setShowHiddenFiles(!showHiddenFiles)}
          aria-pressed={showHiddenFiles}
          className="flex w-full items-center justify-between rounded-md border border-[var(--border-subtle)] bg-[var(--bg-canvas)] px-2.5 py-1.5 text-xs text-[var(--text-secondary)] transition-colors hover:border-[var(--accent-primary)]/50 hover:text-[var(--text-primary)]"
        >
          <span className="flex items-center gap-2">
            {showHiddenFiles ? (
              <Eye className="h-3.5 w-3.5 text-[var(--accent-primary)]" />
            ) : (
              <EyeOff className="h-3.5 w-3.5 text-[var(--text-muted)]" />
            )}
            <span>{showHiddenFiles ? 'Showing hidden files' : 'Show hidden files'}</span>
          </span>
          <span className="rounded bg-[var(--bg-elevated)] px-1.5 py-0.5 text-[10px] tabular-nums text-[var(--text-muted)]">
            {counts.hidden}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setOnboardingOpen(true)}
          className="w-full rounded-md bg-[var(--accent-primary)] px-3 py-1.5 text-xs font-semibold text-[var(--accent-on-primary)] transition-opacity hover:opacity-90"
        >
          {authSession ? `Connected: @${authSession.user}` : 'Connect Repository'}
        </button>
      </div>
    </div>
  );
}
