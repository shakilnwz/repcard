import { useState, useMemo, useCallback, useLayoutEffect, useRef } from 'react'
import { CheckCircle2 } from '@/components/ui/MaterialIcons'
import { useLibraries } from '@/hooks/useLibraries'
import { useCardProgress } from '@/hooks/useCardProgress'
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts'
import { AppHeader, type StudyMode, type AppView } from '@/components/layout/AppHeader'
import { COLOR_MODES, type ColorPaletteMode } from '@/lib/colorModes'
import type { CramFilter } from '@/components/study/FilterBar'
import { CardSlider, type NeighborCard, type SlideDirection, type SwipeLabels } from '@/components/study/CardSlider'
import { RatingBar } from '@/components/study/RatingBar'
import { CardListView } from '@/components/study/CardListView'
import { LibraryDrawer } from '@/components/libraries/LibraryDrawer'
import { getIntervalPreviews, Rating, type ValidRating } from '@/lib/fsrs'
import { makeCardCompositeKey, type FlashcardItem } from '@/types/schema'
import { STARTER_LIBRARY_ID } from '@/lib/starterDeck'
import { CARD_SORT_ORDERS, sortCards, type CardSortOrder } from '@/lib/cardSort'
import {
  getCardSortPreference,
  getColorModePreference,
  getRatingButtonsPreference,
  saveCardSortPreference,
  saveColorModePreference,
  saveRatingButtonsPreference,
} from '@/lib/storage'

// One-word captions for the floating swipe arrows (a left swipe brings in the next card)
const SWIPE_LABELS: Record<StudyMode, SwipeLabels> = {
  due: { up: 'Good', down: 'Again', left: 'Next', right: 'Prev' },
  cram: { up: 'Good', down: 'Shaky', left: 'Next', right: 'Prev' },
}

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
  const [cardSort, setCardSort] = useState<CardSortOrder>(() => {
    const stored = getCardSortPreference()
    return CARD_SORT_ORDERS.find((o) => o === stored) ?? 'newest'
  })
  // Swiping is the default way to grade; the rating buttons are opt-in from the panel
  const [showRatingButtons, setShowRatingButtons] = useState(getRatingButtonsPreference)

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

  const sortedCards = useMemo(() => sortCards(activeCards, cardSort), [activeCards, cardSort])

  // 1. Compute Due Cards Queue
  const dueCards = useMemo(() => {
    return sortedCards.filter((card) => {
      const libId = getCardLibraryId(card.id)
      const key = makeCardCompositeKey(libId, card.id)
      const prog = progressState[key]
      if (!prog) return true // Unreviewed / New cards are due immediately
      return new Date(prog.fsrs.due).getTime() <= sessionNow
    })
  }, [sortedCards, progressState, sessionNow, getCardLibraryId])

  // 2. Compute Cram Cards Queue based on active filter
  const filteredCramCards = useMemo(() => {
    return sortedCards.filter((card) => {
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
  }, [sortedCards, progressState, cramFilter, getCardLibraryId])

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

  const formatCardLabel = (index: number, total: number) =>
    `Card ${index + 1} of ${total}${mode === 'due' ? ' (Due)' : ' (Practice)'}`

  const toNeighbor = (card: FlashcardItem | null | undefined, index: number, total: number): NeighborCard | null => {
    if (!card) return null
    const libId = getCardLibraryId(card.id)
    return {
      card,
      progress: getCardProgressData(makeCardCompositeKey(libId, card.id), libId, card.id),
      label: formatCardLabel(index, total),
    }
  }

  // Browsing is a carousel over the deck as it stands: swipe left (or →) for the next card, right
  // (or ←) for the previous one, wrapping around at either end.
  const canBrowse = deckSize > 1
  const prevIndex = canBrowse ? (safeIndex - 1 + deckSize) % deckSize : safeIndex
  const nextIndex = canBrowse ? (safeIndex + 1) % deckSize : safeIndex

  // Grading flings the card away (up for a pass, down for a miss) and uncovers the next one behind
  // it. In Due mode it first drops the graded card from the queue, so the last due card has nothing
  // behind it, and the cards after it each move up one position. In Cram mode a lone card simply
  // comes round again.
  const gradeTarget = mode === 'due' && !canBrowse ? null : currentDeck[nextIndex] ?? null
  const gradeTargetPosition = mode === 'due' && nextIndex > safeIndex ? nextIndex - 1 : nextIndex
  const gradeDeckSize = mode === 'due' ? deckSize - 1 : deckSize

  // Calculate live next interval previews for Due mode
  const intervalPreviews = useMemo(() => {
    if (!currentFsrs) return undefined
    return getIntervalPreviews(currentFsrs)
  }, [currentFsrs])

  const [slide, setSlide] = useState<SlideDirection | null>(null)
  const pendingAdvanceRef = useRef<(() => void) | null>(null)

  // Start a slide. The grade (if any) is held until CardSlider reports the outgoing card has landed,
  // then applied together with moving the cursor onto exactly the card that slid in.
  const startSlide = useCallback(
    (direction: SlideDirection, target: { id: string | null; index: number }, grade?: () => void): boolean => {
      if (pendingAdvanceRef.current) return false
      pendingAdvanceRef.current = () => {
        grade?.()
        setIsFlipped(false)
        setCursor(target)
      }
      setSlide(direction)
      return true
    },
    [],
  )

  const advanceWithGrade = useCallback(
    (passed: boolean, grade: () => void): boolean =>
      startSlide(passed ? 'up' : 'down', { id: gradeTarget?.id ?? null, index: gradeTargetPosition }, grade),
    [startSlide, gradeTarget, gradeTargetPosition],
  )

  const handleSlideComplete = useCallback(() => {
    const commit = pendingAdvanceRef.current
    pendingAdvanceRef.current = null
    commit?.()
    setSlide(null)
  }, [])

  // Handle Due Mode Rating. Only Again counts as a miss (flung down); Hard, Good and Easy pass.
  const handleGradeDue = useCallback(
    (rating: ValidRating): boolean => {
      if (!currentCard || !currentKey) return false
      return advanceWithGrade(rating !== Rating.Again, () => {
        gradeCardDue(currentKey, currentLibraryId, currentCard.id, rating)
        setSessionNow(Date.now())
      })
    },
    [currentCard, currentKey, currentLibraryId, gradeCardDue, advanceWithGrade],
  )

  // Handle Cram Mode Practice
  const handleGradeCram = useCallback(
    (gotIt: boolean): boolean => {
      if (!currentCard || !currentKey) return false
      return advanceWithGrade(gotIt, () => {
        recordCramPractice(currentKey, currentLibraryId, currentCard.id)

        if (countTowardSrsInCram) {
          gradeCardDue(currentKey, currentLibraryId, currentCard.id, gotIt ? Rating.Good : Rating.Again)
          setSessionNow(Date.now())
        }
      })
    },
    [
      currentCard,
      currentKey,
      currentLibraryId,
      countTowardSrsInCram,
      recordCramPractice,
      gradeCardDue,
      advanceWithGrade,
    ],
  )

  // Swipe or arrow key. Up / down grade: a pass (Good / Got It) or a miss (Again / Still Shaky),
  // whether or not the answer has been revealed. Sideways browses to the neighboring card.
  const handleSwipe = useCallback(
    (direction: SlideDirection): boolean => {
      if (direction === 'up' || direction === 'down') {
        const passed = direction === 'up'
        return mode === 'due' ? handleGradeDue(passed ? Rating.Good : Rating.Again) : handleGradeCram(passed)
      }
      if (!canBrowse) return false
      const index = direction === 'left-to-right' ? prevIndex : nextIndex
      return startSlide(direction, { id: currentDeck[index].id, index })
    },
    [mode, handleGradeDue, handleGradeCram, canBrowse, prevIndex, nextIndex, currentDeck, startSlide],
  )

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
    onSwipe: handleSwipe,
    onUndo: handleUndo,
    onBookmark: handleToggleBookmark,
    enabled: Boolean(currentCard) && view === 'cards',
  })

  const isSyncing = Object.values(syncingMap).some(Boolean)

  return (
    <div className="min-h-dvh bg-[var(--bg-app)] text-[var(--fg-app)] flex flex-col max-w-lg mx-auto safe-area-pad transition-colors duration-150 overflow-clip">
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
        <CardListView
          libraries={libraries}
          cardsByLibrary={cardsByLibrary}
          progressState={progressState}
          sortOrder={cardSort}
        />
      ) : (
        /* Card stage + rating bar. The stage's height comes from the viewport, not the card's
           content, so flipping or swapping cards never shifts the layout. */
        <div className="flex-1 flex flex-col justify-center">
          <main className="relative flex-1 min-h-[360px] max-h-[640px]">
            {currentCard ? (
              <CardSlider
                currentCard={currentCard}
                currentProgress={currentProgress}
                currentCardIndexLabel={formatCardLabel(safeIndex, deckSize)}
                prev={canBrowse ? toNeighbor(currentDeck[prevIndex], prevIndex, deckSize) : null}
                next={canBrowse ? toNeighbor(currentDeck[nextIndex], nextIndex, deckSize) : null}
                behind={toNeighbor(gradeTarget, gradeTargetPosition, gradeDeckSize)}
                isFlipped={isFlipped}
                onFlip={() => setIsFlipped((prev) => !prev)}
                onToggleBookmark={handleToggleBookmark}
                onSwipe={handleSwipe}
                swipeLabels={SWIPE_LABELS[mode]}
                slide={slide}
                onSlideComplete={handleSlideComplete}
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

          {/* Bottom Rating Bar (Small tactile cards), opt-in from the panel */}
          {currentCard && showRatingButtons && (
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
        cardSort={cardSort}
        showRatingButtons={showRatingButtons}
        onToggleRatingButtons={() => {
          setShowRatingButtons(!showRatingButtons)
          saveRatingButtonsPreference(!showRatingButtons)
        }}
        onCardSortChange={(order) => {
          setCardSort(order)
          saveCardSortPreference(order)
          setCursor({ id: null, index: 0 })
          setIsFlipped(false)
        }}
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
