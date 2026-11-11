import React from 'react'
import { Star, ExternalLink, Sparkles } from '@/components/ui/MaterialIcons'
import type { FlashcardItem, LocalCardProgress } from '@/types/schema'

interface FlashcardViewProps {
  card: FlashcardItem;
  progress: LocalCardProgress | null;
  isFlipped: boolean;
  onFlip?: () => void;
  onToggleBookmark?: () => void;
  cardIndexLabel?: string;
  className?: string;
  style?: React.CSSProperties;
}

export function FlashcardView({
  card,
  progress,
  isFlipped,
  onFlip,
  onToggleBookmark,
  cardIndexLabel,
  className = '',
  style,
}: FlashcardViewProps) {
  const isBookmarked = Boolean(progress?.bookmarked)
  const reps = progress?.fsrs?.reps ?? 0
  const cramCount = progress?.cramCount ?? 0
  const stateCode = progress?.fsrs?.state ?? 0
  const stateLabel = stateCode === 0 ? 'New' : stateCode === 1 ? 'Learning' : 'Review'

  return (
    <div
      onClick={onFlip}
      style={{
        boxShadow: 'var(--card-shadow)',
        touchAction: 'pan-y',
        ...style,
      }}
      className={`cursor-pointer select-none rounded-2xl bg-[var(--bg-card)] text-[var(--fg-card)] p-6 min-h-[420px] flex flex-col justify-between active:scale-[0.99] transition-transform duration-100 ${className}`}
    >
      {/* Top Metadata Header */}
      <div>
        <div className="flex items-center justify-between gap-2 mb-4">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="px-2.5 py-0.5 text-xs font-[family-name:var(--font-display)] font-semibold rounded-lg bg-[var(--fg-card)] text-[var(--bg-card)] shadow-xs">
              {card.domain}
            </span>
            <span className="text-xs flex items-center gap-1 font-medium px-2 py-0.5 rounded-lg bg-[var(--fg-card)] text-[var(--bg-card)] shadow-xs">
              <Sparkles className="w-3 h-3" />
              {card.level}
            </span>
          </div>

          {/* Bookmark Star Button */}
          {onToggleBookmark && (
            <button
              onClick={(e) => {
                e.stopPropagation()
                onToggleBookmark()
              }}
              onPointerDown={(e) => e.stopPropagation()}
              className="p-1.5 rounded-lg text-[var(--fg-card)] hover:opacity-80 transition-opacity"
              title={isBookmarked ? 'Remove Star (B)' : 'Star Card (B)'}
            >
              <Star
                className={`w-4 h-4 transition-all ${
                  isBookmarked ? 'fill-current' : ''
                }`}
              />
            </button>
          )}
        </div>

        {/* Term / Concept (Space Grotesk) */}
        <h2 className="font-[family-name:var(--font-display)] text-2xl sm:text-3xl font-bold tracking-tight text-[var(--fg-card)] mb-2">
          {card.term}
        </h2>
      </div>

      {/* Front Face Prompt vs Back Face Structured Content */}
      {!isFlipped ? (
        <div className="my-auto py-12 text-center space-y-2">
          <p className="text-sm font-medium text-[var(--fg-card)] opacity-85">
            Tap card to flip • Swipe right for next
          </p>
          <p className="text-xs opacity-70">
            or press <kbd className="px-2 py-0.5 text-xs rounded-md bg-[var(--fg-card)] text-[var(--bg-card)] font-bold shadow-xs">Space</kbd> to reveal breakdown
          </p>
        </div>
      ) : (
        <div className="space-y-5 pt-4 animate-in fade-in duration-150">
          {/* Block 1: WHAT IT IS */}
          <div className="space-y-1">
            <p className="font-[family-name:var(--font-display)] text-xs uppercase tracking-wider font-bold opacity-80">
              WHAT IT IS
            </p>
            <p className="text-sm text-[var(--fg-card)] leading-relaxed card-content-justified">
              {card.fields.whatItIs}
            </p>
          </div>

          {/* Block 2: PROBLEM SOLVED */}
          <div className="space-y-1 pt-1">
            <p className="font-[family-name:var(--font-display)] text-xs uppercase tracking-wider font-bold opacity-80">
              PROBLEM SOLVED
            </p>
            <p className="text-sm text-[var(--fg-card)] leading-relaxed card-content-justified">
              {card.fields.problemSolved}
            </p>
          </div>

          {/* Block 3: PRODUCTION CONTEXT */}
          <div className="space-y-1 pt-1">
            <p className="font-[family-name:var(--font-display)] text-xs uppercase tracking-wider font-bold opacity-80">
              PRODUCTION CONTEXT
            </p>
            <p className="text-sm text-[var(--fg-card)] leading-relaxed card-content-justified">
              {card.fields.productionContext}
            </p>
            {card.referenceUrl && (
              <a
                href={card.referenceUrl}
                target="_blank"
                rel="noreferrer"
                onClick={(e) => e.stopPropagation()}
                onPointerDown={(e) => e.stopPropagation()}
                className="inline-flex items-center gap-1.5 mt-2.5 px-3 py-1 rounded-lg bg-[var(--fg-card)] text-[var(--bg-card)] text-xs font-semibold shadow-xs hover:opacity-90 transition-opacity"
              >
                <span>Reference Spec</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            )}
          </div>
        </div>
      )}

      {/* Card Footer Status */}
      <div className="pt-5 flex items-center justify-between text-xs text-[var(--fg-card)] opacity-85">
        <span>{cardIndexLabel || 'Card'}</span>
        <div className="flex items-center gap-2.5">
          {cramCount > 0 && <span>Practiced: {cramCount}×</span>}
          <span>Reps: {reps}</span>
          <span className="px-2 py-0.5 rounded-md bg-[var(--fg-card)] text-[var(--bg-card)] text-[11px] font-bold shadow-xs">
            {stateLabel}
          </span>
        </div>
      </div>
    </div>
  )
}
