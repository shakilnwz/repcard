import { useState, useMemo } from 'react'
import {
  Layers,
  Sparkles,
  RotateCcw,
  ExternalLink,
  CheckCircle2,
  FolderGit2,
} from 'lucide-react'
import { useLibraries } from '@/hooks/useLibraries'
import { LibraryDrawer } from '@/components/libraries/LibraryDrawer'
import {
  createDefaultFsrsCard,
  getIntervalPreviews,
  gradeFsrsCard,
  deserializeFsrsCard,
  serializeFsrsCard,
  Rating,
  type ValidRating,
  type FsrsCard,
} from '@/lib/fsrs'
import {
  getAllProgress,
  saveCardProgress,
} from '@/lib/storage'
import { makeCardCompositeKey } from '@/types/schema'
import { STARTER_LIBRARY_ID } from '@/lib/starterDeck'

export default function App() {
  const {
    libraries,
    activeCards,
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

  const [drawerOpen, setDrawerOpen] = useState(() => Boolean(pendingImport))
  const [currentIndex, setCurrentIndex] = useState(0)
  const [isFlipped, setIsFlipped] = useState(false)

  // Local card progress from storage keyed by "${libraryId}::${cardId}"
  const [progressMap, setProgressMap] = useState<Record<string, FsrsCard>>(() => {
    const stored = getAllProgress()
    const map: Record<string, FsrsCard> = {}
    for (const [key, val] of Object.entries(stored)) {
      map[key] = deserializeFsrsCard(val.fsrs)
    }
    return map
  })

  // 1-step undo stack
  const [historyStack, setHistoryStack] = useState<
    { index: number; compositeKey: string; prevCard: FsrsCard }[]
  >([])

  // Clamped safe index derived during render
  const safeCurrentIndex = currentIndex >= activeCards.length && activeCards.length > 0 ? 0 : currentIndex
  const currentCard = activeCards[safeCurrentIndex] || activeCards[0]
  const currentLibraryId = currentCard?.id ? (libraries.find((l) => l.enabled)?.id || STARTER_LIBRARY_ID) : STARTER_LIBRARY_ID
  const currentCompositeKey = currentCard ? makeCardCompositeKey(currentLibraryId, currentCard.id) : ''

  const currentFsrsCard = useMemo(() => {
    if (!currentCompositeKey) return createDefaultFsrsCard()
    return progressMap[currentCompositeKey] || createDefaultFsrsCard()
  }, [currentCompositeKey, progressMap])

  const intervalPreviews = useMemo(() => {
    return getIntervalPreviews(currentFsrsCard)
  }, [currentFsrsCard])

  const handleGrade = (rating: ValidRating) => {
    if (!currentCard || !currentCompositeKey) return

    const logItem = gradeFsrsCard(currentFsrsCard, rating)
    const nextFsrs = logItem.card

    // Push to undo stack
    setHistoryStack((prev) => [
      ...prev,
      { index: currentIndex, compositeKey: currentCompositeKey, prevCard: currentFsrsCard },
    ])

    // Update in-memory state
    setProgressMap((prev) => ({
      ...prev,
      [currentCompositeKey]: nextFsrs,
    }))

    // Persist to localStorage
    saveCardProgress({
      key: currentCompositeKey,
      libraryId: currentLibraryId,
      cardId: currentCard.id,
      fsrs: serializeFsrsCard(nextFsrs),
      cramCount: 0,
      bookmarked: false,
      lastRatedAt: new Date().toISOString(),
    })

    setIsFlipped(false)
    if (activeCards.length > 1) {
      setCurrentIndex((prev) => (prev + 1) % activeCards.length)
    }
  }

  const handleUndo = () => {
    if (historyStack.length === 0) return
    const last = historyStack[historyStack.length - 1]

    setProgressMap((prev) => ({
      ...prev,
      [last.compositeKey]: last.prevCard,
    }))

    saveCardProgress({
      key: last.compositeKey,
      libraryId: currentLibraryId,
      cardId: currentCard?.id || '',
      fsrs: serializeFsrsCard(last.prevCard),
      cramCount: 0,
      bookmarked: false,
      lastRatedAt: new Date().toISOString(),
    })

    setCurrentIndex(last.index)
    setIsFlipped(false)
    setHistoryStack((prev) => prev.slice(0, -1))
  }

  const isStarterActiveOnly = libraries.length === 1 && libraries[0].id === STARTER_LIBRARY_ID

  return (
    <div className="min-h-dvh bg-[var(--bg-canvas)] text-[var(--text-primary)] font-[family-name:var(--font-body)] flex flex-col justify-between max-w-lg mx-auto px-4 py-4">
      {/* Top Header */}
      <header className="flex items-center justify-between pb-3 border-b border-[var(--border-subtle)]">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-md bg-[var(--bg-surface)] border border-[var(--border-subtle)] flex items-center justify-center text-[var(--accent-mint)]">
            <Layers className="w-4 h-4" />
          </div>
          <div>
            <h1 className="font-[family-name:var(--font-display)] text-lg font-bold tracking-tight text-[var(--text-primary)]">
              RepCard
            </h1>
            <p className="text-[11px] text-[var(--text-secondary)] font-medium">
              System Design & AI Flashcards
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {historyStack.length > 0 && (
            <button
              onClick={handleUndo}
              className="flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
              title="Undo last rating"
            >
              <RotateCcw className="w-3.5 h-3.5" /> Undo
            </button>
          )}

          {/* Library Drawer Trigger */}
          <button
            onClick={() => setDrawerOpen(true)}
            className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-[family-name:var(--font-display)] font-semibold rounded bg-[var(--bg-elevated)] text-[var(--accent-mint)] border border-[var(--border-subtle)] hover:border-[var(--accent-mint)]/60 transition-colors"
            title="Manage libraries and endpoints"
          >
            <FolderGit2 className="w-3.5 h-3.5" />
            <span>Libraries ({libraries.filter((l) => l.enabled).length})</span>
          </button>
        </div>
      </header>

      {/* Starter Deck Reminder Banner */}
      {isStarterActiveOnly && (
        <div className="mt-3 p-2.5 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)] flex items-center justify-between gap-2 text-xs">
          <span className="text-[var(--text-secondary)] truncate">
            Using built-in starter deck.
          </span>
          <button
            onClick={() => setDrawerOpen(true)}
            className="shrink-0 font-[family-name:var(--font-display)] font-semibold text-[var(--accent-mint)] hover:underline"
          >
            + Add Your Library
          </button>
        </div>
      )}

      {/* Main Flashcard Interactive Area */}
      <main className="my-auto py-4">
        {currentCard ? (
          <div
            onClick={() => setIsFlipped((prev) => !prev)}
            className="cursor-pointer select-none rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] p-6 shadow-sm min-h-[380px] flex flex-col justify-between transition-all duration-150 active:scale-[0.99]"
          >
            {/* Card Top Metadata */}
            <div>
              <div className="flex items-center justify-between gap-2 mb-4">
                <span className="px-2.5 py-0.5 text-xs font-[family-name:var(--font-display)] font-semibold rounded bg-[var(--bg-elevated)] text-[var(--accent-mint)] border border-[var(--border-subtle)]">
                  {currentCard.domain}
                </span>
                <span className="text-xs text-[var(--text-secondary)] flex items-center gap-1 font-medium">
                  <Sparkles className="w-3.5 h-3.5 text-[var(--accent-mint)]" />
                  {currentCard.level}
                </span>
              </div>

              {/* Term / Concept (Space Grotesk) */}
              <h2 className="font-[family-name:var(--font-display)] text-2xl sm:text-3xl font-bold tracking-tight text-[var(--text-primary)] mb-4">
                {currentCard.term}
              </h2>
            </div>

            {/* Front / Back State */}
            {!isFlipped ? (
              <div className="my-auto py-10 text-center">
                <p className="text-sm text-[var(--text-secondary)] font-medium">
                  Tap card or click to reveal breakdown
                </p>
              </div>
            ) : (
              <div className="space-y-4 pt-4 border-t border-[var(--border-subtle)] animate-in fade-in duration-150">
                <div>
                  <p className="font-[family-name:var(--font-display)] text-xs uppercase tracking-wider text-[var(--accent-mint)] font-semibold mb-1">
                    WHAT IT IS
                  </p>
                  <p className="text-sm text-[var(--text-primary)] leading-relaxed card-content-justified">
                    {currentCard.fields.whatItIs}
                  </p>
                </div>

                <div className="pt-3 border-t border-[var(--border-subtle)]">
                  <p className="font-[family-name:var(--font-display)] text-xs uppercase tracking-wider text-[var(--accent-mint)] font-semibold mb-1">
                    PROBLEM SOLVED
                  </p>
                  <p className="text-sm text-[var(--text-primary)] leading-relaxed card-content-justified">
                    {currentCard.fields.problemSolved}
                  </p>
                </div>

                <div className="pt-3 border-t border-[var(--border-subtle)]">
                  <p className="font-[family-name:var(--font-display)] text-xs uppercase tracking-wider text-[var(--accent-mint)] font-semibold mb-1">
                    PRODUCTION CONTEXT
                  </p>
                  <p className="text-sm text-[var(--text-primary)] leading-relaxed card-content-justified">
                    {currentCard.fields.productionContext}
                  </p>
                  {currentCard.referenceUrl && (
                    <a
                      href={currentCard.referenceUrl}
                      target="_blank"
                      rel="noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="inline-flex items-center gap-1 mt-2 text-xs text-[var(--accent-mint)] hover:underline"
                    >
                      <span>Reference Doc</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                </div>
              </div>
            )}

            {/* Bottom Card Footer */}
            <div className="pt-4 border-t border-[var(--border-subtle)] flex items-center justify-between text-xs text-[var(--text-secondary)]">
              <span>Card {safeCurrentIndex + 1} of {activeCards.length}</span>
              <span>Reps: {currentFsrsCard.reps}</span>
            </div>
          </div>
        ) : (
          <div className="p-8 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-center space-y-3">
            <p className="text-sm text-[var(--text-secondary)]">No cards in active queue.</p>
            <button
              onClick={() => setDrawerOpen(true)}
              className="py-2 px-4 rounded-lg bg-[var(--accent-mint)] text-[var(--accent-mint-fg)] font-[family-name:var(--font-display)] text-xs font-bold"
            >
              Open Libraries & Enable a Deck
            </button>
          </div>
        )}
      </main>

      {/* Bottom Rating Bar (Visible when flipped) */}
      <footer className="pt-3 border-t border-[var(--border-subtle)]">
        {isFlipped ? (
          <div className="grid grid-cols-4 gap-2">
            {/* Again */}
            <button
              onClick={() => handleGrade(Rating.Again)}
              className="flex flex-col items-center justify-center py-2 px-1 rounded-lg bg-[var(--bg-surface)] border border-[var(--danger-solid)] text-[var(--danger-solid)] hover:opacity-90 transition-opacity"
            >
              <span className="font-[family-name:var(--font-display)] text-xs font-bold">Again</span>
              <span className="text-[10px] opacity-80">{intervalPreviews[Rating.Again].label}</span>
            </button>

            {/* Hard */}
            <button
              onClick={() => handleGrade(Rating.Hard)}
              className="flex flex-col items-center justify-center py-2 px-1 rounded-lg bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-[var(--text-primary)] hover:opacity-90 transition-opacity"
            >
              <span className="font-[family-name:var(--font-display)] text-xs font-bold">Hard</span>
              <span className="text-[10px] text-[var(--text-secondary)]">{intervalPreviews[Rating.Hard].label}</span>
            </button>

            {/* Good */}
            <button
              onClick={() => handleGrade(Rating.Good)}
              className="flex flex-col items-center justify-center py-2 px-1 rounded-lg bg-[var(--accent-mint)] text-[var(--accent-mint-fg)] hover:opacity-90 transition-opacity font-semibold"
            >
              <span className="font-[family-name:var(--font-display)] text-xs font-bold">Good</span>
              <span className="text-[10px] opacity-90">{intervalPreviews[Rating.Good].label}</span>
            </button>

            {/* Easy */}
            <button
              onClick={() => handleGrade(Rating.Easy)}
              className="flex flex-col items-center justify-center py-2 px-1 rounded-lg bg-[var(--bg-elevated)] border border-[var(--accent-mint)] text-[var(--accent-mint)] hover:opacity-90 transition-opacity"
            >
              <span className="font-[family-name:var(--font-display)] text-xs font-bold">Easy</span>
              <span className="text-[10px] opacity-80">{intervalPreviews[Rating.Easy].label}</span>
            </button>
          </div>
        ) : (
          <div className="flex items-center justify-center gap-2 py-2 text-xs text-[var(--text-secondary)]">
            <CheckCircle2 className="w-4 h-4 text-[var(--accent-mint)]" />
            <span>Tap card to reveal breakdown & rating buttons</span>
          </div>
        )}
      </footer>

      {/* Library Sync Drawer */}
      <LibraryDrawer
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        libraries={libraries}
        syncingMap={syncingMap}
        pendingImport={pendingImport}
        onAddLibrary={addLibrary}
        onToggleEnabled={toggleLibraryEnabled}
        onSyncLibrary={syncLibrary}
        onSyncAll={syncAll}
        onRemoveLibrary={removeLibrary}
        onConfirmPendingImport={confirmPendingImport}
        onDismissPendingImport={dismissPendingImport}
      />
    </div>
  )
}
