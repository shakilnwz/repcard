import { useEffect } from 'react'

interface KeyboardShortcutsOptions {
  isFlipped: boolean;
  mode: 'due' | 'cram';
  onFlip: () => void;
  onGradeDue?: (rating: 1 | 2 | 3 | 4) => void;
  onGradeCram?: (gotIt: boolean) => void;
  onUndo?: () => void;
  onBookmark?: () => void;
  enabled?: boolean;
}

export function useKeyboardShortcuts({
  isFlipped,
  mode,
  onFlip,
  onGradeDue,
  onGradeCram,
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

      // Undo shortcut: 'u' or 'U' or 'z'
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
  }, [enabled, isFlipped, mode, onFlip, onGradeDue, onGradeCram, onUndo, onBookmark])
}
