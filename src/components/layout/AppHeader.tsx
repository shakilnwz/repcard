import { Layers, RotateCcw, FolderGit2, RefreshCw, Palette } from 'lucide-react'

export type StudyMode = 'due' | 'cram'
export type ColorPaletteMode = 'default' | 'mint-card' | 'mint-pure'

interface AppHeaderProps {
  mode: StudyMode;
  onModeChange: (mode: StudyMode) => void;
  dueCount: number;
  canUndo: boolean;
  onUndo: () => void;
  activeLibrariesCount: number;
  isSyncing: boolean;
  onOpenLibraries: () => void;
  colorMode: ColorPaletteMode;
  onCycleColorMode: () => void;
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
  colorMode,
  onCycleColorMode,
}: AppHeaderProps) {
  const colorModeLabel =
    colorMode === 'default'
      ? 'Mint Canvas'
      : colorMode === 'mint-card'
      ? 'Navy Canvas'
      : 'Pure Mint'

  return (
    <header className="space-y-3 pb-2">
      {/* Top Brand Bar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-[var(--fg-app)] text-[var(--bg-app)] flex items-center justify-center shadow-xs">
            <Layers className="w-4 h-4" />
          </div>
          <div>
            <h1 className="font-[family-name:var(--font-display)] text-lg font-bold tracking-tight text-[var(--fg-app)]">
              RepCard
            </h1>
            <p className="text-[11px] font-medium text-[var(--fg-app)] opacity-80">
              System Design & AI Flashcards
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Color Switch Toggle */}
          <button
            onClick={onCycleColorMode}
            className="flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-lg bg-[var(--fg-app)] text-[var(--bg-app)] shadow-xs hover:opacity-90 transition-opacity"
            title={`Switch 2-color layout (Current: ${colorModeLabel})`}
          >
            <Palette className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">{colorModeLabel}</span>
          </button>

          {canUndo && (
            <button
              onClick={onUndo}
              className="flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-lg bg-[var(--fg-app)] text-[var(--bg-app)] shadow-xs hover:opacity-90 transition-opacity"
              title="Undo last rating (U)"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Undo</span>
            </button>
          )}

          <button
            onClick={onOpenLibraries}
            className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-[family-name:var(--font-display)] font-semibold rounded-lg bg-[var(--fg-app)] text-[var(--bg-app)] shadow-xs hover:opacity-90 transition-opacity"
            title="Manage libraries and endpoints"
          >
            {isSyncing ? (
              <RefreshCw className="w-3.5 h-3.5 animate-spin text-[var(--bg-app)]" />
            ) : (
              <FolderGit2 className="w-3.5 h-3.5" />
            )}
            <span>Libraries ({activeLibrariesCount})</span>
          </button>
        </div>
      </div>

      {/* Mode Switcher Tabs */}
      <div className="grid grid-cols-2 p-1 rounded-xl bg-[var(--fg-app)] text-[var(--bg-app)] shadow-sm text-xs">
        {/* Due Queue Mode */}
        <button
          onClick={() => onModeChange('due')}
          className={`flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-lg font-[family-name:var(--font-display)] font-semibold transition-all ${
            mode === 'due'
              ? 'bg-[var(--bg-app)] text-[var(--fg-app)] shadow-xs'
              : 'text-[var(--bg-app)] opacity-80 hover:opacity-100'
          }`}
        >
          <span>Due Queue</span>
          <span
            className={`px-1.5 py-0.2 text-[10px] rounded-full font-bold ${
              mode === 'due'
                ? 'bg-[var(--fg-app)] text-[var(--bg-app)]'
                : 'bg-[var(--bg-app)] text-[var(--fg-app)]'
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
              ? 'bg-[var(--bg-app)] text-[var(--fg-app)] shadow-xs'
              : 'text-[var(--bg-app)] opacity-80 hover:opacity-100'
          }`}
        >
          <span>Practice Anytime</span>
          <span className="text-[10px] opacity-75">(Cram)</span>
        </button>
      </div>
    </header>
  )
}
