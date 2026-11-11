import { Rating, type ValidRating, type IntervalPreviewItem } from '@/lib/fsrs'

interface RatingBarProps {
  isFlipped: boolean;
  mode: 'due' | 'cram';
  intervalPreviews?: Record<ValidRating, IntervalPreviewItem>;
  onReveal: () => void;
  onGradeDue?: (rating: ValidRating) => void;
  onGradeCram?: (gotIt: boolean) => void;
}

const DUE_RATINGS: { rating: ValidRating; label: string; primary?: boolean }[] = [
  { rating: Rating.Again, label: 'Again' },
  { rating: Rating.Hard, label: 'Hard' },
  { rating: Rating.Good, label: 'Good', primary: true },
  { rating: Rating.Easy, label: 'Easy' },
]

const buttonClass = (primary?: boolean) =>
  `key-depth h-full flex flex-col items-center justify-center px-1 rounded-2xl bg-[var(--bg-card)] text-[var(--fg-card)] hover:opacity-90 text-center ${
    primary ? 'key-depth-primary' : ''
  }`

export function RatingBar({
  isFlipped,
  mode,
  intervalPreviews,
  onReveal,
  onGradeDue,
  onGradeCram,
}: RatingBarProps) {
  // Fixed height in every state, so swapping reveal <-> rating buttons never shifts the card above.
  // pb-1 keeps the keys' 4px depth lip inside that height.
  return (
    <footer className="shrink-0 h-[72px] pt-2 pb-1 select-none">
      {!isFlipped ? (
        // Thumb-reachable reveal (the card itself carries the tap / swipe hint)
        <button
          onClick={onReveal}
          className="key-depth key-depth-primary w-full h-full flex items-center justify-center gap-2 rounded-2xl bg-[var(--bg-card)] text-[var(--fg-card)] hover:opacity-90"
        >
          <span className="text-sm font-bold">Show answer</span>
          <kbd className="px-1.5 py-0.5 rounded-md bg-[var(--fg-card)] text-[var(--bg-card)] text-[10px] font-bold">
            Space
          </kbd>
        </button>
      ) : mode === 'due' && intervalPreviews && onGradeDue ? (
        // Due Queue Mode: 4 Small Rating Cards
        <div className="h-full grid grid-cols-4 gap-2">
          {DUE_RATINGS.map(({ rating, label, primary }) => (
            <button key={rating} onClick={() => onGradeDue(rating)} className={buttonClass(primary)}>
              <span className="text-xs font-bold tracking-tight">{label}</span>
              <span className={`text-[10px] font-semibold mt-0.5 ${primary ? 'opacity-85' : 'opacity-75'}`}>
                {intervalPreviews[rating].label}
              </span>
            </button>
          ))}
        </div>
      ) : (
        // Cram Mode: 2 Small Practice Cards
        <div className="h-full grid grid-cols-2 gap-3">
          <button onClick={() => onGradeCram?.(false)} className={buttonClass()}>
            <span className="text-xs font-bold">Still Shaky</span>
            <span className="text-[10px] font-semibold opacity-75 mt-0.5">Re-queue (1)</span>
          </button>
          <button onClick={() => onGradeCram?.(true)} className={buttonClass(true)}>
            <span className="text-xs font-bold">Got It</span>
            <span className="text-[10px] font-semibold opacity-85 mt-0.5">Next (2)</span>
          </button>
        </div>
      )}
    </footer>
  )
}
