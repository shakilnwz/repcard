import { CheckCircle2, RotateCw } from 'lucide-react'
import { Rating, type ValidRating } from '@/lib/fsrs'
import type { IntervalPreviewItem } from '@/lib/fsrs'

interface RatingBarProps {
  isFlipped: boolean;
  mode: 'due' | 'cram';
  intervalPreviews?: Record<ValidRating, IntervalPreviewItem>;
  onGradeDue?: (rating: ValidRating) => void;
  onGradeCram?: (gotIt: boolean) => void;
  countTowardSrs?: boolean;
  onToggleCountTowardSrs?: () => void;
}

export function RatingBar({
  isFlipped,
  mode,
  intervalPreviews,
  onGradeDue,
  onGradeCram,
  countTowardSrs,
  onToggleCountTowardSrs,
}: RatingBarProps) {
  if (!isFlipped) {
    return (
      <footer className="pt-3 border-t border-[var(--border-subtle)]">
        <div className="flex items-center justify-center gap-2 py-2 text-xs text-[var(--text-secondary)]">
          <CheckCircle2 className="w-4 h-4 text-[var(--accent-mint)]" />
          <span>Tap card or press Space to reveal breakdown</span>
        </div>
      </footer>
    )
  }

  if (mode === 'due' && intervalPreviews && onGradeDue) {
    return (
      <footer className="pt-3 border-t border-[var(--border-subtle)]">
        <div className="grid grid-cols-4 gap-2">
          {/* Again (1) */}
          <button
            onClick={() => onGradeDue(Rating.Again)}
            className="flex flex-col items-center justify-center py-2.5 px-1 rounded-xl bg-[var(--bg-surface)] border border-[var(--danger-solid)] text-[var(--danger-solid)] hover:opacity-90 active:scale-98 transition-all"
          >
            <span className="font-[family-name:var(--font-display)] text-xs font-bold">Again (1)</span>
            <span className="text-[11px] opacity-90">{intervalPreviews[Rating.Again].label}</span>
          </button>

          {/* Hard (2) */}
          <button
            onClick={() => onGradeDue(Rating.Hard)}
            className="flex flex-col items-center justify-center py-2.5 px-1 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-[var(--text-primary)] hover:opacity-90 active:scale-98 transition-all"
          >
            <span className="font-[family-name:var(--font-display)] text-xs font-bold">Hard (2)</span>
            <span className="text-[11px] text-[var(--text-secondary)]">{intervalPreviews[Rating.Hard].label}</span>
          </button>

          {/* Good (3) */}
          <button
            onClick={() => onGradeDue(Rating.Good)}
            className="flex flex-col items-center justify-center py-2.5 px-1 rounded-xl bg-[var(--accent-mint)] text-[var(--accent-mint-fg)] hover:opacity-90 active:scale-98 transition-all font-semibold"
          >
            <span className="font-[family-name:var(--font-display)] text-xs font-bold">Good (3)</span>
            <span className="text-[11px] opacity-90">{intervalPreviews[Rating.Good].label}</span>
          </button>

          {/* Easy (4) */}
          <button
            onClick={() => onGradeDue(Rating.Easy)}
            className="flex flex-col items-center justify-center py-2.5 px-1 rounded-xl bg-[var(--bg-elevated)] border border-[var(--accent-mint)] text-[var(--accent-mint)] hover:opacity-90 active:scale-98 transition-all"
          >
            <span className="font-[family-name:var(--font-display)] text-xs font-bold">Easy (4)</span>
            <span className="text-[11px] opacity-90">{intervalPreviews[Rating.Easy].label}</span>
          </button>
        </div>
      </footer>
    )
  }

  // Cram Mode Rating Bar
  return (
    <footer className="pt-3 border-t border-[var(--border-subtle)] space-y-2">
      <div className="grid grid-cols-2 gap-2.5">
        {/* Still Shaky */}
        <button
          onClick={() => onGradeCram?.(false)}
          className="flex items-center justify-center gap-1.5 py-2.5 px-4 rounded-xl bg-[var(--bg-surface)] border border-[var(--danger-solid)] text-[var(--danger-solid)] font-[family-name:var(--font-display)] text-xs font-bold hover:opacity-90 active:scale-98 transition-all"
        >
          <RotateCw className="w-3.5 h-3.5" />
          <span>Still Shaky (1)</span>
        </button>

        {/* Got It */}
        <button
          onClick={() => onGradeCram?.(true)}
          className="flex items-center justify-center gap-1.5 py-2.5 px-4 rounded-xl bg-[var(--accent-mint)] text-[var(--accent-mint-fg)] font-[family-name:var(--font-display)] text-xs font-bold hover:opacity-90 active:scale-98 transition-all shadow-xs"
        >
          <CheckCircle2 className="w-3.5 h-3.5" />
          <span>Got It (2)</span>
        </button>
      </div>

      {onToggleCountTowardSrs && (
        <div className="flex items-center justify-center gap-2 pt-1 text-[11px] text-[var(--text-secondary)]">
          <label className="flex items-center gap-1.5 cursor-pointer">
            <input
              type="checkbox"
              checked={countTowardSrs}
              onChange={onToggleCountTowardSrs}
              className="rounded border-[var(--border-subtle)] accent-[var(--accent-mint)] text-[var(--accent-mint)]"
            />
            <span>Count practice toward FSRS spaced schedule</span>
          </label>
        </div>
      )}
    </footer>
  )
}
