import { Tune } from '@/components/ui/MaterialIcons'

export type StudyMode = 'due' | 'cram'
export type ColorPaletteMode = 'default' | 'navy-canvas' | 'black-navy-card'

interface AppHeaderProps {
  onOpenSidebar: () => void;
  isSyncing?: boolean;
}

export function AppHeader({ onOpenSidebar, isSyncing }: AppHeaderProps) {
  return (
    <header className="flex items-center justify-between pt-1 pb-3">
      {/* Big Title, No Subtitle, No Left Logo */}
      <h1 className="font-[family-name:var(--font-display)] text-3xl sm:text-4xl font-extrabold tracking-tight text-[var(--fg-app)] select-none">
        RepCard
      </h1>

      {/* Controls & Sidebar Trigger: No Background, Light Icon */}
      <button
        onClick={onOpenSidebar}
        className="relative p-2 text-[var(--fg-app)] hover:opacity-100 opacity-85 active:scale-90 transition-all flex items-center justify-center rounded-xl"
        aria-label="Open controls and libraries"
        title="Controls & Settings"
      >
        <Tune className="w-7 h-7" />
        {isSyncing && (
          <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-[var(--fg-app)] animate-ping" />
        )}
      </button>
    </header>
  )
}
