import {
  fsrs,
  createEmptyCard,
  Rating,
  State,
  type Card as FsrsCard,
  type Grade,
  type RecordLogItem,
} from 'ts-fsrs'
import type { SerializedFsrsCard } from '@/types/schema'

export { Rating, State }
export type { FsrsCard, Grade }

export type ValidRating = typeof Rating.Again | typeof Rating.Hard | typeof Rating.Good | typeof Rating.Easy

// Initialize default FSRS scheduler
export const fScheduler = fsrs()

/**
 * Creates a brand new empty FSRS card initialized to current timestamp
 */
export function createDefaultFsrsCard(now = new Date()): FsrsCard {
  return createEmptyCard(now)
}

/**
 * Serializes a ts-fsrs Card into a plain JSON-safe object for localStorage
 */
export function serializeFsrsCard(card: FsrsCard): SerializedFsrsCard {
  return {
    due: card.due instanceof Date ? card.due.toISOString() : new Date(card.due).toISOString(),
    stability: card.stability,
    difficulty: card.difficulty,
    scheduled_days: card.scheduled_days,
    learning_steps: card.learning_steps,
    reps: card.reps,
    lapses: card.lapses,
    state: card.state as number,
    last_review: card.last_review
      ? (card.last_review instanceof Date ? card.last_review.toISOString() : new Date(card.last_review).toISOString())
      : undefined,
  }
}

/**
 * Deserializes JSON data back into a valid ts-fsrs Card with real Date instances
 */
export function deserializeFsrsCard(data: SerializedFsrsCard): FsrsCard {
  return {
    due: new Date(data.due),
    stability: data.stability,
    difficulty: data.difficulty,
    scheduled_days: data.scheduled_days,
    learning_steps: data.learning_steps ?? 0,
    reps: data.reps,
    lapses: data.lapses,
    state: (data.state as State) ?? State.New,
    last_review: data.last_review ? new Date(data.last_review) : undefined,
  }
}

/**
 * Formats time difference into compact human labels (<10m, ~1d, ~3d, ~2w, ~1mo)
 */
export function formatIntervalPreview(dueDate: Date, baseDate = new Date()): string {
  const diffMs = dueDate.getTime() - baseDate.getTime()
  if (diffMs <= 0) return '<1m'

  const diffMinutes = Math.round(diffMs / (1000 * 60))
  if (diffMinutes < 60) {
    return `<${Math.max(1, diffMinutes)}m`
  }

  const diffHours = Math.round(diffMinutes / 60)
  if (diffHours < 24) {
    return `~${diffHours}h`
  }

  const diffDays = Math.round(diffHours / 24)
  if (diffDays < 14) {
    return `~${diffDays}d`
  }
  if (diffDays < 30) {
    return `~${Math.round(diffDays / 7)}w`
  }
  if (diffDays < 365) {
    return `~${Math.round(diffDays / 30)}mo`
  }
  return `~${Math.round(diffDays / 365)}y`
}

export interface IntervalPreviewItem {
  rating: ValidRating;
  label: string;
  due: Date;
  scheduledDays: number;
}

/**
 * Returns next interval previews for all 4 grading buttons (Again, Hard, Good, Easy)
 */
export function getIntervalPreviews(card: FsrsCard, now = new Date()): Record<ValidRating, IntervalPreviewItem> {
  const repeatRecord = fScheduler.repeat(card, now)

  const previews: Record<ValidRating, IntervalPreviewItem> = {
    [Rating.Again]: {
      rating: Rating.Again,
      label: formatIntervalPreview(repeatRecord[Rating.Again as Grade].card.due, now),
      due: repeatRecord[Rating.Again as Grade].card.due,
      scheduledDays: repeatRecord[Rating.Again as Grade].card.scheduled_days,
    },
    [Rating.Hard]: {
      rating: Rating.Hard,
      label: formatIntervalPreview(repeatRecord[Rating.Hard as Grade].card.due, now),
      due: repeatRecord[Rating.Hard as Grade].card.due,
      scheduledDays: repeatRecord[Rating.Hard as Grade].card.scheduled_days,
    },
    [Rating.Good]: {
      rating: Rating.Good,
      label: formatIntervalPreview(repeatRecord[Rating.Good as Grade].card.due, now),
      due: repeatRecord[Rating.Good as Grade].card.due,
      scheduledDays: repeatRecord[Rating.Good as Grade].card.scheduled_days,
    },
    [Rating.Easy]: {
      rating: Rating.Easy,
      label: formatIntervalPreview(repeatRecord[Rating.Easy as Grade].card.due, now),
      due: repeatRecord[Rating.Easy as Grade].card.due,
      scheduledDays: repeatRecord[Rating.Easy as Grade].card.scheduled_days,
    },
  }

  return previews
}

/**
 * Grades a card using ts-fsrs and returns the updated Card and ReviewLog
 */
export function gradeFsrsCard(card: FsrsCard, rating: ValidRating, now = new Date()): RecordLogItem {
  const record = fScheduler.repeat(card, now)
  return record[rating as Grade]
}

/** Short label for a card's FSRS state (Relearning counts as Review), shown on cards and list rows */
export function getStateLabel(state: number = State.New): string {
  if (state === State.New) return 'New'
  if (state === State.Learning) return 'Learning'
  return 'Review'
}
