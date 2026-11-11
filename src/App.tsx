import { useState, useMemo, useCallback, useLayoutEffect, useRef } from 'react'
import { CheckCircle2 } from '@/components/ui/MaterialIcons'
import { useLibraries } from '@/hooks/useLibraries'
import { useCardProgress } from '@/hooks/useCardProgress'
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts'
import { AppHeader, type StudyMode, type AppView } from '@/components/layout/AppHeader'
import { COLOR_MODES, type ColorPaletteMode } from '@/lib/colorModes'
import type { CramFilter } from '@/components/study/FilterBar'
import { CardSlider, type SlideDirection } from '@/components/study/CardSlider'
import { RatingBar } from '@/components/study/RatingBar'
import { CardListView } from '@/components/study/CardListView'
import { LibraryDrawer } from '@/components/libraries/LibraryDrawer'
import { getIntervalPreviews, Rating, type ValidRating } from '@/lib/fsrs'
import { makeCardCompositeKey } from '@/types/schema'
import { STARTER_LIBRARY_ID } from '@/lib/starterDeck'
import { getColorModePreference, saveColorModePreference } from '@/lib/storage'

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
  const [view, setView] = useState<AppView>('cards')
  const [cramFilter, setCramFilter] = useState<CramFilter>('all')
  const [drawerOpen, setDrawerOpen] = useState(() => Boolean(pendingImport))
  // Open the drawer whenever a new share-link import arrives (on launch or via a later hash change)
  const [shownImport, setShownImport] = useState(pendingImport)
  if (pendingImport !== shownImport) {
    setShownImport(pendingImport)
    if (pendingImport) setDrawerOpen(true)
  }
  // Which card is on screen: tracked by id (so it survives the deck re-sorting/shrinking after a
  // grade or undo), with a positional fallback for when that card is no longer in the deck.
  const [cursor, setCursor] = useState<{ id: string | null; index: number }>({ id: null, index: 0 })
  const [isFlipped, setIsFlipped] = useState(false)
  const [countTowardSrsInCram, setCountTowardSrsInCram] = useState(false)
  const [sessionNow, setSessionNow] = useState(() => Date.now())
  const [colorMode, setColorMode] = useState<ColorPaletteMode>(() => {
    const stored = getColorModePreference()
    return COLOR_MODES.find((m) => m === stored) ?? 'default'
  })

  // Apply (and remember) the color mode before paint, so a saved theme never flashes the default
  useLayoutEffect(() => {
    const root = document.documentElement
    if (colorMode === 'default') {
      root.removeAttribute('data-color-mode')
    } else {
      root.setAttribute('data-color-mode', colorMode)
    }
    // Keep the browser / PWA status bar the same color as the canvas
    const canvas = getComputedStyle(root).getPropertyValue('--bg-app').trim()
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', canvas || '#000000')
    saveColorModePreference(colorMode)
  }, [colorMode])

  const cycleColorMode = useCallback(() => {
    setColorMode((prev) => COLOR_MODES[(COLOR_MODES.indexOf(prev) + 1) % COLOR_MODES.length])
  }, [])

  // Card id -> owning library id, built once per library change (was a full scan per lookup,
  // which made every deck filter O(n²)). The first library containing an id wins, as before.
  const cardLibraryIndex = useMemo(() => {
    const index = new Map<string, string>()
    for (const [libId, cards] of Object.entries(cardsByLibrary)) {
      for (const card of cards) {
        if (!index.has(card.id)) index.set(card.id, libId)
      }
    }
    return index
  }, [cardsByLibrary])

  const getCardLibraryId = useCallback(
    (cardId: string) => cardLibraryIndex.get(cardId) ?? STARTER_LIBRARY_ID,
    [cardLibraryIndex],
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

  const deckSize = currentDeck.length
  const cursorIndex = cursor.id ? currentDeck.findIndex((c) => c.id === cursor.id) : -1
  const safeIndex = cursorIndex !== -1 ? cursorIndex : cursor.index < deckSize ? cursor.index : 0
  const currentCard = currentDeck[safeIndex] || null

  const currentLibraryId = currentCard ? getCardLibraryId(currentCard.id) : STARTER_LIBRARY_ID
  const currentKey = currentCard ? makeCardCompositeKey(currentLibraryId, currentCard.id) : ''
  const currentProgress = currentKey ? getCardProgressData(currentKey, currentLibraryId, currentCard?.id || '') : null
  const currentFsrs = currentKey ? getFsrsCard(currentKey, currentLibraryId, currentCard?.id || '') : null

  // Next card for the dual-card slide. In Due mode every advance grades the current card, which
  // pushes its due date into the future and drops it from the queue — so the last due card has
  // nothing behind it, and the cards after it each move up one position.
  const nextIndex = deckSize > 0 ? (safeIndex + 1) % deckSize : 0
  const nextCard = deckSize > 1 || mode === 'cram' ? currentDeck[nextIndex] ?? null : null
  const nextPosition = mode === 'due' && nextIndex > safeIndex ? nextIndex - 1 : nextIndex
  const nextDeckSize = mode === 'due' ? deckSize - 1 : deckSize
  const nextLibraryId = nextCard ? getCardLibraryId(nextCard.id) : STARTER_LIBRARY_ID
  const nextKey = nextCard ? makeCardCompositeKey(nextLibraryId, nextCard.id) : ''
  const nextProgress = nextKey ? getCardProgressData(nextKey, nextLibraryId, nextCard?.id || '') : null

  // Calculate live next interval previews for Due mode
  const intervalPreviews = useMemo(() => {
    if (!currentFsrs) return undefined
    return getIntervalPreviews(currentFsrs)
  }, [currentFsrs])

  const formatCardLabel = (index: number, total: number) =>
    `Card ${index + 1} of ${total}${mode === 'due' ? ' (Due)' : ' (Practice)'}`

  const [slide, setSlide] = useState<SlideDirection | null>(null)
  const pendingAdvanceRef = useRef<(() => void) | null>(null)

  // Start a slide. The action is held until CardSlider reports the outgoing card has landed, then
  // applied together with moving the cursor onto exactly the card that slid in.
  const advanceWithSlide = useCallback(
    (action: () => void, direction: SlideDirection = 'left-to-right'): boolean => {
      if (pendingAdvanceRef.current) return false
      const targetId = nextCard?.id ?? null
      pendingAdvanceRef.current = () => {
        action()
        setIsFlipped(false)
        setCursor({ id: targetId, index: nextPosition })
      }
      setSlide(direction)
      return true
    },
    [nextCard, nextPosition],
  )

  const handleSlideComplete = useCallback(() => {
    const commit = pendingAdvanceRef.current
    pendingAdvanceRef.current = null
    commit?.()
    setSlide(null)
  }, [])

  // Handle Due Mode Rating. A miss (Again) slides the card out to the left, a pass to the right,
  // matching the swipe gestures.
  const handleGradeDue = useCallback(
    (rating: ValidRating): boolean => {
      if (!currentCard || !currentKey) return false
      return advanceWithSlide(() => {
        gradeCardDue(currentKey, currentLibraryId, currentCard.id, rating)
        setSessionNow(Date.now())
      }, rating === Rating.Again ? 'right-to-left' : 'left-to-right')
    },
    [currentCard, currentKey, currentLibraryId, gradeCardDue, advanceWithSlide],
  )

  // Handle Cram Mode Practice
  const handleGradeCram = useCallback(
    (gotIt: boolean): boolean => {
      if (!currentCard || !currentKey) return false
      return advanceWithSlide(() => {
        recordCramPractice(currentKey, currentLibraryId, currentCard.id)

        if (countTowardSrsInCram) {
          gradeCardDue(currentKey, currentLibraryId, currentCard.id, gotIt ? Rating.Good : Rating.Again)
          setSessionNow(Date.now())
        }
      }, gotIt ? 'left-to-right' : 'right-to-left')
    },
    [
      currentCard,
      currentKey,
      currentLibraryId,
      countTowardSrsInCram,
      recordCramPractice,
      gradeCardDue,
      advanceWithSlide,
    ],
  )

  // Swipe (or arrow key): right is a pass (Good / Got It), left is a miss (Again / Still Shaky).
  // Grades immediately, whether or not the answer has been revealed.
  const handleSwipeAdvance = useCallback(
    (direction: SlideDirection): boolean => {
      const passed = direction === 'left-to-right'
      return mode === 'due' ? handleGradeDue(passed ? Rating.Good : Rating.Again) : handleGradeCram(passed)
    },
    [mode, handleGradeDue, handleGradeCram],
  )

  const frontHint =
    mode === 'due'
      ? { primary: 'Tap to reveal the answer', secondary: 'or swipe right for Good, left for Again' }
      : { primary: 'Tap to reveal the answer', secondary: 'or swipe right for Got It, left for Still Shaky' }

  // Handle Bookmark Toggle
  const handleToggleBookmark = useCallback(() => {
    if (!currentCard || !currentKey) return
    toggleBookmark(currentKey, currentLibraryId, currentCard.id)
  }, [currentCard, currentKey, currentLibraryId, toggleBookmark])

  // Handle Undo
  const handleUndo = useCallback(() => {
    if (pendingAdvanceRef.current) return
    const undoneKey = undoLastAction()
    if (!undoneKey) return

    setIsFlipped(false)
    // Look in all active cards: in Due mode the graded card has left the queue and only
    // re-enters once its progress is restored, so the cursor follows it by id.
    const undoneCard = activeCards.find(
      (c) => makeCardCompositeKey(getCardLibraryId(c.id), c.id) === undoneKey,
    )
    if (undoneCard) {
      setCursor({ id: undoneCard.id, index: safeIndex })
    }
  }, [undoLastAction, activeCards, getCardLibraryId, safeIndex])

  // Keyboard Shortcuts Hook
  useKeyboardShortcuts({
    isFlipped,
    mode,
    onFlip: () => setIsFlipped((prev) => !prev),
    onGradeDue: (grade) => handleGradeDue(grade as ValidRating),
    onGradeCram: handleGradeCram,
    onSwipe: handleSwipeAdvance,
    onUndo: handleUndo,
    onBookmark: handleToggleBookmark,
    enabled: Boolean(currentCard) && view === 'cards',
  })

  const isSyncing = Object.values(syncingMap).some(Boolean)

  return (
    <div className="min-h-dvh bg-[var(--bg-app)] text-[var(--fg-app)] flex flex-col max-w-lg mx-auto safe-area-pad transition-colors duration-150 overflow-x-clip">
      {/* Top Header: Big Title & Sidebar Trigger */}
      <AppHeader
        onOpenSidebar={() => setDrawerOpen(true)}
        isSyncing={isSyncing}
        view={view}
        onToggleView={() => {
          setView((prev) => (prev === 'cards' ? 'list' : 'cards'))
          window.scrollTo(0, 0)
        }}
      />

      {view === 'list' ? (
        <CardListView libraries={libraries} cardsByLibrary={cardsByLibrary} progressState={progressState} />
      ) : (
        /* Card stage + rating bar. The stage's height comes from the viewport, not the card's
           content, so flipping or swapping cards never shifts the layout. */
        <div className="flex-1 flex flex-col justify-center">
          <main className="relative flex-1 min-h-[360px] max-h-[640px]">
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
                frontHint={frontHint}
                slide={slide}
                onSlideComplete={handleSlideComplete}
                currentCardIndexLabel={formatCardLabel(safeIndex, deckSize)}
                nextCardIndexLabel={formatCardLabel(nextPosition, nextDeckSize)}
              />
            ) : (
              <div className="h-full flex items-center">
                <div className="w-full p-8 rounded-3xl bg-[var(--fg-app)] text-[var(--bg-app)] shadow-md text-center space-y-4">
                  <div className="w-12 h-12 rounded-full bg-[var(--bg-app)] text-[var(--fg-app)] flex items-center justify-center mx-auto shadow-xs">
                    <CheckCircle2 className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold">
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
                        setCursor({ id: null, index: 0 })
                        setIsFlipped(false)
                      }}
                      className="py-2.5 px-4 rounded-xl bg-[var(--bg-app)] text-[var(--fg-app)] text-xs font-bold hover:opacity-90 transition-opacity shadow-xs"
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
              </div>
            )}
          </main>

          {/* Bottom Rating Bar (Small tactile cards) */}
          {currentCard && (
            <RatingBar
              isFlipped={isFlipped}
              mode={mode}
              intervalPreviews={intervalPreviews}
              onReveal={() => setIsFlipped(true)}
              onGradeDue={handleGradeDue}
              onGradeCram={handleGradeCram}
            />
          )}
        </div>
      )}

      {/* Sidebar / Controls & Libraries Drawer */}
      <LibraryDrawer
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        mode={mode}
        onModeChange={(newMode) => {
          setMode(newMode)
          setCursor({ id: null, index: 0 })
          setIsFlipped(false)
        }}
        dueCount={dueCards.length}
        cramFilter={cramFilter}
        onCramFilterChange={(f) => {
          setCramFilter(f)
          setCursor({ id: null, index: 0 })
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
