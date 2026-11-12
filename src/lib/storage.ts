import type {
  LibrarySource,
  FlashcardItem,
  LocalCardProgress,
  AppExportData,
} from '@/types/schema'
import { STARTER_LIBRARY_ID, STARTER_LIBRARY_META, STARTER_CARDS } from './starterDeck'

const KEY_LIBRARIES = 'srs:libraries:v1'
const PREFIX_CARDS = 'srs:cards:v1:'
const KEY_PROGRESS = 'srs:progress:v1'
const KEY_ACTIVE_LIB = 'srs:active_library:v1'
const KEY_COLOR_MODE = 'srs:color_mode:v1'
const KEY_CARD_SORT = 'srs:card_sort:v1'
const KEY_RATING_BUTTONS = 'srs:rating_buttons:v1'

function safeGetItem<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return fallback
    return JSON.parse(raw) as T
  } catch (err) {
    console.error(`[storage] Failed to parse localStorage key "${key}":`, err)
    return fallback
  }
}

function safeSetItem<T>(key: string, value: T): boolean {
  try {
    localStorage.setItem(key, JSON.stringify(value))
    return true
  } catch (err) {
    console.error(`[storage] Failed to write localStorage key "${key}":`, err)
    return false
  }
}

/**
 * Retrieves all configured library sources.
 * If none exist, initializes with the default starter deck.
 */
export function getLibraries(): LibrarySource[] {
  const libs = safeGetItem<LibrarySource[]>(KEY_LIBRARIES, [])
  if (libs.length === 0) {
    // Seed starter deck on first launch
    const initialLibs = [STARTER_LIBRARY_META]
    saveLibraries(initialLibs)
    saveCachedCards(STARTER_LIBRARY_ID, STARTER_CARDS)
    return initialLibs
  }
  return libs
}

/**
 * Saves library sources list to localStorage.
 */
export function saveLibraries(libraries: LibrarySource[]): boolean {
  return safeSetItem(KEY_LIBRARIES, libraries)
}

/**
 * Gets cached flashcards for a specific library.
 */
export function getCachedCards(libraryId: string): FlashcardItem[] {
  if (libraryId === STARTER_LIBRARY_ID) {
    const cached = safeGetItem<FlashcardItem[]>(`${PREFIX_CARDS}${libraryId}`, [])
    return cached.length > 0 ? cached : STARTER_CARDS
  }
  return safeGetItem<FlashcardItem[]>(`${PREFIX_CARDS}${libraryId}`, [])
}

/**
 * Saves/updates cached cards for a library.
 */
export function saveCachedCards(libraryId: string, cards: FlashcardItem[]): boolean {
  return safeSetItem(`${PREFIX_CARDS}${libraryId}`, cards)
}

/**
 * Removes cached cards for a deleted library.
 */
export function removeCachedCards(libraryId: string): void {
  try {
    localStorage.removeItem(`${PREFIX_CARDS}${libraryId}`)
  } catch (err) {
    console.error(`[storage] Failed to remove cached cards for "${libraryId}":`, err)
  }
}

/**
 * Retrieves all card progress keyed by composite key "${libraryId}::${cardId}".
 */
export function getAllProgress(): Record<string, LocalCardProgress> {
  return safeGetItem<Record<string, LocalCardProgress>>(KEY_PROGRESS, {})
}

/**
 * Retrieves single card progress by composite key.
 */
export function getCardProgress(compositeKey: string): LocalCardProgress | null {
  const all = getAllProgress()
  return all[compositeKey] || null
}

/**
 * Saves/updates single card progress.
 */
export function saveCardProgress(progress: LocalCardProgress): boolean {
  const all = getAllProgress()
  all[progress.key] = progress
  return safeSetItem(KEY_PROGRESS, all)
}

/**
 * Batch saves all progress records.
 */
export function saveAllProgress(progress: Record<string, LocalCardProgress>): boolean {
  return safeSetItem(KEY_PROGRESS, progress)
}

/**
 * Removes progress for cards belonging to a deleted library.
 */
export function purgeLibraryProgress(libraryId: string): void {
  const all = getAllProgress()
  const updated: Record<string, LocalCardProgress> = {}
  for (const [key, val] of Object.entries(all)) {
    if (!key.startsWith(`${libraryId}::`)) {
      updated[key] = val
    }
  }
  saveAllProgress(updated)
}

/**
 * Active library ID filter state (or 'all' for combined queue).
 */
export function getActiveLibraryId(): string {
  try {
    return localStorage.getItem(KEY_ACTIVE_LIB) || 'all'
  } catch {
    return 'all'
  }
}

export function setActiveLibraryId(id: string): void {
  try {
    localStorage.setItem(KEY_ACTIVE_LIB, id)
  } catch (err) {
    console.error('[storage] Failed to set active library:', err)
  }
}

/**
 * Exports complete application state for offline JSON backup.
 */
export function exportAppData(): AppExportData {
  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    libraries: getLibraries(),
    progress: getAllProgress(),
  }
}

/**
 * Imports application backup data from JSON with validation.
 */
export function importAppData(jsonString: string): { success: boolean; error?: string } {
  try {
    const data = JSON.parse(jsonString) as AppExportData
    if (!data || typeof data !== 'object') {
      return { success: false, error: 'Invalid JSON format' }
    }
    if (!Array.isArray(data.libraries) || typeof data.progress !== 'object') {
      return { success: false, error: 'Missing required libraries or progress fields' }
    }

    saveLibraries(data.libraries)
    saveAllProgress(data.progress)
    return { success: true }
  } catch (err) {
    return { success: false, error: (err as Error).message }
  }
}

/**
 * Color mode preference (raw string; the caller validates it against the known modes)
 */
export function getColorModePreference(): string | null {
  return safeGetItem<string | null>(KEY_COLOR_MODE, null)
}

export function saveColorModePreference(mode: string): boolean {
  return safeSetItem(KEY_COLOR_MODE, mode)
}

/**
 * Card sort order preference (raw string; the caller validates it against the known orders)
 */
export function getCardSortPreference(): string | null {
  return safeGetItem<string | null>(KEY_CARD_SORT, null)
}

export function saveCardSortPreference(order: string): boolean {
  return safeSetItem(KEY_CARD_SORT, order)
}

/**
 * Whether the rating buttons show under the card (off by default: grading is by swipe)
 */
export function getRatingButtonsPreference(): boolean {
  return safeGetItem<boolean>(KEY_RATING_BUTTONS, false) === true
}

export function saveRatingButtonsPreference(show: boolean): boolean {
  return safeSetItem(KEY_RATING_BUTTONS, show)
}
