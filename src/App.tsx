import { useState, useMemo, useCallback, useEffect, useRef } from 'react'
import { CheckCircle2 } from '@/components/ui/MaterialIcons'
import { useLibraries } from '@/hooks/useLibraries'
import { useCardProgress } from '@/hooks/useCardProgress'
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts'
import { AppHeader, type StudyMode, type ColorPaletteMode } from '@/components/layout/AppHeader'
import type { CramFilter } from '@/components/study/FilterBar'
import { CardSlider } from '@/components/study/CardSlider'
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
  const [colorMode, setColorMode] = useState<ColorPaletteMode>('default')

  // Apply color mode to document root
  useEffect(() => {
    if (colorMode === 'default') {
      document.documentElement.removeAttribute('data-color-mode')
    } else {
      document.documentElement.setAttribute('data-color-mode', colorMode)
    }
  }, [colorMode])

  const cycleColorMode = useCallback(() => {
    setColorMode((prev) => {
      if (prev === 'default') return 'navy-canvas'
      if (prev === 'navy-canvas') return 'black-navy-card'
      return 'default'
    })
  }, [])

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

  // Next card for dual-card synchronized sliding transition
  const nextIndex = currentDeck.length > 1 ? (safeIndex + 1) % currentDeck.length : safeIndex
  const nextCard = currentDeck.length > 1 ? currentDeck[nextIndex] : currentCard
  const nextLibraryId = nextCard ? getCardLibraryId(nextCard.id) : STARTER_LIBRARY_ID
  const nextKey = nextCard ? makeCardCompositeKey(nextLibraryId, nextCard.id) : ''
  const nextProgress = nextKey ? getCardProgressData(nextKey, nextLibraryId, nextCard?.id || '') : null

  // Calculate live next interval previews for Due mode
  const intervalPreviews = useMemo(() => {
    if (!currentFsrs) return undefined
    return getIntervalPreviews(currentFsrs)
  }, [currentFsrs])

  const [isSliding, setIsSliding] = useState(false)
  const [slideDirection, setSlideDirection] = useState<'left-to-right' | 'right-to-left'>('left-to-right')
  const isTransitioningRef = useRef(false)

  // Synchronized Slide Transition (240ms dual-card slide)
  const advanceWithSlide = useCallback(
    (action: () => void, direction: 'left-to-right' | 'right-to-left' = 'left-to-right') => {
      if (isTransitioningRef.current) return
      isTransitioningRef.current = true
      setSlideDirection(direction)
      setIsSliding(true)

      setTimeout(() => {
        action()
        setIsSliding(false)
        isTransitioningRef.current = false
      }, 240)
    },
    [],
  )

  // Handle Due Mode Rating
  const handleGradeDue = useCallback(
    (rating: ValidRating) => {
      if (!currentCard || !currentKey) return
      advanceWithSlide(() => {
        gradeCardDue(currentKey, currentLibraryId, currentCard.id, rating)
        setSessionNow(Date.now())
        setIsFlipped(false)

        if (currentDeck.length > 1) {
          setCurrentIndex((prev) => (prev + 1) % currentDeck.length)
        }
      }, 'left-to-right')
    },
    [currentCard, currentKey, currentLibraryId, currentDeck.length, gradeCardDue, advanceWithSlide],
  )

  // Handle Cram Mode Practice
  const handleGradeCram = useCallback(
    (gotIt: boolean) => {
      if (!currentCard || !currentKey) return
      advanceWithSlide(() => {
        recordCramPractice(currentKey, currentLibraryId, currentCard.id)

        if (countTowardSrsInCram) {
          gradeCardDue(currentKey, currentLibraryId, currentCard.id, gotIt ? Rating.Good : Rating.Again)
          setSessionNow(Date.now())
        }

        setIsFlipped(false)
        if (currentDeck.length > 1) {
          setCurrentIndex((prev) => (prev + 1) % currentDeck.length)
        }
      }, 'left-to-right')
    },
    [
      currentCard,
      currentKey,
      currentLibraryId,
      currentDeck.length,
      countTowardSrsInCram,
      recordCramPractice,
      gradeCardDue,
      advanceWithSlide,
    ],
  )

  // Handle Swipe Advance (Both left-to-right and right-to-left gestures)
  const handleSwipeAdvance = useCallback(
    (direction: 'left-to-right' | 'right-to-left') => {
      if (!currentCard || !currentKey) return
      advanceWithSlide(() => {
        if (mode === 'due') {
          gradeCardDue(currentKey, currentLibraryId, currentCard.id, Rating.Good)
          setSessionNow(Date.now())
        } else {
          recordCramPractice(currentKey, currentLibraryId, currentCard.id)
          if (countTowardSrsInCram) {
            gradeCardDue(currentKey, currentLibraryId, currentCard.id, Rating.Good)
            setSessionNow(Date.now())
          }
        }
        setIsFlipped(false)
        if (currentDeck.length > 1) {
          setCurrentIndex((prev) => (prev + 1) % currentDeck.length)
        }
      }, direction)
    },
    [
      mode,
      currentCard,
      currentKey,
      currentLibraryId,
      currentDeck.length,
      countTowardSrsInCram,
      gradeCardDue,
      recordCramPractice,
      advanceWithSlide,
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

  const isSyncing = Object.values(syncingMap).some(Boolean)

  return (
    <div className="min-h-dvh bg-[var(--bg-app)] text-[var(--fg-app)] font-[family-name:var(--font-body)] flex flex-col justify-between max-w-lg mx-auto px-4 py-4 transition-colors duration-150 overflow-x-hidden">
      {/* Top Header: Big Title & Sidebar Trigger */}
      <AppHeader
        onOpenSidebar={() => setDrawerOpen(true)}
        isSyncing={isSyncing}
      />

      {/* Main Flashcard Stage with Synchronized Dual-Card Sliding Transitions */}
      <main className="my-auto py-4 overflow-x-hidden">
        {currentCard ? (
          <CardSlider
            currentCard={currentCard}
            nextCard={nextCard}
            currentProgress={currentProgress}
            nextProgress={nextProgress}
            isFlipped={isFlipped}
            onFlip={() => setIsFlipped((prev) => !prev)}
            onToggleBookmark={handleToggleBookmark}
            onSwipeAdvance={handleSwipeAdvance}
            isSliding={isSliding}
            slideDirection={slideDirection}
            currentCardIndexLabel={`Card ${safeIndex + 1} of ${currentDeck.length}${
              mode === 'due' ? ' (Due)' : ' (Practice)'
            }`}
            nextCardIndexLabel={`Card ${nextIndex + 1} of ${currentDeck.length}${
              mode === 'due' ? ' (Due)' : ' (Practice)'
            }`}
          />
        ) : (
          <div className="p-8 rounded-3xl bg-[var(--fg-app)] text-[var(--bg-app)] shadow-md text-center space-y-4">
            <div className="w-12 h-12 rounded-full bg-[var(--bg-app)] text-[var(--fg-app)] flex items-center justify-center mx-auto shadow-xs">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-[family-name:var(--font-display)] text-lg font-bold">
                {mode === 'due' ? 'Queue Completed!' : 'No Cards Found'}
              </h3>
              <p className="text-xs opacity-85 mt-1 max-w-xs mx-auto leading-relaxed">
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
                className="py-2.5 px-4 rounded-xl bg-[var(--bg-app)] text-[var(--fg-app)] font-[family-name:var(--font-display)] text-xs font-bold hover:opacity-90 transition-opacity shadow-xs"
              >
                Switch to Practice Mode
              </button>
            ) : (
              <button
                onClick={() => setCramFilter('all')}
                className="py-2.5 px-4 rounded-xl bg-[var(--bg-app)] text-[var(--fg-app)] text-xs font-bold shadow-xs hover:opacity-90 transition-opacity"
              >
                Reset Filters
              </button>
            )}
          </div>
        )}
      </main>

      {/* Bottom Rating Bar (Small tactile cards) */}
      <RatingBar
        isFlipped={isFlipped}
        mode={mode}
        intervalPreviews={intervalPreviews}
        onGradeDue={handleGradeDue}
        onGradeCram={handleGradeCram}
      />

      {/* Sidebar / Controls & Libraries Drawer */}
      <LibraryDrawer
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        mode={mode}
        onModeChange={(newMode) => {
          setMode(newMode)
          setCurrentIndex(0)
          setIsFlipped(false)
        }}
        dueCount={dueCards.length}
        cramFilter={cramFilter}
        onCramFilterChange={(f) => {
          setCramFilter(f)
          setCurrentIndex(0)
          setIsFlipped(false)
        }}
        cramFilterCounts={cramFilterCounts}
        countTowardSrs={countTowardSrsInCram}
        onToggleCountTowardSrs={() => setCountTowardSrsInCram((prev) => !prev)}
        canUndo={canUndo}
        onUndo={handleUndo}
        colorMode={colorMode}
        onCycleColorMode={cycleColorMode}
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
