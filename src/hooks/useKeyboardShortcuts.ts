import { useEffect } from 'react'
import type { SlideDirection } from '@/components/study/CardSlider'

interface KeyboardShortcutsOptions {
  isFlipped: boolean;
  mode: 'due' | 'cram';
  onFlip: () => void;
  onGradeDue?: (rating: 1 | 2 | 3 | 4) => void;
  onGradeCram?: (gotIt: boolean) => void;
  /** Arrow keys mirror the swipes: ↑ pass, ↓ miss, → next card, ← previous card */
  onSwipe?: (direction: SlideDirection) => void;
  onUndo?: () => void;
  onBookmark?: () => void;
  enabled?: boolean;
}

const ARROW_SWIPES: Partial<Record<string, SlideDirection>> = {
  ArrowUp: 'up',
  ArrowDown: 'down',
  ArrowRight: 'right-to-left',
  ArrowLeft: 'left-to-right',
}

export function useKeyboardShortcuts({
  isFlipped,
  mode,
  onFlip,
  onGradeDue,
  onGradeCram,
  onSwipe,
  onUndo,
  onBookmark,
  enabled = true,
}: KeyboardShortcutsOptions) {
  useEffect(() => {
    if (!enabled) return

    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't intercept when user is typing in inputs or textareas
      const target = e.target as HTMLElement | null
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.isContentEditable ||
          target.closest('[role="dialog"]'))
      ) {
        return
      }

      // Space or Enter to flip front face
      if (e.code === 'Space' || e.key === 'Enter') {
        if (!isFlipped) {
          e.preventDefault()
          onFlip()
          return
        }
      }

      // Arrow keys mirror the swipe gestures (→ is a left swipe, bringing in the next card)
      const arrowSwipe = ARROW_SWIPES[e.key]
      if (arrowSwipe) {
        e.preventDefault()
        onSwipe?.(arrowSwipe)
        return
      }

      // Undo shortcut: 'u' or 'U'
      if (e.key === 'u' || e.key === 'U') {
        e.preventDefault()
        onUndo?.()
        return
      }

      // Bookmark shortcut: 'b' or 'B'
      if (e.key === 'b' || e.key === 'B') {
        e.preventDefault()
        onBookmark?.()
        return
      }

      // Grading shortcuts when back is revealed
      if (isFlipped) {
        if (mode === 'due' && onGradeDue) {
          if (e.key === '1') {
            e.preventDefault()
            onGradeDue(1)
          } else if (e.key === '2') {
            e.preventDefault()
            onGradeDue(2)
          } else if (e.key === '3') {
            e.preventDefault()
            onGradeDue(3)
          } else if (e.key === '4') {
            e.preventDefault()
            onGradeDue(4)
          }
        } else if (mode === 'cram' && onGradeCram) {
          if (e.key === '1') {
            e.preventDefault()
            onGradeCram(false) // Still Shaky
          } else if (e.key === '2' || e.key === 'Enter' || e.code === 'Space') {
            e.preventDefault()
            onGradeCram(true) // Got It
          }
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [enabled, isFlipped, mode, onFlip, onGradeDue, onGradeCram, onSwipe, onUndo, onBookmark])
}
