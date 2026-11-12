import React from 'react'
import { Star, ExternalLink, Sparkles } from '@/components/ui/MaterialIcons'
import type { FlashcardItem, LocalCardProgress } from '@/types/schema'
import { getStateLabel } from '@/lib/fsrs'

export interface FrontHint {
  primary: string;
  secondary?: string;
}

interface FlashcardViewProps {
  card: FlashcardItem;
  progress: LocalCardProgress | null;
  isFlipped: boolean;
  onFlip?: () => void;
  onToggleBookmark?: () => void;
  cardIndexLabel?: string;
  /** Gesture hint on the unrevealed face (depends on the study mode) */
  frontHint?: FrontHint;
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
  frontHint = { primary: 'Tap to reveal the answer' },
  className = '',
  style,
}: FlashcardViewProps) {
  const isBookmarked = Boolean(progress?.bookmarked)
  const reps = progress?.fsrs?.reps ?? 0
  const cramCount = progress?.cramCount ?? 0
  const stateLabel = getStateLabel(progress?.fsrs?.state)

  return (
    <div
      onClick={onFlip}
      style={{
        // Vertical scroll and pinch-zoom stay native; horizontal drags drive the swipe
        touchAction: 'pan-y pinch-zoom',
        ...style,
      }}
      className={`shadow-[var(--card-shadow)] h-full cursor-pointer select-none rounded-2xl bg-[var(--bg-card)] text-[var(--fg-card)] p-6 flex flex-col active:scale-[0.99] transition-transform duration-100 ${className}`}
    >
      {/* Top Metadata Header */}
      <div className="shrink-0">
        <div className="flex items-center justify-between gap-2 mb-4">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="px-2.5 py-0.5 text-xs font-semibold rounded-lg bg-[var(--fg-card)] text-[var(--bg-card)] shadow-xs">
              {card.domain}
            </span>
            <span className="text-xs flex items-center gap-1 font-medium px-2 py-0.5 rounded-lg bg-[var(--fg-card)] text-[var(--bg-card)] shadow-xs">
              <Sparkles className="w-3 h-3" />
              {card.level}
            </span>
          </div>

          {/* Bookmark Star Button: always rendered so every card has the same header height */}
          <button
            onClick={(e) => {
              e.stopPropagation()
              onToggleBookmark?.()
            }}
            onPointerDown={(e) => e.stopPropagation()}
            className="p-1.5 rounded-lg text-[var(--fg-card)] hover:opacity-80 transition-opacity"
            title={isBookmarked ? 'Remove Star (B)' : 'Star Card (B)'}
            aria-label={isBookmarked ? 'Remove star' : 'Star card'}
            aria-pressed={isBookmarked}
          >
            <Star
              className={`w-4 h-4 transition-all ${
                isBookmarked ? 'fill-current' : ''
              }`}
            />
          </button>
        </div>

        {/* Term / Concept */}
        <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-[var(--fg-card)] mb-2">
          {card.term}
        </h2>
      </div>

      {/* Body: fills the card and scrolls internally, so flipping never resizes the card */}
      <div className="card-scroll flex-1 min-h-0 flex flex-col overflow-y-auto overscroll-contain">
        {!isFlipped ? (
          <div className="my-auto py-8 text-center space-y-1.5">
            <p className="text-sm font-medium text-[var(--fg-card)] opacity-85">{frontHint.primary}</p>
            {frontHint.secondary && <p className="text-xs opacity-70">{frontHint.secondary}</p>}
          </div>
        ) : (
          <div className="space-y-5 pt-2 animate-fade-in">
            <CardAnswer card={card} />
          </div>
        )}
      </div>

      {/* Card Footer Status */}
      <div className="shrink-0 pt-4 flex items-center justify-between text-xs text-[var(--fg-card)] opacity-85">
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

/** The answer side of a card: the three explanation blocks plus the reference link */
export function CardAnswer({ card }: { card: FlashcardItem }) {
  return (
    <>
      {/* Block 1: WHAT IT IS */}
      <div className="space-y-1">
        <p className="text-xs uppercase tracking-wider font-bold opacity-80">
          WHAT IT IS
        </p>
        <p className="text-sm text-[var(--fg-card)] leading-relaxed card-content-justified">
          {card.fields.whatItIs}
        </p>
      </div>

      {/* Block 2: PROBLEM SOLVED */}
      <div className="space-y-1 pt-1">
        <p className="text-xs uppercase tracking-wider font-bold opacity-80">
          PROBLEM SOLVED
        </p>
        <p className="text-sm text-[var(--fg-card)] leading-relaxed card-content-justified">
          {card.fields.problemSolved}
        </p>
      </div>

      {/* Block 3: PRODUCTION CONTEXT */}
      <div className="space-y-1 pt-1">
        <p className="text-xs uppercase tracking-wider font-bold opacity-80">
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
    </>
  )
}
