import { Menu } from '@/components/ui/MaterialIcons'

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

      {/* Sidebar Trigger */}
      <button
        onClick={onOpenSidebar}
        className="relative p-2.5 rounded-2xl bg-[var(--bg-card)] text-[var(--fg-card)] shadow-sm hover:opacity-90 active:scale-95 transition-all"
        aria-label="Open sidebar"
        title="Open study settings and libraries"
      >
        <Menu className="w-5 h-5" />
        {isSyncing && (
          <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-[var(--fg-card)] animate-ping" />
        )}
      </button>
    </header>
  )
}
