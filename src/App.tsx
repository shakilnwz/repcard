import { useState, useMemo, useCallback } from 'react'
import { CheckCircle2 } from 'lucide-react'
import { useLibraries } from '@/hooks/useLibraries'
import { useCardProgress } from '@/hooks/useCardProgress'
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts'
import { AppHeader, type StudyMode } from '@/components/layout/AppHeader'
import { FilterBar, type CramFilter } from '@/components/study/FilterBar'
import { FlashcardView } from '@/components/study/FlashcardView'
import { RatingBar } from '@/components/study/RatingBar'
import { LibraryDrawer } from '@/components/libraries/LibraryDrawer'
import { getIntervalPreviews, Rating, type ValidRating } from '@/lib/fsrs'
import { makeCardCompositeKey } from '@/types/schema'
import { STARTER_LIBRARY_ID } from '@/lib/starterDeck'

export default function App() {
  const {
    libraries,
    activeCards,
    cardsByLibrary,
    syncingMap,
    pendingImport,
    addLibrary,
    toggleLibraryEnabled,
    syncLibrary,
    syncAll,
    removeLibrary,
    confirmPendingImport,
    dismissPendingImport,
  } = useLibraries()

  const {
    progressState,
    getCardProgressData,
    getFsrsCard,
    gradeCardDue,
    recordCramPractice,
    toggleBookmark,
    undoLastAction,
    canUndo,
  } = useCardProgress()

  const [mode, setMode] = useState<StudyMode>('due')
  const [cramFilter, setCramFilter] = useState<CramFilter>('all')
  const [drawerOpen, setDrawerOpen] = useState(() => Boolean(pendingImport))
  const [currentIndex, setCurrentIndex] = useState(0)
  const [isFlipped, setIsFlipped] = useState(false)
  const [countTowardSrsInCram, setCountTowardSrsInCram] = useState(false)

  const [sessionNow, setSessionNow] = useState(() => Date.now())

  // Helper to determine which library contains a card
  const getCardLibraryId = useCallback(
    (cardId: string) => {
      for (const [libId, cards] of Object.entries(cardsByLibrary)) {
        if (cards.some((c) => c.id === cardId)) {
          return libId
        }
      }
      return STARTER_LIBRARY_ID
    },
    [cardsByLibrary],
  )

  // 1. Compute Due Cards Queue
  const dueCards = useMemo(() => {
    return activeCards.filter((card) => {
      const libId = getCardLibraryId(card.id)
      const key = makeCardCompositeKey(libId, card.id)
      const prog = progressState[key]
      if (!prog) return true // Unreviewed / New cards are due immediately
      return new Date(prog.fsrs.due).getTime() <= sessionNow
    })
  }, [activeCards, progressState, sessionNow, getCardLibraryId])

  // 2. Compute Cram Cards Queue based on active filter
  const filteredCramCards = useMemo(() => {
    return activeCards.filter((card) => {
      const libId = getCardLibraryId(card.id)
      const key = makeCardCompositeKey(libId, card.id)
      const prog = progressState[key]

      if (cramFilter === 'all') return true
      if (cramFilter === 'high') return card.level.toLowerCase().includes('high')
      if (cramFilter === 'low') return card.level.toLowerCase().includes('low')
      if (cramFilter === 'bookmarked') return Boolean(prog?.bookmarked)
      if (cramFilter === 'hardest') {
        const difficulty = prog?.fsrs?.difficulty ?? 0
        const lapses = prog?.fsrs?.lapses ?? 0
        return difficulty >= 5 || lapses >= 1
      }
      return true
    })
  }, [activeCards, progressState, cramFilter, getCardLibraryId])

  // Cram filter counts for badges
  const cramFilterCounts = useMemo<Record<CramFilter, number>>(() => {
    let high = 0
    let low = 0
    let bookmarked = 0
    let hardest = 0

    for (const card of activeCards) {
      const libId = getCardLibraryId(card.id)
      const key = makeCardCompositeKey(libId, card.id)
      const prog = progressState[key]

      if (card.level.toLowerCase().includes('high')) high++
      if (card.level.toLowerCase().includes('low')) low++
      if (prog?.bookmarked) bookmarked++
      if ((prog?.fsrs?.difficulty ?? 0) >= 5 || (prog?.fsrs?.lapses ?? 0) >= 1) hardest++
    }

    return {
      all: activeCards.length,
      high,
      low,
      bookmarked,
      hardest,
    }
  }, [activeCards, progressState, getCardLibraryId])

  // Active study deck according to selected mode
  const currentDeck = mode === 'due' ? dueCards : filteredCramCards

  // Safe clamped index
  const safeIndex = currentIndex >= currentDeck.length && currentDeck.length > 0 ? 0 : currentIndex
  const currentCard = currentDeck[safeIndex] || null

  const currentLibraryId = currentCard ? getCardLibraryId(currentCard.id) : STARTER_LIBRARY_ID
  const currentKey = currentCard ? makeCardCompositeKey(currentLibraryId, currentCard.id) : ''
  const currentProgress = currentKey ? getCardProgressData(currentKey, currentLibraryId, currentCard?.id || '') : null
  const currentFsrs = currentKey ? getFsrsCard(currentKey, currentLibraryId, currentCard?.id || '') : null

  // Calculate live next interval previews for Due mode
  const intervalPreviews = useMemo(() => {
    if (!currentFsrs) return undefined
    return getIntervalPreviews(currentFsrs)
  }, [currentFsrs])

  // Handle Due Mode Rating
  const handleGradeDue = useCallback(
    (rating: ValidRating) => {
      if (!currentCard || !currentKey) return
      gradeCardDue(currentKey, currentLibraryId, currentCard.id, rating)
      setSessionNow(Date.now())
      setIsFlipped(false)

      if (currentDeck.length > 1) {
        setCurrentIndex((prev) => (prev + 1) % currentDeck.length)
      }
    },
    [currentCard, currentKey, currentLibraryId, currentDeck.length, gradeCardDue],
  )

  // Handle Cram Mode Practice
  const handleGradeCram = useCallback(
    (gotIt: boolean) => {
      if (!currentCard || !currentKey) return

      recordCramPractice(currentKey, currentLibraryId, currentCard.id)

      if (countTowardSrsInCram) {
        gradeCardDue(currentKey, currentLibraryId, currentCard.id, gotIt ? Rating.Good : Rating.Again)
      }

      setIsFlipped(false)
      if (currentDeck.length > 1) {
        setCurrentIndex((prev) => (prev + 1) % currentDeck.length)
      }
    },
    [
      currentCard,
      currentKey,
      currentLibraryId,
      currentDeck.length,
      countTowardSrsInCram,
      recordCramPractice,
      gradeCardDue,
    ],
  )

  // Handle Bookmark Toggle
  const handleToggleBookmark = useCallback(() => {
    if (!currentCard || !currentKey) return
    toggleBookmark(currentKey, currentLibraryId, currentCard.id)
  }, [currentCard, currentKey, currentLibraryId, toggleBookmark])

  // Handle Undo
  const handleUndo = useCallback(() => {
    const undoneKey = undoLastAction()
    if (!undoneKey) return

    setIsFlipped(false)
    const prevIdx = currentDeck.findIndex(
      (c) => makeCardCompositeKey(getCardLibraryId(c.id), c.id) === undoneKey,
    )
    if (prevIdx !== -1) {
      setCurrentIndex(prevIdx)
    }
  }, [undoLastAction, currentDeck, getCardLibraryId])

  // Keyboard Shortcuts Hook
  useKeyboardShortcuts({
    isFlipped,
    mode,
    onFlip: () => setIsFlipped((prev) => !prev),
    onGradeDue: (grade) => handleGradeDue(grade as ValidRating),
    onGradeCram: handleGradeCram,
    onUndo: handleUndo,
    onBookmark: handleToggleBookmark,
    enabled: Boolean(currentCard),
  })

  const isStarterOnly = libraries.length === 1 && libraries[0].id === STARTER_LIBRARY_ID
  const isSyncing = Object.values(syncingMap).some(Boolean)
  const activeLibsCount = libraries.filter((l) => l.enabled).length

  return (
    <div className="min-h-dvh bg-[var(--bg-canvas)] text-[var(--text-primary)] font-[family-name:var(--font-body)] flex flex-col justify-between max-w-lg mx-auto px-4 py-4">
      {/* Top Header */}
      <AppHeader
        mode={mode}
        onModeChange={(newMode) => {
          setMode(newMode)
          setCurrentIndex(0)
          setIsFlipped(false)
        }}
        dueCount={dueCards.length}
        totalCards={activeCards.length}
        canUndo={canUndo}
        onUndo={handleUndo}
        activeLibrariesCount={activeLibsCount}
        isSyncing={isSyncing}
        onOpenLibraries={() => setDrawerOpen(true)}
      />

      {/* Cram Mode Filter Pills */}
      {mode === 'cram' && (
        <div className="mt-3">
          <FilterBar
            currentFilter={cramFilter}
            onFilterChange={(f) => {
              setCramFilter(f)
              setCurrentIndex(0)
              setIsFlipped(false)
            }}
            counts={cramFilterCounts}
          />
        </div>
      )}

      {/* Starter Deck Reminder Banner */}
      {isStarterOnly && (
        <div className="mt-3 p-2.5 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] flex items-center justify-between gap-2 text-xs">
          <span className="text-[var(--text-secondary)] truncate">
            Using built-in starter deck.
          </span>
          <button
            onClick={() => setDrawerOpen(true)}
            className="shrink-0 font-[family-name:var(--font-display)] font-semibold text-[var(--accent-mint)] hover:underline"
          >
            + Add Your Endpoint
          </button>
        </div>
      )}

      {/* Main Flashcard View */}
      <main className="my-auto py-4">
        {currentCard ? (
          <FlashcardView
            card={currentCard}
            progress={currentProgress}
            isFlipped={isFlipped}
            onFlip={() => setIsFlipped((prev) => !prev)}
            onToggleBookmark={handleToggleBookmark}
            cardIndexLabel={`Card ${safeIndex + 1} of ${currentDeck.length}${
              mode === 'due' ? ' (Due)' : ' (Practice)'
            }`}
          />
        ) : (
          <div className="p-8 rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-center space-y-4">
            <div className="w-12 h-12 rounded-full bg-[var(--bg-elevated)] border border-[var(--border-subtle)] flex items-center justify-center mx-auto text-[var(--accent-mint)]">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-[family-name:var(--font-display)] text-lg font-bold text-[var(--text-primary)]">
                {mode === 'due' ? 'Queue Completed!' : 'No Cards Found'}
              </h3>
              <p className="text-xs text-[var(--text-secondary)] mt-1 max-w-xs mx-auto">
                {mode === 'due'
                  ? 'All due cards have been reviewed for now. Switch to Practice Anytime to cram without affecting your schedule.'
                  : 'No cards matched your current filter criteria.'}
              </p>
            </div>
            {mode === 'due' ? (
              <button
                onClick={() => {
                  setMode('cram')
                  setCurrentIndex(0)
                  setIsFlipped(false)
                }}
                className="py-2.5 px-4 rounded-xl bg-[var(--accent-mint)] text-[var(--accent-mint-fg)] font-[family-name:var(--font-display)] text-xs font-bold hover:opacity-90 transition-opacity"
              >
                Switch to Practice Mode
              </button>
            ) : (
              <button
                onClick={() => setCramFilter('all')}
                className="py-2.5 px-4 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-xs font-semibold text-[var(--accent-mint)]"
              >
                Reset Filters
              </button>
            )}
          </div>
        )}
      </main>

      {/* Bottom Rating Bar */}
      <RatingBar
        isFlipped={isFlipped}
        mode={mode}
        intervalPreviews={intervalPreviews}
        onGradeDue={handleGradeDue}
        onGradeCram={handleGradeCram}
        countTowardSrs={countTowardSrsInCram}
        onToggleCountTowardSrs={() => setCountTowardSrsInCram((prev) => !prev)}
      />

      {/* Library Drawer */}
      <LibraryDrawer
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        libraries={libraries}
        syncingMap={syncingMap}
        pendingImport={pendingImport}
        reviewedCardsCount={Object.keys(progressState).length}
        onAddLibrary={addLibrary}
        onToggleEnabled={toggleLibraryEnabled}
        onSyncLibrary={syncLibrary}
        onSyncAll={syncAll}
        onRemoveLibrary={removeLibrary}
        onConfirmPendingImport={confirmPendingImport}
        onDismissPendingImport={dismissPendingImport}
        onRestoreComplete={() => window.location.reload()}
      />
    </div>
  )
}
