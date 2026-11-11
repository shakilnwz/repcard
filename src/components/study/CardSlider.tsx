import { useState, useRef } from 'react'
import type { FlashcardItem, LocalCardProgress } from '@/types/schema'
import { FlashcardView } from './FlashcardView'

interface CardSliderProps {
  currentCard: FlashcardItem;
  nextCard: FlashcardItem | null;
  currentProgress: LocalCardProgress | null;
  nextProgress: LocalCardProgress | null;
  isFlipped: boolean;
  onFlip: () => void;
  onToggleBookmark: () => void;
  onSwipeAdvance: (direction: 'left-to-right' | 'right-to-left') => void;
  isSliding: boolean;
  slideDirection: 'left-to-right' | 'right-to-left';
  currentCardIndexLabel: string;
  nextCardIndexLabel: string;
}

export function CardSlider({
  currentCard,
  nextCard,
  currentProgress,
  nextProgress,
  isFlipped,
  onFlip,
  onToggleBookmark,
  onSwipeAdvance,
  isSliding,
  slideDirection,
  currentCardIndexLabel,
  nextCardIndexLabel,
}: CardSliderProps) {
  const [dragOffset, setDragOffset] = useState(0)
  const [isDragging, setIsDragging] = useState(false)
  const [isSnappingBack, setIsSnappingBack] = useState(false)

  const dragStartXRef = useRef(0)
  const dragStartYRef = useRef(0)
  const startTimeRef = useRef(0)
  const isPointerDownRef = useRef(false)
  const hasDeterminedAxisRef = useRef(false)
  const isLockedVerticalRef = useRef(false)
  const isDraggingRef = useRef(false)

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    // If clicking on interactive controls (buttons, links), don't engage drag
    if ((e.target as HTMLElement).closest('button, a, input')) return
    if (isSliding || isSnappingBack) return

    dragStartXRef.current = e.clientX
    dragStartYRef.current = e.clientY
    startTimeRef.current = Date.now()
    isPointerDownRef.current = true
    hasDeterminedAxisRef.current = false
    isLockedVerticalRef.current = false
    isDraggingRef.current = false
    setDragOffset(0)
  }

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isPointerDownRef.current || isSliding || isSnappingBack) return

    const deltaX = e.clientX - dragStartXRef.current
    const deltaY = e.clientY - dragStartYRef.current

    if (!hasDeterminedAxisRef.current) {
      if (Math.abs(deltaX) > 6 || Math.abs(deltaY) > 6) {
        hasDeterminedAxisRef.current = true
        if (Math.abs(deltaY) > Math.abs(deltaX)) {
          // Primarily vertical movement: release to native document scroll
          isLockedVerticalRef.current = true
          return
        }
        // Horizontal movement: capture pointer and drag cards
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

    setDragOffset(deltaX)
  }

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isPointerDownRef.current) return
    isPointerDownRef.current = false

    try {
      e.currentTarget.releasePointerCapture(e.pointerId)
    } catch {
      // Ignore release error
    }

    const deltaX = e.clientX - dragStartXRef.current
    const deltaY = e.clientY - dragStartYRef.current
    const elapsed = Date.now() - startTimeRef.current

    if (isDraggingRef.current) {
      isDraggingRef.current = false
      setIsDragging(false)

      const isFlick = elapsed < 260 && Math.abs(deltaX) > 35
      const isCommitted = Math.abs(deltaX) > 60 || isFlick

      if (isCommitted) {
        // Drag > 0 is left-to-right (moving right); Drag < 0 is right-to-left (moving left)
        const direction: 'left-to-right' | 'right-to-left' = deltaX > 0 ? 'left-to-right' : 'right-to-left'
        setDragOffset(0)
        onSwipeAdvance(direction)
      } else {
        // Snap back to 0
        setIsSnappingBack(true)
        setDragOffset(0)
        setTimeout(() => setIsSnappingBack(false), 180)
      }
    } else {
      // Tap detected (minimal movement)
      if (!hasDeterminedAxisRef.current && Math.abs(deltaX) < 8 && Math.abs(deltaY) < 8 && elapsed < 350) {
        onFlip()
      }
    }
  }

  const handlePointerCancel = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isPointerDownRef.current) return
    isPointerDownRef.current = false
    try {
      e.currentTarget.releasePointerCapture(e.pointerId)
    } catch {
      // Ignore release error
    }
    isDraggingRef.current = false
    setIsDragging(false)
    setDragOffset(0)
  }

  // Determine rendering modes
  const isDualCardActive = isSliding || isDragging || isSnappingBack
  const incomingCard = nextCard || currentCard

  // Circular rotary track physics (pinned in a huge circle)
  const ROTATE_MAX = 8 // degrees
  const DROP_MAX = 16 // pixels

  // Compute Card Styles
  let currentCardStyle: React.CSSProperties = {
    touchAction: 'pan-y',
    transformOrigin: '50% 130%',
  }
  let currentCardClass = ''

  let incomingCardStyle: React.CSSProperties = {
    position: 'absolute',
    inset: 0,
    width: '100%',
    height: '100%',
    touchAction: 'pan-y',
    transformOrigin: '50% 130%',
  }
  let incomingCardClass = ''

  if (isSliding) {
    if (slideDirection === 'left-to-right') {
      currentCardClass = 'animate-slide-out-right'
      incomingCardClass = 'animate-slide-in-left'
    } else {
      currentCardClass = 'animate-slide-out-left'
      incomingCardClass = 'animate-slide-in-right'
    }
  } else if (isDragging) {
    const progress = Math.min(Math.max(dragOffset / 360, -1), 1)
    const currentAngle = progress * ROTATE_MAX
    const currentDrop = Math.abs(progress) * DROP_MAX

    currentCardStyle = {
      ...currentCardStyle,
      transform: `translate3d(${dragOffset}px, ${currentDrop}px, 0) rotate(${currentAngle}deg)`,
      transition: 'none',
    }

    if (dragOffset > 0) {
      // Incoming from left
      const incomingAngle = -ROTATE_MAX + progress * ROTATE_MAX
      const incomingDrop = Math.max(0, DROP_MAX - progress * DROP_MAX)
      incomingCardStyle = {
        ...incomingCardStyle,
        transform: `translate3d(calc(-100% + ${dragOffset}px), ${incomingDrop}px, 0) rotate(${incomingAngle}deg)`,
        transition: 'none',
      }
    } else {
      // Incoming from right
      const incomingAngle = ROTATE_MAX + progress * ROTATE_MAX
      const incomingDrop = Math.max(0, DROP_MAX - Math.abs(progress) * DROP_MAX)
      incomingCardStyle = {
        ...incomingCardStyle,
        transform: `translate3d(calc(100% + ${dragOffset}px), ${incomingDrop}px, 0) rotate(${incomingAngle}deg)`,
        transition: 'none',
      }
    }
  } else if (isSnappingBack) {
    currentCardStyle = {
      ...currentCardStyle,
      transform: 'translate3d(0, 0, 0) rotate(0deg)',
      transition: 'transform 200ms cubic-bezier(0.16, 1, 0.3, 1)',
    }
    const incomingTranslateX = dragOffset > 0 ? '-100%' : '100%'
    const incomingAngle = dragOffset > 0 ? -ROTATE_MAX : ROTATE_MAX
    incomingCardStyle = {
      ...incomingCardStyle,
      transform: `translate3d(${incomingTranslateX}, ${DROP_MAX}px, 0) rotate(${incomingAngle}deg)`,
      transition: 'transform 200ms cubic-bezier(0.16, 1, 0.3, 1)',
    }
  }

  return (
    <div
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerCancel}
      className="relative w-full overflow-hidden py-2 min-h-[440px] select-none rounded-2xl will-change-transform"
    >
      {/* Current Active Card */}
      <div style={currentCardStyle} className={`w-full ${currentCardClass}`}>
        <FlashcardView
          card={currentCard}
          progress={currentProgress}
          isFlipped={isFlipped}
          onToggleBookmark={onToggleBookmark}
          cardIndexLabel={currentCardIndexLabel}
        />
      </div>

      {/* Incoming / Next Card (Simultaneously slides in during transition) */}
      {isDualCardActive && (
        <div style={incomingCardStyle} className={`w-full ${incomingCardClass}`}>
          <FlashcardView
            card={incomingCard}
            progress={nextProgress}
            isFlipped={false}
            cardIndexLabel={nextCardIndexLabel}
          />
        </div>
      )}
    </div>
  )
}
