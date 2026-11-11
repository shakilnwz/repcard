import { useState, useMemo } from 'react'
import { Layers, Sparkles, BookOpen, RotateCcw, ExternalLink, CheckCircle2 } from 'lucide-react'
import { STARTER_CARDS } from '@/lib/starterDeck'
import {
  createDefaultFsrsCard,
  getIntervalPreviews,
  gradeFsrsCard,
  Rating,
  type ValidRating,
  type FsrsCard,
} from '@/lib/fsrs'

export default function App() {
  const [currentIndex, setCurrentIndex] = useState(0)
  const [isFlipped, setIsFlipped] = useState(false)
  const [cardStates, setCardStates] = useState<Record<string, FsrsCard>>(() => {
    const initial: Record<string, FsrsCard> = {}
    STARTER_CARDS.forEach((card) => {
      initial[card.id] = createDefaultFsrsCard()
    })
    return initial
  })
  const [historyStack, setHistoryStack] = useState<{ index: number; cardId: string; prevState: FsrsCard }[]>([])

  const currentCard = STARTER_CARDS[currentIndex]
  const currentFsrsCard = cardStates[currentCard.id] || createDefaultFsrsCard()

  const intervalPreviews = useMemo(() => {
    return getIntervalPreviews(currentFsrsCard)
  }, [currentFsrsCard])

  const handleGrade = (rating: ValidRating) => {
    const logItem = gradeFsrsCard(currentFsrsCard, rating)
    setHistoryStack((prev) => [
      ...prev,
      { index: currentIndex, cardId: currentCard.id, prevState: currentFsrsCard },
    ])
    setCardStates((prev) => ({
      ...prev,
      [currentCard.id]: logItem.card,
    }))
    setIsFlipped(false)
    setCurrentIndex((prev) => (prev + 1) % STARTER_CARDS.length)
  }

  const handleUndo = () => {
    if (historyStack.length === 0) return
    const last = historyStack[historyStack.length - 1]
    setCardStates((prev) => ({
      ...prev,
      [last.cardId]: last.prevState,
    }))
    setCurrentIndex(last.index)
    setIsFlipped(false)
    setHistoryStack((prev) => prev.slice(0, -1))
  }

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
          <span className="px-2.5 py-1 text-xs font-[family-name:var(--font-display)] font-semibold rounded bg-[var(--bg-elevated)] text-[var(--accent-mint)] border border-[var(--border-subtle)]">
            Card {currentIndex + 1}/{STARTER_CARDS.length}
          </span>
        </div>
      </header>

      {/* Main Flashcard Interactive Area */}
      <main className="my-auto py-4">
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
            <span>Reps: {currentFsrsCard.reps}</span>
            <span>State: {currentFsrsCard.state === 0 ? 'New' : currentFsrsCard.state === 1 ? 'Learning' : 'Review'}</span>
          </div>
        </div>
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
            <BookOpen className="w-4 h-4 text-[var(--accent-mint)]" />
            <span>ts-fsrs v6 Engine Active • Tap card to reveal ratings</span>
          </div>
        )}
      </footer>
    </div>
  )
}
