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
    { id: 'bookmarked', label: 'Starred', icon: <Star className="w-3 h-3 text-amber-300" /> },
    { id: 'hardest', label: 'Hardest', icon: <Flame className="w-3 h-3 text-red-400" /> },
  ]

  return (
    <div className="flex items-center gap-1.5 overflow-x-auto py-1 no-scrollbar text-xs">
      <span className="text-[11px] text-[var(--text-secondary)] font-medium shrink-0 flex items-center gap-1 mr-1">
        <Sparkles className="w-3 h-3 text-[var(--accent-mint)]" /> Filter:
      </span>
      {filters.map((f) => {
        const active = currentFilter === f.id
        const count = counts[f.id] || 0

        return (
          <button
            key={f.id}
            onClick={() => onFilterChange(f.id)}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full whitespace-nowrap transition-colors border ${
              active
                ? 'bg-[var(--accent-mint)] text-[var(--accent-mint-fg)] border-[var(--accent-mint)] font-semibold'
                : 'bg-[var(--bg-surface)] text-[var(--text-secondary)] border-[var(--border-subtle)] hover:text-[var(--text-primary)]'
            }`}
          >
            {f.icon}
            <span>{f.label}</span>
            <span
              className={`px-1 py-0.2 text-[10px] rounded-full ${
                active ? 'bg-[var(--bg-surface)] text-[var(--accent-mint)]' : 'bg-[var(--bg-elevated)]'
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
