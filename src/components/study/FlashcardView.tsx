import { Star, ExternalLink, Sparkles } from 'lucide-react'
import type { FlashcardItem, LocalCardProgress } from '@/types/schema'

interface FlashcardViewProps {
  card: FlashcardItem;
  progress: LocalCardProgress | null;
  isFlipped: boolean;
  onFlip: () => void;
  onToggleBookmark: () => void;
  cardIndexLabel?: string;
}

export function FlashcardView({
  card,
  progress,
  isFlipped,
  onFlip,
  onToggleBookmark,
  cardIndexLabel,
}: FlashcardViewProps) {
  const isBookmarked = Boolean(progress?.bookmarked)
  const reps = progress?.fsrs?.reps ?? 0
  const cramCount = progress?.cramCount ?? 0
  const stateCode = progress?.fsrs?.state ?? 0
  const stateLabel = stateCode === 0 ? 'New' : stateCode === 1 ? 'Learning' : 'Review'

  return (
    <div
      onClick={onFlip}
      className="cursor-pointer select-none rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] p-6 shadow-sm min-h-[400px] flex flex-col justify-between transition-all duration-150 active:scale-[0.99] hover:border-[var(--border-subtle)]/90"
    >
      {/* Top Metadata Header */}
      <div>
        <div className="flex items-center justify-between gap-2 mb-4">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="px-2.5 py-0.5 text-xs font-[family-name:var(--font-display)] font-semibold rounded-md bg-[var(--bg-elevated)] text-[var(--accent-mint)] border border-[var(--border-subtle)]">
              {card.domain}
            </span>
            <span className="text-xs text-[var(--text-secondary)] flex items-center gap-1 font-medium px-2 py-0.5 rounded-md bg-[var(--bg-elevated)]/60">
              <Sparkles className="w-3 h-3 text-[var(--accent-mint)]" />
              {card.level}
            </span>
          </div>

          {/* Bookmark Star Button */}
          <button
            onClick={(e) => {
              e.stopPropagation()
              onToggleBookmark()
            }}
            className="p-1.5 rounded-lg hover:bg-[var(--bg-elevated)] text-[var(--text-secondary)] hover:text-amber-300 transition-colors"
            title={isBookmarked ? 'Remove Star (B)' : 'Star Card (B)'}
          >
            <Star
              className={`w-4 h-4 transition-colors ${
                isBookmarked ? 'fill-amber-300 text-amber-300' : ''
              }`}
            />
          </button>
        </div>

        {/* Term / Concept (Space Grotesk) */}
        <h2 className="font-[family-name:var(--font-display)] text-2xl sm:text-3xl font-bold tracking-tight text-[var(--text-primary)] mb-2">
          {card.term}
        </h2>
      </div>

      {/* Front Face Prompt vs Back Face Structured Content */}
      {!isFlipped ? (
        <div className="my-auto py-12 text-center space-y-2">
          <p className="text-sm text-[var(--text-secondary)] font-medium">
            Tap card or press <kbd className="px-1.5 py-0.5 text-xs rounded bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-[var(--text-primary)]">Space</kbd> to reveal breakdown
          </p>
        </div>
      ) : (
        <div className="space-y-4 pt-4 border-t border-[var(--border-subtle)] animate-in fade-in duration-150">
          {/* Block 1: WHAT IT IS */}
          <div>
            <p className="font-[family-name:var(--font-display)] text-xs uppercase tracking-wider text-[var(--accent-mint)] font-semibold mb-1">
              WHAT IT IS
            </p>
            <p className="text-sm text-[var(--text-primary)] leading-relaxed card-content-justified">
              {card.fields.whatItIs}
            </p>
          </div>

          {/* Block 2: PROBLEM SOLVED */}
          <div className="pt-3 border-t border-[var(--border-subtle)]">
            <p className="font-[family-name:var(--font-display)] text-xs uppercase tracking-wider text-[var(--accent-mint)] font-semibold mb-1">
              PROBLEM SOLVED
            </p>
            <p className="text-sm text-[var(--text-primary)] leading-relaxed card-content-justified">
              {card.fields.problemSolved}
            </p>
          </div>

          {/* Block 3: PRODUCTION CONTEXT */}
          <div className="pt-3 border-t border-[var(--border-subtle)]">
            <p className="font-[family-name:var(--font-display)] text-xs uppercase tracking-wider text-[var(--accent-mint)] font-semibold mb-1">
              PRODUCTION CONTEXT
            </p>
            <p className="text-sm text-[var(--text-primary)] leading-relaxed card-content-justified">
              {card.fields.productionContext}
            </p>
            {card.referenceUrl && (
              <a
                href={card.referenceUrl}
                target="_blank"
                rel="noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="inline-flex items-center gap-1.5 mt-2.5 px-2.5 py-1 rounded bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-xs text-[var(--accent-mint)] hover:underline"
              >
                <span>Reference Spec</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            )}
          </div>
        </div>
      )}

      {/* Card Footer Status */}
      <div className="pt-4 border-t border-[var(--border-subtle)] flex items-center justify-between text-xs text-[var(--text-secondary)]">
        <span>{cardIndexLabel || 'Card'}</span>
        <div className="flex items-center gap-3">
          {cramCount > 0 && <span>Practiced: {cramCount}×</span>}
          <span>Reps: {reps}</span>
          <span className="px-1.5 py-0.2 rounded bg-[var(--bg-elevated)] text-[11px] font-medium">
            {stateLabel}
          </span>
        </div>
      </div>
    </div>
  )
}
