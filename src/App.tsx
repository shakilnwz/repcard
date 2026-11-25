import { lazy, Suspense, useEffect, useLayoutEffect, useState } from 'react'
import { RepCardView } from '@/features/repcard/RepCardView'
import { BottomNavPill } from '@/shared/components/BottomNavPill'
import { SwUpdateToast } from '@/shared/components/SwUpdateToast'
import { useStartupCoordinator } from '@/shared/hooks/useStartupCoordinator'
import { applyColorMode } from '@/shared/lib/theme'
import { useAppStore } from '@/shared/store/useAppStore'

const KnowledgebaseShell = lazy(() => import('@/features/vault/KnowledgebaseShell'))

export function App() {
  useStartupCoordinator()

  const colorMode = useAppStore((s) => s.colorMode)
  const stageView = useAppStore((s) => s.stageView)

  useLayoutEffect(() => {
    applyColorMode(colorMode)
  }, [colorMode])
  const setStageView = useAppStore((s) => s.setStageView)
  const commandPaletteOpen = useAppStore((s) => s.commandPaletteOpen)
  const settingsOpen = useAppStore((s) => s.settingsOpen)
  const onboardingOpen = useAppStore((s) => s.onboardingOpen)
  const conflictModalOpen = useAppStore((s) => s.conflictModalOpen)
  const setCommandPaletteOpen = useAppStore((s) => s.setCommandPaletteOpen)
  const setSettingsOpen = useAppStore((s) => s.setSettingsOpen)

  const [isCardDragging, setIsCardDragging] = useState(false)
  const anyKbModalOpen = commandPaletteOpen || settingsOpen || onboardingOpen || conflictModalOpen

  // Allow Cmd/Ctrl+K (Search) and Cmd/Ctrl+, (Settings) from Cards view before KB shell mounts
  useEffect(() => {
    if (stageView !== 'cards') return

    const onKeyDown = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey
      if (!mod) return
      if (e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setIsCardDragging(false)
        setStageView('document')
        setCommandPaletteOpen(true)
      } else if (e.key === ',') {
        e.preventDefault()
        setIsCardDragging(false)
        setStageView('document')
        setSettingsOpen(true)
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [stageView, setStageView, setCommandPaletteOpen, setSettingsOpen])

  return (
    <div className="h-dvh w-full overflow-hidden flex flex-col bg-[var(--bg-app)] text-[var(--fg-app)]">
      {stageView === 'cards' ? (
        <RepCardView
          onDragActiveChange={setIsCardDragging}
          shortcutsBlocked={anyKbModalOpen}
        />
      ) : (
        <Suspense
          fallback={
            <div className="flex flex-1 items-center justify-center bg-[var(--bg-app)] text-xs font-bold text-[var(--fg-app)] opacity-80">
              Loading workspace…
            </div>
          }
        >
          <KnowledgebaseShell />
        </Suspense>
      )}

      <BottomNavPill
        stageView={stageView}
        onSelectStage={(next) => {
          setIsCardDragging(false)
          setStageView(next)
        }}
        hidden={(stageView === 'cards' && isCardDragging) || anyKbModalOpen}
      />

      <SwUpdateToast />
    </div>
  )
}

export default App
