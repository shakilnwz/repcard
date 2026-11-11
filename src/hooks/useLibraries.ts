import { useState, useEffect, useCallback, useMemo } from 'react'
import {
  RemoteLibraryPayloadSchema,
  type LibrarySource,
  type FlashcardItem,
} from '@/types/schema'
import {
  getLibraries,
  saveLibraries,
  getCachedCards,
  saveCachedCards,
  removeCachedCards,
  purgeLibraryProgress,
} from '@/lib/storage'
import {
  checkUrlHashForLibrary,
  clearImportHash,
  type ImportableLibraryPayload,
} from '@/lib/hashImport'
import { STARTER_LIBRARY_ID, STARTER_LIBRARY_META, STARTER_CARDS } from '@/lib/starterDeck'

/**
 * Builds request URL, appending refresh query param if force=true
 */
function buildFetchUrl(rawUrl: string, force = false): string {
  if (!force) return rawUrl
  try {
    const urlObj = new URL(rawUrl)
    urlObj.searchParams.set('refresh', '1')
    return urlObj.toString()
  } catch {
    const separator = rawUrl.includes('?') ? '&' : '?'
    return `${rawUrl}${separator}refresh=1`
  }
}

export function useLibraries() {
  const [libraries, setLibraries] = useState<LibrarySource[]>(() => getLibraries())
  const [syncingMap, setSyncingMap] = useState<Record<string, boolean>>({})
  const [pendingImport, setPendingImport] = useState<ImportableLibraryPayload | null>(() => checkUrlHashForLibrary())

  // Track cached cards per library in memory
  const [cardsByLibrary, setCardsByLibrary] = useState<Record<string, FlashcardItem[]>>(() => {
    const initialLibs = getLibraries()
    const map: Record<string, FlashcardItem[]> = {}
    for (const lib of initialLibs) {
      map[lib.id] = getCachedCards(lib.id)
    }
    return map
  })

  // Sync a single library over the network
  const syncLibrary = useCallback(async (libraryId: string, force = false): Promise<boolean> => {
    const lib = libraries.find((item) => item.id === libraryId)
    if (!lib || !lib.url) {
      // Starter deck has no remote URL
      if (lib && lib.id === STARTER_LIBRARY_ID) {
        setCardsByLibrary((prev) => ({ ...prev, [lib.id]: STARTER_CARDS }))
        return true
      }
      return false
    }

    setSyncingMap((prev) => ({ ...prev, [libraryId]: true }))

    try {
      const fetchUrl = buildFetchUrl(lib.url, force)
      const res = await fetch(fetchUrl, {
        method: 'GET',
        headers: { Accept: 'application/json' },
      })

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: ${res.statusText}`)
      }

      const rawJson = await res.json()
      const parseResult = RemoteLibraryPayloadSchema.safeParse(rawJson)

      if (!parseResult.success) {
        const issues = parseResult.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join(', ')
        throw new Error(`Schema validation failed: ${issues}`)
      }

      const { library: meta, cards } = parseResult.data

      // Save to localStorage
      saveCachedCards(libraryId, cards)

      // Update in-memory cards
      setCardsByLibrary((prev) => ({ ...prev, [libraryId]: cards }))

      // Update library source metadata
      setLibraries((prev) => {
        const updated = prev.map((item) => {
          if (item.id === libraryId) {
            return {
              ...item,
              name: item.name || meta.title,
              cardCount: cards.length,
              lastSyncedAt: new Date().toISOString(),
              lastError: null,
            }
          }
          return item
        })
        saveLibraries(updated)
        return updated
      })

      return true
    } catch (err) {
      const errorMsg = (err as Error).message || 'Failed to sync library'
      console.warn(`[useLibraries] Sync error for "${lib.name}":`, errorMsg)

      setLibraries((prev) => {
        const updated = prev.map((item) => {
          if (item.id === libraryId) {
            return { ...item, lastError: errorMsg }
          }
          return item
        })
        saveLibraries(updated)
        return updated
      })

      return false
    } finally {
      setSyncingMap((prev) => ({ ...prev, [libraryId]: false }))
    }
  }, [libraries])

  // Concurrently sync all enabled libraries on boot (Stale-While-Revalidate)
  const syncAll = useCallback(async (force = false) => {
    const targets = libraries.filter((lib) => lib.enabled && Boolean(lib.url))
    if (targets.length === 0) return

    await Promise.allSettled(
      targets.map((lib) => syncLibrary(lib.id, force)),
    )
  }, [libraries, syncLibrary])

  // A share link opened while the app is already running (e.g. an installed PWA receiving a
  // scanned QR link) only changes the hash, so pick it up without a reload
  useEffect(() => {
    const onHashChange = () => {
      const payload = checkUrlHashForLibrary()
      if (payload) setPendingImport(payload)
    }
    window.addEventListener('hashchange', onHashChange)
    return () => window.removeEventListener('hashchange', onHashChange)
  }, [])

  // Run background stale-while-revalidate sync once on initial mount
  useEffect(() => {
    syncAll(false)
    // Run only once on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Add a new remote library source with live pre-validation fetch
  const addLibrary = useCallback(async (
    url: string,
    customName?: string,
  ): Promise<{ success: boolean; error?: string; library?: LibrarySource }> => {
    const trimmedUrl = url.trim()
    if (!trimmedUrl) {
      return { success: false, error: 'Endpoint URL is required' }
    }

    try {
      new URL(trimmedUrl)
    } catch {
      return { success: false, error: 'Please enter a valid HTTP or HTTPS URL' }
    }

    // Check if URL already exists
    const duplicate = libraries.find((l) => l.url.trim() === trimmedUrl)
    if (duplicate) {
      return { success: false, error: `This URL is already added as "${duplicate.name}"` }
    }

    try {
      const res = await fetch(trimmedUrl, {
        method: 'GET',
        headers: { Accept: 'application/json' },
      })

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: ${res.statusText}`)
      }

      const rawJson = await res.json()
      const parseResult = RemoteLibraryPayloadSchema.safeParse(rawJson)

      if (!parseResult.success) {
        const issues = parseResult.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join(', ')
        throw new Error(`Invalid library schema: ${issues}`)
      }

      const { library: meta, cards } = parseResult.data
      const newId = meta.id || `lib-${Date.now()}`

      const newSource: LibrarySource = {
        id: newId,
        name: customName?.trim() || meta.title || 'Remote Flashcards',
        url: trimmedUrl,
        enabled: true,
        lastSyncedAt: new Date().toISOString(),
        cardCount: cards.length,
        lastError: null,
      }

      // If user had only the starter deck, disable starter deck by default when adding custom deck
      const nextLibraries = libraries.map((lib) => {
        if (lib.id === STARTER_LIBRARY_ID) {
          return { ...lib, enabled: false }
        }
        return lib
      })

      const updatedList = [...nextLibraries, newSource]
      saveLibraries(updatedList)
      setLibraries(updatedList)

      // Cache cards
      saveCachedCards(newId, cards)
      setCardsByLibrary((prev) => ({ ...prev, [newId]: cards }))

      return { success: true, library: newSource }
    } catch (err) {
      return { success: false, error: (err as Error).message || 'Failed to fetch and validate endpoint' }
    }
  }, [libraries])

  // Edit existing library source
  const updateLibrary = useCallback((id: string, updates: Partial<LibrarySource>) => {
    setLibraries((prev) => {
      const updated = prev.map((item) => (item.id === id ? { ...item, ...updates } : item))
      saveLibraries(updated)
      return updated
    })
  }, [])

  // Toggle active queue participation
  const toggleLibraryEnabled = useCallback((id: string) => {
    setLibraries((prev) => {
      const updated = prev.map((item) => (item.id === id ? { ...item, enabled: !item.enabled } : item))
      saveLibraries(updated)
      return updated
    })
  }, [])

  // Remove a library source
  const removeLibrary = useCallback((id: string, purgeProgress = false) => {
    setLibraries((prev) => {
      const updated = prev.filter((item) => item.id !== id)
      // Ensure at least starter deck is available if all removed
      if (updated.length === 0) {
        const starter = [STARTER_LIBRARY_META]
        saveLibraries(starter)
        return starter
      }
      saveLibraries(updated)
      return updated
    })

    removeCachedCards(id)
    setCardsByLibrary((prev) => {
      const copy = { ...prev }
      delete copy[id]
      return copy
    })

    if (purgeProgress) {
      purgeLibraryProgress(id)
    }
  }, [])

  // Confirm pending #import_lib from URL hash
  const confirmPendingImport = useCallback(async () => {
    if (!pendingImport) return
    const res = await addLibrary(pendingImport.url, pendingImport.name)
    if (res.success) {
      clearImportHash()
      setPendingImport(null)
    }
    return res
  }, [pendingImport, addLibrary])

  // Dismiss pending import
  const dismissPendingImport = useCallback(() => {
    clearImportHash()
    setPendingImport(null)
  }, [])

  // Compute active cards from all enabled libraries
  const activeCards = useMemo(() => {
    const list: FlashcardItem[] = []
    const enabledLibs = libraries.filter((lib) => lib.enabled)

    for (const lib of enabledLibs) {
      const cards = cardsByLibrary[lib.id] || []
      // Attach library id to cards if not present
      for (const card of cards) {
        list.push(card)
      }
    }

    return list
  }, [libraries, cardsByLibrary])

  const isAnySyncing = useMemo(() => {
    return Object.values(syncingMap).some(Boolean)
  }, [syncingMap])

  return {
    libraries,
    activeCards,
    cardsByLibrary,
    isSyncing: isAnySyncing,
    syncingMap,
    pendingImport,
    addLibrary,
    updateLibrary,
    toggleLibraryEnabled,
    removeLibrary,
    syncLibrary,
    syncAll,
    confirmPendingImport,
    dismissPendingImport,
  }
}
