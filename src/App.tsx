import { Layers, Sparkles, BookOpen } from 'lucide-react'

export default function App() {
  return (
    <div className="min-h-dvh bg-[var(--bg-canvas)] text-[var(--text-primary)] font-[family-name:var(--font-body)] flex flex-col justify-between max-w-lg mx-auto px-4 py-4">
      {/* Header Bar */}
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
          <span className="px-2.5 py-1 text-xs font-[family-name:var(--font-display)] font-semibold rounded bg-[var(--bg-elevated)] text-[var(--accent-mint)] border border-[var(--border-subtle)]">
            Phase 0 Ready
          </span>
        </div>
      </header>

      {/* Main Flashcard Scaffold Preview */}
      <main className="my-auto py-6">
        <div className="rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] p-6 shadow-sm">
          {/* Metadata Row */}
          <div className="flex items-center justify-between gap-2 mb-4">
            <span className="px-2 py-0.5 text-xs font-[family-name:var(--font-display)] font-semibold rounded bg-[var(--bg-elevated)] text-[var(--accent-mint)] border border-[var(--border-subtle)]">
              AI Systems / LLM Serving
            </span>
            <span className="text-xs text-[var(--text-secondary)] flex items-center gap-1 font-medium">
              <Sparkles className="w-3.5 h-3.5 text-[var(--accent-mint)]" /> Starter Deck
            </span>
          </div>

          {/* Term / Concept (Space Grotesk) */}
          <h2 className="font-[family-name:var(--font-display)] text-2xl font-bold tracking-tight text-[var(--text-primary)] mb-6">
            PagedAttention (vLLM)
          </h2>

          {/* Breakdown Blocks (Google Sans + Justified Text) */}
          <div className="space-y-4 pt-4 border-t border-[var(--border-subtle)]">
            <div>
              <p className="font-[family-name:var(--font-display)] text-xs uppercase tracking-wider text-[var(--accent-mint)] font-semibold mb-1">
                WHAT IT IS
              </p>
              <p className="text-sm text-[var(--text-primary)] leading-relaxed card-content-justified">
                An attention algorithm inspired by OS virtual memory paging that manages Key-Value (KV) cache in non-contiguous physical memory blocks rather than pre-allocating large contiguous buffers for worst-case sequence lengths.
              </p>
            </div>

            <div className="pt-3 border-t border-[var(--border-subtle)]">
              <p className="font-[family-name:var(--font-display)] text-xs uppercase tracking-wider text-[var(--accent-mint)] font-semibold mb-1">
                PROBLEM SOLVED
              </p>
              <p className="text-sm text-[var(--text-primary)] leading-relaxed card-content-justified">
                Eliminates internal and external KV cache memory fragmentation (saving 60–80% memory waste), dramatically increasing batched throughput during multi-user serving.
              </p>
            </div>
          </div>
        </div>
      </main>

      {/* Footer / Status */}
      <footer className="pt-4 border-t border-[var(--border-subtle)] text-center text-xs text-[var(--text-secondary)]">
        <div className="flex items-center justify-center gap-2">
          <BookOpen className="w-3.5 h-3.5 text-[var(--accent-mint)]" />
          <span>Space Grotesk (Terms) + Google Sans (Explanations) active</span>
        </div>
      </footer>
    </div>
  )
}
