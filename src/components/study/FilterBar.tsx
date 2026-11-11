import { Star, Flame, Sparkles } from 'lucide-react'

export type CramFilter = 'all' | 'high' | 'low' | 'bookmarked' | 'hardest'

interface FilterBarProps {
  currentFilter: CramFilter;
  onFilterChange: (filter: CramFilter) => void;
  counts: Record<CramFilter, number>;
}

export function FilterBar({ currentFilter, onFilterChange, counts }: FilterBarProps) {
  const filters: { id: CramFilter; label: string; icon?: React.ReactNode }[] = [
    { id: 'all', label: 'All' },
    { id: 'high', label: 'High-Level' },
    { id: 'low', label: 'Low-Level' },
    { id: 'bookmarked', label: 'Starred', icon: <Star className="w-3 h-3 fill-current" /> },
    { id: 'hardest', label: 'Hardest', icon: <Flame className="w-3 h-3" /> },
  ]

  return (
    <div className="flex items-center gap-1.5 overflow-x-auto py-1.5 no-scrollbar text-xs">
      <span className="text-[11px] text-[var(--fg-app)] font-semibold shrink-0 flex items-center gap-1 mr-1">
        <Sparkles className="w-3 h-3" /> Filter:
      </span>
      {filters.map((f) => {
        const active = currentFilter === f.id
        const count = counts[f.id] || 0

        return (
          <button
            key={f.id}
            onClick={() => onFilterChange(f.id)}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-full whitespace-nowrap transition-all shadow-xs ${
              active
                ? 'bg-[var(--fg-app)] text-[var(--bg-app)] font-bold'
                : 'bg-[var(--bg-app)] text-[var(--fg-app)] opacity-80 hover:opacity-100'
            }`}
          >
            {f.icon}
            <span>{f.label}</span>
            <span
              className={`px-1.5 py-0.2 text-[10px] rounded-full font-bold ${
                active
                  ? 'bg-[var(--bg-app)] text-[var(--fg-app)]'
                  : 'bg-[var(--fg-app)] text-[var(--bg-app)]'
              }`}
            >
              {count}
            </span>
          </button>
        )
      })}
    </div>
  )
}
