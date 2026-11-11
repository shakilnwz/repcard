import React from 'react'
import { Star, Flame, Sparkles } from '@/components/ui/MaterialIcons'

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
    { id: 'bookmarked', label: 'Starred', icon: <Star className="w-3.5 h-3.5 fill-current" /> },
    { id: 'hardest', label: 'Hardest', icon: <Flame className="w-3.5 h-3.5" /> },
  ]

  return (
    <div className="space-y-2">
      {/* Filter Header Label */}
      <div className="flex items-center justify-between text-xs font-semibold">
        <span className="flex items-center gap-1 font-[family-name:var(--font-display)]">
          <Sparkles className="w-3.5 h-3.5" /> Filter Practice Queue:
        </span>
        <span className="text-[11px] font-bold">
          {counts[currentFilter] ?? 0} cards
        </span>
      </div>

      {/* Wrapped Filters (Not Horizontally Scrollable) */}
      <div className="flex flex-wrap gap-1.5 pt-0.5">
        {filters.map((f) => {
          const active = currentFilter === f.id
          const count = counts[f.id] || 0

          return (
            <button
              key={f.id}
              onClick={() => onFilterChange(f.id)}
              className={`flex items-center gap-1.5 py-1.5 px-3 rounded-xl text-xs font-semibold transition-all shadow-xs ${
                active
                  ? 'bg-[var(--fg-card)] text-[var(--bg-card)] font-bold'
                  : 'bg-[var(--bg-app)] text-[var(--fg-app)] hover:opacity-90'
              }`}
            >
              {f.icon}
              <span>{f.label}</span>
              <span
                className={`px-1.5 py-0.2 text-[10px] rounded-full font-extrabold ${
                  active
                    ? 'bg-[var(--bg-card)] text-[var(--fg-card)]'
                    : 'bg-[var(--fg-card)] text-[var(--bg-card)]'
                }`}
              >
                {count}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
