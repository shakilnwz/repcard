import { Layers, RotateCcw, FolderGit2, RefreshCw } from 'lucide-react'

export type StudyMode = 'due' | 'cram'

interface AppHeaderProps {
  mode: StudyMode;
  onModeChange: (mode: StudyMode) => void;
  dueCount: number;
  totalCards: number;
  canUndo: boolean;
  onUndo: () => void;
  activeLibrariesCount: number;
  isSyncing: boolean;
  onOpenLibraries: () => void;
}

export function AppHeader({
  mode,
  onModeChange,
  dueCount,
  canUndo,
  onUndo,
  activeLibrariesCount,
  isSyncing,
  onOpenLibraries,
}: AppHeaderProps) {
  return (
    <header className="space-y-3 pb-3 border-b border-[var(--border-subtle)]">
      {/* Top Brand Bar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)] flex items-center justify-center text-[var(--accent-mint)]">
            <Layers className="w-4 h-4" />
          </div>
          <div>
            <h1 className="font-[family-name:var(--font-display)] text-lg font-bold tracking-tight text-[var(--text-primary)]">
              RepCard
            </h1>
            <p className="text-[11px] text-[var(--text-secondary)] font-medium">
              System Design & AI Flashcards
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {canUndo && (
            <button
              onClick={onUndo}
              className="flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-lg bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
              title="Undo last rating (U)"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Undo</span>
            </button>
          )}

          <button
            onClick={onOpenLibraries}
            className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-[family-name:var(--font-display)] font-semibold rounded-lg bg-[var(--bg-elevated)] text-[var(--accent-mint)] border border-[var(--border-subtle)] hover:border-[var(--accent-mint)]/60 transition-colors"
            title="Manage libraries and endpoints"
          >
            {isSyncing ? (
              <RefreshCw className="w-3.5 h-3.5 animate-spin text-[var(--accent-mint)]" />
            ) : (
              <FolderGit2 className="w-3.5 h-3.5" />
            )}
            <span>Libraries ({activeLibrariesCount})</span>
          </button>
        </div>
      </div>

      {/* Mode Switcher Tabs */}
      <div className="grid grid-cols-2 p-1 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-xs">
        {/* Due Queue Mode */}
        <button
          onClick={() => onModeChange('due')}
          className={`flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-lg font-[family-name:var(--font-display)] font-semibold transition-all ${
            mode === 'due'
              ? 'bg-[var(--accent-mint)] text-[var(--accent-mint-fg)] shadow-xs'
              : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
          }`}
        >
          <span>Due Queue</span>
          <span
            className={`px-1.5 py-0.2 text-[10px] rounded-full font-bold ${
              mode === 'due'
                ? 'bg-[var(--bg-surface)] text-[var(--accent-mint)]'
                : 'bg-[var(--bg-elevated)] text-[var(--text-secondary)]'
            }`}
          >
            {dueCount}
          </span>
        </button>

        {/* Practice Anytime Cram Mode */}
        <button
          onClick={() => onModeChange('cram')}
          className={`flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-lg font-[family-name:var(--font-display)] font-semibold transition-all ${
            mode === 'cram'
              ? 'bg-[var(--accent-mint)] text-[var(--accent-mint-fg)] shadow-xs'
              : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
          }`}
        >
          <span>Practice Anytime</span>
          <span className="text-[10px] opacity-80">(Cram)</span>
        </button>
      </div>
    </header>
  )
}
