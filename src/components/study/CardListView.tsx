import { useState } from 'react'
import { Star, ExpandMore } from '@/components/ui/MaterialIcons'
import { makeCardCompositeKey, type FlashcardItem, type LibrarySource, type LocalCardProgress } from '@/types/schema'
import { getStateLabel } from '@/lib/fsrs'
import { CardAnswer } from './FlashcardView'

interface CardListViewProps {
  libraries: LibrarySource[];
  cardsByLibrary: Record<string, FlashcardItem[]>;
  progressState: Record<string, LocalCardProgress>;
}

/** Every card of every configured library (enabled or not), grouped by library. */
export function CardListView({ libraries, cardsByLibrary, progressState }: CardListViewProps) {
  const [collapsed, setCollapsed] = useState<ReadonlySet<string>>(() => new Set())

  const toggleLibrary = (id: string) =>
    setCollapsed((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  if (libraries.length === 0) {
    return <p className="flex-1 pt-8 text-center text-sm opacity-80">No libraries configured yet.</p>
  }

  return (
    <section className="flex-1 space-y-6 pb-2" aria-label="All cards by library">
      {libraries.map((lib) => {
        const cards = cardsByLibrary[lib.id] ?? []
        const isOpen = !collapsed.has(lib.id)

        return (
          <div key={lib.id} className="space-y-2.5">
            <button
              onClick={() => toggleLibrary(lib.id)}
              aria-expanded={isOpen}
              className="w-full flex items-center justify-between gap-3 text-left text-[var(--fg-app)]"
            >
              <span className="min-w-0 flex items-center gap-2">
                <span className="text-xs uppercase tracking-wider font-bold opacity-80 truncate">{lib.name}</span>
                {!lib.enabled && (
                  <span className="shrink-0 px-1.5 py-0.5 text-[10px] font-bold rounded bg-[var(--fg-app)] text-[var(--bg-app)]">
                    Disabled
                  </span>
                )}
              </span>
              <span className="shrink-0 flex items-center gap-1 text-xs font-semibold opacity-80">
                {cards.length} {cards.length === 1 ? 'card' : 'cards'}
                <ExpandMore className={`w-4 h-4 transition-transform ${isOpen ? '' : '-rotate-90'}`} />
              </span>
            </button>

            {isOpen &&
              (cards.length === 0 ? (
                <p className="text-xs opacity-75">No cards yet. Sync this library from Controls & Libraries.</p>
              ) : (
                <ul className="space-y-2">
                  {cards.map((card) => (
                    <CardListItem
                      key={card.id}
                      card={card}
                      progress={progressState[makeCardCompositeKey(lib.id, card.id)]}
                    />
                  ))}
                </ul>
              ))}
          </div>
        )
      })}
    </section>
  )
}

function CardListItem({ card, progress }: { card: FlashcardItem; progress: LocalCardProgress | undefined }) {
  const [open, setOpen] = useState(false)

  return (
    <li className="rounded-2xl bg-[var(--bg-card)] text-[var(--fg-card)] shadow-sm">
      <button
        onClick={() => setOpen((prev) => !prev)}
        aria-expanded={open}
        className="w-full flex items-start gap-3 p-4 text-left"
      >
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-bold leading-snug">{card.term}</span>
          <span className="block text-[11px] opacity-80 mt-0.5">
            {card.domain} • {card.level}
          </span>
        </span>
        <span className="shrink-0 flex items-center gap-1.5">
          {progress?.bookmarked && (
            <>
              <Star className="w-4 h-4 fill-current" />
              <span className="sr-only">Starred</span>
            </>
          )}
          <span className="px-2 py-0.5 rounded-md bg-[var(--fg-card)] text-[var(--bg-card)] text-[11px] font-bold">
            {getStateLabel(progress?.fsrs.state)}
          </span>
          <ExpandMore className={`w-5 h-5 transition-transform ${open ? 'rotate-180' : ''}`} />
        </span>
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-5 animate-fade-in">
          <CardAnswer card={card} />
        </div>
      )}
    </li>
  )
}
