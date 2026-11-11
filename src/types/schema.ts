import { z } from 'zod'

// Single Flashcard Item in remote payload or local cache
export const FlashcardFieldsSchema = z.object({
  whatItIs: z.string().default(''),
  problemSolved: z.string().default(''),
  productionContext: z.string().default(''),
})

export const FlashcardItemSchema = z.object({
  id: z.string().min(1),
  dateAdded: z.string().default(() => new Date().toISOString()),
  term: z.string().min(1),
  domain: z.string().default('System Design'),
  level: z.string().default('High-Level'),
  fields: FlashcardFieldsSchema,
  referenceUrl: z.string().url().nullable().optional(),
  sheetStatus: z.string().optional(),
  tags: z.array(z.string()).default([]),
})

export const RemoteLibraryMetaSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  version: z.string().default('1.0.0'),
  updatedAt: z.string().optional(),
  cardCount: z.number().optional(),
})

export const RemoteLibraryPayloadSchema = z.object({
  library: RemoteLibraryMetaSchema,
  cards: z.array(FlashcardItemSchema),
})

export type FlashcardFields = z.infer<typeof FlashcardFieldsSchema>
export type FlashcardItem = z.infer<typeof FlashcardItemSchema>
export type RemoteLibraryMeta = z.infer<typeof RemoteLibraryMetaSchema>
export type RemoteLibraryPayload = z.infer<typeof RemoteLibraryPayloadSchema>

// Configured remote library source
export interface LibrarySource {
  id: string;            // UUID or library.id
  name: string;          // User-visible label (e.g., "AI Systems & CS Tracker")
  url: string;           // Private GAS endpoint or static JSON URL
  enabled: boolean;      // Included in study queues
  lastSyncedAt: string | null;
  cardCount: number;
  lastError?: string | null;
}

// FSRS Card data serialized for JSON persistence
export interface SerializedFsrsCard {
  due: string;           // ISO date string
  stability: number;
  difficulty: number;
  scheduled_days: number;
  learning_steps?: number;
  reps: number;
  lapses: number;
  state: number;         // 0: New, 1: Learning, 2: Review, 3: Relearning
  last_review?: string;  // ISO date string
}

// Local review and practice progress for a card
export interface LocalCardProgress {
  key: string;           // Composite key: "${libraryId}::${cardId}"
  libraryId: string;
  cardId: string;
  fsrs: SerializedFsrsCard;
  cramCount: number;     // Extra practice flips outside normal SRS due schedule
  bookmarked: boolean;   // Starred for quick filter
  lastRatedAt: string;   // ISO date string
}

// 1-step undo entry for accidental ratings
export interface RatingUndoEntry {
  cardKey: string;
  previousProgress: LocalCardProgress | null;
  timestamp: string;
}

// Full app backup export/import payload
export interface AppExportData {
  version: number;
  exportedAt: string;
  libraries: LibrarySource[];
  progress: Record<string, LocalCardProgress>;
}

// Helper to create composite key
export function makeCardCompositeKey(libraryId: string, cardId: string): string {
  return `${libraryId}::${cardId}`
}

// Helper to split composite key
export function parseCardCompositeKey(key: string): { libraryId: string; cardId: string } {
  const [libraryId, ...rest] = key.split('::')
  return {
    libraryId: libraryId || '',
    cardId: rest.join('::'),
  }
}
