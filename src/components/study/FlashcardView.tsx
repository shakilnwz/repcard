import { useState, useRef } from 'react'
import { Star, ExternalLink, Sparkles } from 'lucide-react'
import type { FlashcardItem, LocalCardProgress } from '@/types/schema'

interface FlashcardViewProps {
  card: FlashcardItem;
  progress: LocalCardProgress | null;
  isFlipped: boolean;
  onFlip: () => void;
  onToggleBookmark: () => void;
  onSwipeNext?: () => void;
  cardIndexLabel?: string;
  isExiting?: boolean;
}

export function FlashcardView({
  card,
  progress,
  isFlipped,
  onFlip,
  onToggleBookmark,
  onSwipeNext,
  cardIndexLabel,
  isExiting,
}: FlashcardViewProps) {
  const isBookmarked = Boolean(progress?.bookmarked)
  const reps = progress?.fsrs?.reps ?? 0
  const cramCount = progress?.cramCount ?? 0
  const stateCode = progress?.fsrs?.state ?? 0
  const stateLabel = stateCode === 0 ? 'New' : stateCode === 1 ? 'Learning' : 'Review'

  const [dragX, setDragX] = useState(0)
  const [isDragging, setIsDragging] = useState(false)
  const [isLocalExiting, setIsLocalExiting] = useState(false)

  const pointerStartXRef = useRef(0)
  const pointerStartYRef = useRef(0)
  const pointerStartTimeRef = useRef(0)
  const isDraggingRef = useRef(false)
  const hasMovedRef = useRef(false)
  const isLockedVerticalRef = useRef(false)

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).closest('button, a')) return
    if (isExiting || isLocalExiting) return

    pointerStartXRef.current = e.clientX
    pointerStartYRef.current = e.clientY
    pointerStartTimeRef.current = Date.now()
    isDraggingRef.current = false
    hasMovedRef.current = false
    isLockedVerticalRef.current = false
    setDragX(0)
  }

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (isExiting || isLocalExiting) return

    const deltaX = e.clientX - pointerStartXRef.current
    const deltaY = e.clientY - pointerStartYRef.current

    if (!hasMovedRef.current) {
      if (Math.abs(deltaX) > 6 || Math.abs(deltaY) > 6) {
        hasMovedRef.current = true
        if (Math.abs(deltaY) > Math.abs(deltaX)) {
          isLockedVerticalRef.current = true
          return
        }
        isDraggingRef.current = true
        setIsDragging(true)
        try {
          e.currentTarget.setPointerCapture(e.pointerId)
        } catch {
          // Ignore capture error
        }
      } else {
        return
      }
    }

    if (isLockedVerticalRef.current || !isDraggingRef.current) return

    // Swipe left-to-right: allow rightward drag, rubber-band leftward drag
    const effectiveX = deltaX > 0 ? deltaX : deltaX * 0.18
    setDragX(effectiveX)
  }

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (isExiting || isLocalExiting) return

    const deltaX = e.clientX - pointerStartXRef.current
    const deltaY = e.clientY - pointerStartYRef.current
    const elapsed = Date.now() - pointerStartTimeRef.current

    try {
      e.currentTarget.releasePointerCapture(e.pointerId)
    } catch {
      // Ignore release error
    }

    const wasDragging = isDraggingRef.current
    isDraggingRef.current = false
    setIsDragging(false)

    // Tap detected
    if (!wasDragging && !hasMovedRef.current && Math.abs(deltaX) < 10 && Math.abs(deltaY) < 10 && elapsed < 400) {
      setDragX(0)
      onFlip()
      return
    }

    if (!wasDragging) return

    // Swipe left-to-right: threshold > 70px or fast flick
    const isFlick = elapsed < 280 && deltaX > 45
    if (deltaX > 70 || isFlick) {
      if (onSwipeNext) {
        setIsLocalExiting(true)
        setTimeout(() => {
          onSwipeNext()
          setIsLocalExiting(false)
          setDragX(0)
        }, 180)
      } else {
        setDragX(0)
      }
    } else {
      setDragX(0)
    }
  }

  const handlePointerCancel = (e: React.PointerEvent<HTMLDivElement>) => {
    try {
      e.currentTarget.releasePointerCapture(e.pointerId)
    } catch {
      // Ignore release error
    }
    isDraggingRef.current = false
    setIsDragging(false)
    setDragX(0)
  }

  // Determine active animation / transform
  let animationClass = ''
  let dynamicStyle: React.CSSProperties = {
    boxShadow: 'var(--card-shadow)',
    touchAction: 'pan-y',
  }

  if (isExiting) {
    animationClass = 'animate-card-exit-right'
  } else if (isLocalExiting) {
    dynamicStyle = {
      ...dynamicStyle,
      transform: 'translate3d(120%, 0, 0) rotate(6deg)',
      opacity: 0,
      transition: 'transform 180ms cubic-bezier(0.32, 0, 0.67, 0), opacity 180ms ease-out',
      pointerEvents: 'none',
    }
  } else if (isDragging) {
    dynamicStyle = {
      ...dynamicStyle,
      transform: `translate3d(${dragX}px, 0, 0) rotate(${dragX * 0.04}deg)`,
      opacity: 1 - Math.min(Math.max(dragX, 0) / 450, 0.35),
      transition: 'none',
    }
  } else if (dragX !== 0) {
    dynamicStyle = {
      ...dynamicStyle,
      transform: 'translate3d(0, 0, 0) rotate(0deg)',
      opacity: 1,
      transition: 'transform 200ms cubic-bezier(0.16, 1, 0.3, 1), opacity 200ms ease',
    }
  } else {
    animationClass = 'animate-card-enter-left'
  }

  return (
    <div
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerCancel}
      style={dynamicStyle}
      className={`cursor-pointer select-none rounded-2xl bg-[var(--bg-card)] text-[var(--fg-card)] p-6 min-h-[400px] flex flex-col justify-between active:scale-[0.99] will-change-transform ${animationClass}`}
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
