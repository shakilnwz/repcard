import { Tune, ListView, CardsView } from '@/components/ui/MaterialIcons'
export type { ColorPaletteMode } from '@/lib/colorModes'

export type StudyMode = 'due' | 'cram'
export type AppView = 'cards' | 'list'

interface AppHeaderProps {
  onOpenSidebar: () => void;
  isSyncing?: boolean;
  view: AppView;
  onToggleView: () => void;
}

const iconButtonClass =
  'relative p-2 text-[var(--fg-app)] hover:opacity-100 opacity-85 active:scale-90 transition-all flex items-center justify-center rounded-xl'

export function AppHeader({ onOpenSidebar, isSyncing, view, onToggleView }: AppHeaderProps) {
  const viewLabel = view === 'cards' ? 'Show all cards as a list' : 'Back to study cards'

  return (
    <header className="flex items-center justify-between pt-1 pb-3">
      {/* Big Title, No Subtitle, No Left Logo */}
      <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-[var(--fg-app)] select-none">
        RepCard
      </h1>

      {/* No Background, Light Icons */}
      <div className="flex items-center gap-1">
        <button onClick={onToggleView} className={iconButtonClass} aria-label={viewLabel} title={viewLabel}>
          {view === 'cards' ? <ListView className="w-7 h-7" /> : <CardsView className="w-7 h-7" />}
        </button>

        <button
          onClick={onOpenSidebar}
          className={iconButtonClass}
          aria-label="Open controls and libraries"
          title="Controls & Settings"
        >
          <Tune className="w-7 h-7" />
          {isSyncing && (
            <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-[var(--fg-app)] animate-ping" />
          )}
        </button>
      </div>
    </header>
  )
}
