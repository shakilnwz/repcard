import { useEffect } from 'react'
import { checkUrlHashForLibrary } from '@/features/repcard/lib/hashImport'
import { useAppStore } from '@/shared/store/useAppStore'

const FOREGROUND_SYNC_STALE_MS = 30_000

/**
 * Coordinates root startup URL routing (#import_lib= vs #auth_token= / ?auth_error=)
 * and root network/visibility delta-sync triggers without statically pulling Dexie or vaultService
 * into RepCard's initial flashcard chunk.
 */
export function useStartupCoordinator(): void {
  const setAuthError = useAppStore((s) => s.setAuthError)
  const setOnboardingOpen = useAppStore((s) => s.setOnboardingOpen)
  const setStageView = useAppStore((s) => s.setStageView)
  const setIsOnline = useAppStore((s) => s.setIsOnline)

  useEffect(() => {
    if (typeof window === 'undefined') return

    const handleLocationRouting = () => {
      // 1. RepCard #import_lib= share/QR links always route into Cards (consumed by useLibraries)
      if (checkUrlHashForLibrary()) {
        setStageView('cards')
        return
      }

      // 2. GitHub OAuth callback fragment or error query param routes into Knowledgebase Docs
      const url = new URL(window.location.href)
      const authErrorParam = url.searchParams.get('auth_error')
      const hashParams = new URLSearchParams(url.hash.replace(/^#/, ''))
      const authToken = hashParams.get('auth_token')
      const authUser = hashParams.get('auth_user')
      const authAvatar = hashParams.get('auth_avatar') || undefined

      if (authToken && authUser) {
        window.history.replaceState(null, '', url.pathname)
        setStageView('document')
        void import('@/features/vault/lib/vaultService')
          .then(async ({ hydrateVaultFromDb, connectWithOAuthToken }) => {
            await hydrateVaultFromDb()
            await connectWithOAuthToken({
              token: authToken,
              user: authUser,
              avatarUrl: authAvatar,
            })
          })
          .catch((err) => {
            setAuthError(
              err instanceof Error ? err.message : 'GitHub OAuth connection failed.',
            )
          })
      } else if (authErrorParam) {
        window.history.replaceState(null, '', url.pathname)
        setAuthError(authErrorParam)
        setOnboardingOpen(true)
        setStageView('document')
      }
    }

    handleLocationRouting()
    window.addEventListener('hashchange', handleLocationRouting)
    return () => window.removeEventListener('hashchange', handleLocationRouting)
  }, [setAuthError, setOnboardingOpen, setStageView])

  useEffect(() => {
    if (typeof window === 'undefined') return

    const triggerSilentDeltaSync = () => {
      const s = useAppStore.getState()
      if (s.vaultSource === 'github' && s.runtimeToken && !s.vaultLocked) {
        void import('@/features/vault/lib/vaultService')
          .then(({ syncNow }) => syncNow({ silent: true }))
          .catch(() => {})
      }
    }

    const handleOnline = () => {
      setIsOnline(true)
      triggerSilentDeltaSync()
    }

    const handleOffline = () => {
      setIsOnline(false)
    }

    const handleVisibility = () => {
      if (document.visibilityState !== 'visible') return
      const s = useAppStore.getState()
      const stale =
        !s.lastSyncedAt || Date.now() - s.lastSyncedAt > FOREGROUND_SYNC_STALE_MS
      if (stale && navigator.onLine !== false) {
        triggerSilentDeltaSync()
      }
    }

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    document.addEventListener('visibilitychange', handleVisibility)
    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
      document.removeEventListener('visibilitychange', handleVisibility)
    }
  }, [setIsOnline])
}
