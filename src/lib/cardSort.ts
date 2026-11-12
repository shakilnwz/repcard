import type { FlashcardItem } from '@/types/schema'

export const CARD_SORT_ORDERS = ['newest', 'oldest'] as const
export type CardSortOrder = (typeof CARD_SORT_ORDERS)[number]

/** A missing or unparseable date counts as the oldest possible. */
function addedTime(card: FlashcardItem): number {
  const time = Date.parse(card.dateAdded)
  return Number.isNaN(time) ? -Infinity : time
}

/**
 * Orders cards by `dateAdded`. Cards with the same date (e.g. a sheet that only records the day)
 * keep their source order, read as oldest → newest, so "newest" is the exact reverse of "oldest".
 */
export function sortCards(cards: readonly FlashcardItem[], order: CardSortOrder): FlashcardItem[] {
  const oldestFirst = cards
    .map((card, index) => ({ card, index, time: addedTime(card) }))
    .sort((a, b) => (a.time === b.time ? a.index - b.index : a.time < b.time ? -1 : 1))
    .map(({ card }) => card)
  return order === 'newest' ? oldestFirst.reverse() : oldestFirst
}
