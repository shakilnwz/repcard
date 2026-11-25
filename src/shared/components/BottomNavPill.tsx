import { CardsView, FileText, Hub, RadarIcon } from '@/shared/ui/MaterialIcons'
import type { StageView } from '@/shared/store/useAppStore'

export interface BottomNavPillProps {
  stageView: StageView;
  onSelectStage: (stage: StageView) => void;
  hidden?: boolean;
}

const STAGES: Array<{
  id: StageView;
  label: string;
  Icon: typeof CardsView;
}> = [
  { id: 'cards', label: 'Cards', Icon: CardsView },
  { id: 'document', label: 'Docs', Icon: FileText },
  { id: 'graph', label: 'Graph', Icon: Hub },
  { id: 'radar', label: 'Radar', Icon: RadarIcon },
]

export function BottomNavPill({ stageView, onSelectStage, hidden = false }: BottomNavPillProps) {
  return (
    <nav
      aria-label="Primary navigation"
      className={`fixed bottom-[max(1rem,env(safe-area-inset-bottom))] left-1/2 -translate-x-1/2 z-50 max-w-[calc(100vw-1rem)] transition-opacity duration-150 ${
        hidden ? 'opacity-0 pointer-events-none' : 'opacity-100'
      }`}
    >
      <div className="flex items-center gap-0.5 sm:gap-1 p-1.5 rounded-full liquid-glass shadow-[var(--pill-shadow)] max-w-full">
        {STAGES.map(({ id, label, Icon }) => {
          const active = stageView === id
          return (
            <button
              key={id}
              type="button"
              onClick={() => onSelectStage(id)}
              aria-current={active ? 'page' : undefined}
              className={`min-h-[44px] px-3 sm:px-4 rounded-full flex items-center gap-1.5 text-xs font-bold whitespace-nowrap transition-all cursor-pointer select-none ${
                active
                  ? 'bg-[var(--bg-card)] text-[var(--fg-card)] key-depth'
                  : 'text-[var(--fg-app)] opacity-80 hover:opacity-100 hover:bg-white/10'
              }`}
            >
              <Icon className="w-4 h-4 shrink-0" />
              <span>{label}</span>
            </button>
          )
        })}
      </div>
    </nav>
  )
}
