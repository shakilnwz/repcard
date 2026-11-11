import { useState, useCallback } from 'react'
import {
  getAllProgress,
  saveCardProgress,
  getCardProgress,
} from '@/lib/storage'
import {
  createDefaultFsrsCard,
  gradeFsrsCard,
  serializeFsrsCard,
  deserializeFsrsCard,
  type ValidRating,
  type FsrsCard,
} from '@/lib/fsrs'
import type { LocalCardProgress } from '@/types/schema'

interface UndoRecord {
  key: string;
  previousProgress: LocalCardProgress | null;
}

export function useCardProgress() {
  const [progressState, setProgressState] = useState<Record<string, LocalCardProgress>>(() =>
    getAllProgress(),
  )
  const [undoStack, setUndoStack] = useState<UndoRecord[]>([])

  // Get or initialize progress for a card
  const getCardProgressData = useCallback(
    (compositeKey: string, libraryId: string, cardId: string): LocalCardProgress => {
      const existing = progressState[compositeKey] || getCardProgress(compositeKey)
      if (existing) return existing

      const emptyFsrs = createDefaultFsrsCard()
      return {
        key: compositeKey,
        libraryId,
        cardId,
        fsrs: serializeFsrsCard(emptyFsrs),
        cramCount: 0,
        bookmarked: false,
        lastRatedAt: new Date().toISOString(),
      }
    },
    [progressState],
  )

  // Get deserialized FSRS card instance
  const getFsrsCard = useCallback(
    (compositeKey: string, libraryId: string, cardId: string): FsrsCard => {
      const data = getCardProgressData(compositeKey, libraryId, cardId)
      return deserializeFsrsCard(data.fsrs)
    },
    [getCardProgressData],
  )

  // Grade card in Spaced Repetition Due Mode
  const gradeCardDue = useCallback(
    (compositeKey: string, libraryId: string, cardId: string, rating: ValidRating) => {
      const currentProgress = getCardProgressData(compositeKey, libraryId, cardId)
      const currentFsrs = deserializeFsrsCard(currentProgress.fsrs)

      // Grade using FSRS
      const recordItem = gradeFsrsCard(currentFsrs, rating)
      const nextFsrs = recordItem.card

      const nextProgress: LocalCardProgress = {
        ...currentProgress,
        fsrs: serializeFsrsCard(nextFsrs),
        lastRatedAt: new Date().toISOString(),
      }

      // Record for undo
      setUndoStack((prev) => [...prev, { key: compositeKey, previousProgress: currentProgress }])

      // Persist
      saveCardProgress(nextProgress)
      setProgressState((prev) => ({ ...prev, [compositeKey]: nextProgress }))

      return nextProgress
    },
    [getCardProgressData],
  )

  // Record practice in Cram Mode
  const recordCramPractice = useCallback(
    (compositeKey: string, libraryId: string, cardId: string) => {
      const currentProgress = getCardProgressData(compositeKey, libraryId, cardId)
      const nextProgress: LocalCardProgress = {
        ...currentProgress,
        cramCount: (currentProgress.cramCount || 0) + 1,
        lastRatedAt: new Date().toISOString(),
      }

      setUndoStack((prev) => [...prev, { key: compositeKey, previousProgress: currentProgress }])
      saveCardProgress(nextProgress)
      setProgressState((prev) => ({ ...prev, [compositeKey]: nextProgress }))

      return nextProgress
    },
    [getCardProgressData],
  )

  // Toggle bookmark / starred state
  const toggleBookmark = useCallback(
    (compositeKey: string, libraryId: string, cardId: string) => {
      const currentProgress = getCardProgressData(compositeKey, libraryId, cardId)
      const nextProgress: LocalCardProgress = {
        ...currentProgress,
        bookmarked: !currentProgress.bookmarked,
      }

      saveCardProgress(nextProgress)
      setProgressState((prev) => ({ ...prev, [compositeKey]: nextProgress }))
    },
    [getCardProgressData],
  )

  // 1-step undo
  const undoLastAction = useCallback((): string | null => {
    if (undoStack.length === 0) return null

    const last = undoStack[undoStack.length - 1]
    setUndoStack((prev) => prev.slice(0, -1))

    if (last.previousProgress) {
      saveCardProgress(last.previousProgress)
      setProgressState((prev) => ({ ...prev, [last.key]: last.previousProgress! }))
    }

    return last.key
  }, [undoStack])

  return {
    progressState,
    getCardProgressData,
    getFsrsCard,
    gradeCardDue,
    recordCramPractice,
    toggleBookmark,
    undoLastAction,
    canUndo: undoStack.length > 0,
  }
}
