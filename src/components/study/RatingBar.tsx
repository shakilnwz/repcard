import { Rating, type ValidRating, type IntervalPreviewItem } from '@/lib/fsrs'

interface RatingBarProps {
  isFlipped: boolean;
  mode: 'due' | 'cram';
  intervalPreviews?: Record<ValidRating, IntervalPreviewItem>;
  onGradeDue?: (rating: ValidRating) => void;
  onGradeCram?: (gotIt: boolean) => void;
}

export function RatingBar({
  isFlipped,
  mode,
  intervalPreviews,
  onGradeDue,
  onGradeCram,
}: RatingBarProps) {
  if (!isFlipped) {
    return (
      <footer className="pt-2 pb-1 text-center select-none">
        <p className="text-xs font-semibold text-[var(--fg-app)] opacity-70">
          Tap card or press <kbd className="px-1.5 py-0.5 rounded-md bg-[var(--fg-app)] text-[var(--bg-app)] font-bold shadow-xs">Space</kbd> to reveal breakdown
        </p>
      </footer>
    )
  }

  // Due Queue Mode: 4 Small Rating Cards
  if (mode === 'due' && intervalPreviews && onGradeDue) {
    return (
      <footer className="pt-2">
        <div className="grid grid-cols-4 gap-2">
          {/* Again (1) */}
          <button
            onClick={() => onGradeDue(Rating.Again)}
            className="flex flex-col items-center justify-center py-3 px-1 rounded-2xl bg-[var(--fg-app)] text-[var(--bg-app)] shadow-sm hover:opacity-90 active:scale-95 transition-all text-center"
          >
            <span className="font-[family-name:var(--font-display)] text-xs font-extrabold tracking-tight">Again</span>
            <span className="text-[10px] font-semibold opacity-75 mt-0.5">{intervalPreviews[Rating.Again].label}</span>
          </button>

          {/* Hard (2) */}
          <button
            onClick={() => onGradeDue(Rating.Hard)}
            className="flex flex-col items-center justify-center py-3 px-1 rounded-2xl bg-[var(--fg-app)] text-[var(--bg-app)] shadow-sm hover:opacity-90 active:scale-95 transition-all text-center"
          >
            <span className="font-[family-name:var(--font-display)] text-xs font-extrabold tracking-tight">Hard</span>
            <span className="text-[10px] font-semibold opacity-75 mt-0.5">{intervalPreviews[Rating.Hard].label}</span>
          </button>

          {/* Good (3) */}
          <button
            onClick={() => onGradeDue(Rating.Good)}
            className="flex flex-col items-center justify-center py-3 px-1 rounded-2xl bg-[var(--fg-app)] text-[var(--bg-app)] shadow-md hover:opacity-90 active:scale-95 transition-all text-center ring-2 ring-[var(--bg-app)]"
          >
            <span className="font-[family-name:var(--font-display)] text-xs font-extrabold tracking-tight">Good</span>
            <span className="text-[10px] font-semibold opacity-85 mt-0.5">{intervalPreviews[Rating.Good].label}</span>
          </button>

          {/* Easy (4) */}
          <button
            onClick={() => onGradeDue(Rating.Easy)}
            className="flex flex-col items-center justify-center py-3 px-1 rounded-2xl bg-[var(--fg-app)] text-[var(--bg-app)] shadow-sm hover:opacity-90 active:scale-95 transition-all text-center"
          >
            <span className="font-[family-name:var(--font-display)] text-xs font-extrabold tracking-tight">Easy</span>
            <span className="text-[10px] font-semibold opacity-75 mt-0.5">{intervalPreviews[Rating.Easy].label}</span>
          </button>
        </div>
      </footer>
    )
  }

  // Cram Mode: 2 Small Practice Cards
  return (
    <footer className="pt-2">
      <div className="grid grid-cols-2 gap-3">
        {/* Still Shaky */}
        <button
          onClick={() => onGradeCram?.(false)}
          className="flex flex-col items-center justify-center py-3.5 px-3 rounded-2xl bg-[var(--fg-app)] text-[var(--bg-app)] font-[family-name:var(--font-display)] text-xs font-extrabold shadow-sm hover:opacity-90 active:scale-95 transition-all text-center"
        >
          <span>Still Shaky</span>
          <span className="text-[10px] font-semibold opacity-75 mt-0.5">Re-queue (1)</span>
        </button>

        {/* Got It */}
        <button
          onClick={() => onGradeCram?.(true)}
          className="flex flex-col items-center justify-center py-3.5 px-3 rounded-2xl bg-[var(--fg-app)] text-[var(--bg-app)] font-[family-name:var(--font-display)] text-xs font-extrabold shadow-md hover:opacity-90 active:scale-95 transition-all text-center ring-2 ring-[var(--bg-app)]"
        >
          <span>Got It</span>
          <span className="text-[10px] font-semibold opacity-85 mt-0.5">Next (2)</span>
        </button>
      </div>
    </footer>
  )
}
