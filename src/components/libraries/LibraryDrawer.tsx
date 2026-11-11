import { useState } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import {
  X,
  Plus,
  RefreshCw,
  Share2,
  Trash2,
  Check,
  AlertCircle,
  ShieldCheck,
  CheckCircle2,
  Database,
  RotateCcw,
  Palette,
  Sparkles,
} from '@/components/ui/MaterialIcons'
import type { LibrarySource } from '@/types/schema'
import { generateLibraryShareLink, type ImportableLibraryPayload } from '@/lib/hashImport'
import { STARTER_LIBRARY_ID } from '@/lib/starterDeck'
import { BackupModal } from './BackupModal'
import { FilterBar, type CramFilter } from '@/components/study/FilterBar'
import type { StudyMode, ColorPaletteMode } from '@/components/layout/AppHeader'

interface LibraryDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  // Study Mode & Filters
  mode: StudyMode;
  onModeChange: (mode: StudyMode) => void;
  dueCount: number;
  cramFilter: CramFilter;
  onCramFilterChange: (filter: CramFilter) => void;
  cramFilterCounts: Record<CramFilter, number>;
  countTowardSrs: boolean;
  onToggleCountTowardSrs: () => void;
  // Quick Actions
  canUndo: boolean;
  onUndo: () => void;
  colorMode: ColorPaletteMode;
  onCycleColorMode: () => void;
  // Libraries & Data
  libraries: LibrarySource[];
  syncingMap: Record<string, boolean>;
  pendingImport: ImportableLibraryPayload | null;
  reviewedCardsCount: number;
  onAddLibrary: (url: string, name?: string) => Promise<{ success: boolean; error?: string }>;
  onToggleEnabled: (id: string) => void;
  onSyncLibrary: (id: string, force?: boolean) => Promise<boolean>;
  onSyncAll: (force?: boolean) => Promise<void>;
  onRemoveLibrary: (id: string, purgeProgress?: boolean) => void;
  onConfirmPendingImport: () => Promise<unknown>;
  onDismissPendingImport: () => void;
  onRestoreComplete: () => void;
}

export function LibraryDrawer({
  open,
  onOpenChange,
  mode,
  onModeChange,
  dueCount,
  cramFilter,
  onCramFilterChange,
  cramFilterCounts,
  countTowardSrs,
  onToggleCountTowardSrs,
  canUndo,
  onUndo,
  colorMode,
  onCycleColorMode,
  libraries,
  syncingMap,
  pendingImport,
  reviewedCardsCount,
  onAddLibrary,
  onToggleEnabled,
  onSyncLibrary,
  onSyncAll,
  onRemoveLibrary,
  onConfirmPendingImport,
  onDismissPendingImport,
  onRestoreComplete,
}: LibraryDrawerProps) {
  const [urlInput, setUrlInput] = useState('')
  const [nameInput, setNameInput] = useState('')
  const [isAdding, setIsAdding] = useState(false)
  const [addError, setAddError] = useState<string | null>(null)
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null)
  const [backupOpen, setBackupOpen] = useState(false)

  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!urlInput.trim()) return

    setIsAdding(true)
    setAddError(null)

    const result = await onAddLibrary(urlInput, nameInput)
    setIsAdding(false)

    if (result.success) {
      setUrlInput('')
      setNameInput('')
    } else {
      setAddError(result.error || 'Failed to add library')
    }
  }

  const handleCopyShareLink = (lib: LibrarySource) => {
    if (!lib.url) return
    const link = generateLibraryShareLink({ name: lib.name, url: lib.url })
    navigator.clipboard.writeText(link).then(() => {
      setCopiedId(lib.id)
      setTimeout(() => setCopiedId(null), 2000)
    })
  }

  const colorModeLabel =
    colorMode === 'default'
      ? 'Lime Hero (Black)'
      : colorMode === 'navy-canvas'
      ? 'Lime Hero (Navy)'
      : 'Navy Hero (Black)'

  const isStarterOnly = libraries.length === 1 && libraries[0].id === STARTER_LIBRARY_ID

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 drawer-overlay" />
        <Dialog.Content className="fixed inset-y-0 right-0 w-full max-w-md bg-[var(--bg-app)] text-[var(--fg-app)] z-50 flex flex-col shadow-2xl focus:outline-hidden drawer-content">
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-5 bg-[var(--bg-card)] text-[var(--fg-card)] shadow-sm">
            <div>
              <Dialog.Title className="text-lg font-bold tracking-tight">
                Controls & Libraries
              </Dialog.Title>
              <p className="text-xs opacity-80 flex items-center gap-1 mt-0.5">
                <ShieldCheck className="w-3.5 h-3.5" />
                Endpoints stored strictly in browser localStorage
              </p>
            </div>
            <Dialog.Close asChild>
              <button
                className="w-8 h-8 rounded-lg flex items-center justify-center hover:opacity-80 transition-opacity"
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </Dialog.Close>
          </div>

          {/* Scrollable Content */}
          <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
            {/* Section 1: Study Mode Switcher */}
            <div className="space-y-3">
              <h3 className="text-xs uppercase tracking-wider font-bold opacity-80">
                Study Mode
              </h3>

              <div className="grid grid-cols-2 p-1 rounded-2xl bg-[var(--bg-card)] text-[var(--fg-card)] shadow-sm text-xs">
                {/* Due Queue Mode */}
                <button
                  onClick={() => onModeChange('due')}
                  className={`flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl font-bold transition-all ${
                    mode === 'due'
                      ? 'bg-[var(--fg-card)] text-[var(--bg-card)] shadow-xs'
                      : 'text-[var(--fg-card)] opacity-80 hover:opacity-100'
                  }`}
                >
                  <span>Due Queue</span>
                  <span
                    className={`px-1.5 py-0.2 text-[10px] rounded-full font-extrabold ${
                      mode === 'due'
                        ? 'bg-[var(--bg-card)] text-[var(--fg-card)]'
                        : 'bg-[var(--fg-card)] text-[var(--bg-card)]'
                    }`}
                  >
                    {dueCount}
                  </span>
                </button>

                {/* Practice Anytime Cram Mode */}
                <button
                  onClick={() => onModeChange('cram')}
                  className={`flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl font-bold transition-all ${
                    mode === 'cram'
                      ? 'bg-[var(--fg-card)] text-[var(--bg-card)] shadow-xs'
                      : 'text-[var(--fg-card)] opacity-80 hover:opacity-100'
                  }`}
                >
                  <span>Practice Anytime</span>
                  <span className="text-[10px] opacity-75">(Cram)</span>
                </button>
              </div>

              {/* If Cram Mode: Show Filter Bar & Schedule Count Toggle inside sidebar */}
              {mode === 'cram' && (
                <div className="p-3.5 rounded-2xl bg-[var(--bg-card)] text-[var(--fg-card)] shadow-xs space-y-3 mt-2">
                  <FilterBar
                    currentFilter={cramFilter}
                    onFilterChange={onCramFilterChange}
                    counts={cramFilterCounts}
                  />

                  <label className="flex items-center gap-2 pt-1 text-[11px] font-medium opacity-85 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={countTowardSrs}
                      onChange={onToggleCountTowardSrs}
                      className="rounded accent-[var(--fg-card)]"
                    />
                    <span>Count practice flips toward FSRS schedule</span>
                  </label>
                </div>
              )}
            </div>

            {/* Section 2: Quick Actions (Undo & Theme) */}
            <div className="space-y-3">
              <h3 className="text-xs uppercase tracking-wider font-bold opacity-80">
                Actions & Appearance
              </h3>

              <div className="grid grid-cols-2 gap-2.5">
                {/* Theme Cycle Button */}
                <button
                  onClick={onCycleColorMode}
                  className="flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl bg-[var(--bg-card)] text-[var(--fg-card)] text-xs font-bold shadow-xs hover:opacity-90 transition-opacity"
                  title="Switch 2-color layout"
                >
                  <Palette className="w-4 h-4" />
                  <span>{colorModeLabel}</span>
                </button>

                {/* Undo Button */}
                <button
                  onClick={onUndo}
                  disabled={!canUndo}
                  className="flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl bg-[var(--bg-card)] text-[var(--fg-card)] text-xs font-bold shadow-xs hover:opacity-90 transition-opacity disabled:opacity-40"
                  title={canUndo ? 'Undo last rating (U)' : 'No recent rating to undo'}
                >
                  <RotateCcw className="w-4 h-4" />
                  <span>Undo Last (U)</span>
                </button>
              </div>
            </div>

            {/* Pending URL Hash Import Banner */}
            {pendingImport && (
              <div className="p-4 rounded-2xl bg-[var(--bg-card)] text-[var(--fg-card)] shadow-sm space-y-3">
                <div className="flex items-start gap-2.5">
                  <CheckCircle2 className="w-5 h-5 shrink-0 mt-0.5" />
                  <div>
                    <h3 className="text-sm font-bold">
                      Import Library Detected
                    </h3>
                    <p className="text-xs opacity-85 mt-0.5">
                      Ready to add <strong>{pendingImport.name || 'Private Deck'}</strong> to your local study queue.
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 pt-1">
                  <button
                    onClick={onConfirmPendingImport}
                    className="flex-1 py-1.5 px-3 rounded-lg bg-[var(--fg-card)] text-[var(--bg-card)] text-xs font-bold shadow-xs hover:opacity-90 transition-opacity"
                  >
                    Confirm Import
                  </button>
                  <button
                    onClick={onDismissPendingImport}
                    className="py-1.5 px-3 rounded-lg opacity-85 hover:opacity-100 text-xs font-medium transition-opacity"
                  >
                    Dismiss
                  </button>
                </div>
              </div>
            )}

            {/* Starter Deck Alert */}
            {isStarterOnly && (
              <div className="p-3.5 rounded-2xl bg-[var(--bg-card)] text-[var(--fg-card)] shadow-xs text-xs space-y-1">
                <p className="font-bold flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5" /> Using built-in starter deck
                </p>
                <p className="opacity-85 leading-relaxed">
                  Add your personal Google Apps Script or JSON URL below to sync your cards.
                </p>
              </div>
            )}

            {/* Section 3: Configured Libraries List */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-xs uppercase tracking-wider font-bold opacity-80">
                  Configured Sources ({libraries.length})
                </h3>
                <button
                  onClick={() => onSyncAll(true)}
                  className="flex items-center gap-1 text-xs opacity-80 hover:opacity-100 font-semibold transition-opacity"
                >
                  <RefreshCw className="w-3 h-3" />
                  <span>Sync All</span>
                </button>
              </div>

              <div className="space-y-3">
                {libraries.map((lib) => {
                  const isSyncing = Boolean(syncingMap[lib.id])
                  const isStarter = lib.id === STARTER_LIBRARY_ID

                  return (
                    <div
                      key={lib.id}
                      className="p-4 rounded-2xl bg-[var(--bg-card)] text-[var(--fg-card)] shadow-sm space-y-3"
                    >
                      {/* Top Row: Name, Active Toggle, Card Count */}
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <h4 className="font-bold text-sm truncate">
                              {lib.name}
                            </h4>
                            {isStarter && (
                              <span className="px-1.5 py-0.2 text-[10px] font-bold rounded bg-[var(--fg-card)] text-[var(--bg-card)]">
                                Demo
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] opacity-80 mt-0.5">
                            {lib.cardCount} cards • {lib.lastSyncedAt ? 'Synced ' + new Date(lib.lastSyncedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Never synced'}
                          </p>
                        </div>

                        {/* Enable/Disable Toggle */}
                        <button
                          onClick={() => onToggleEnabled(lib.id)}
                          className={`px-3 py-1 text-xs font-bold rounded-lg shadow-xs transition-all ${
                            lib.enabled
                              ? 'bg-[var(--fg-card)] text-[var(--bg-card)]'
                              : 'opacity-60 hover:opacity-100'
                          }`}
                        >
                          {lib.enabled ? 'Active' : 'Disabled'}
                        </button>
                      </div>

                      {/* Error state if any */}
                      {lib.lastError && (
                        <div className="flex items-start gap-1.5 p-2 rounded-lg bg-[var(--bg-app)] text-[var(--fg-card)] text-xs font-medium">
                          <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                          <span className="break-all">{lib.lastError}</span>
                        </div>
                      )}

                      {/* Bottom Actions Row */}
                      <div className="flex items-center justify-between pt-1 text-xs opacity-90">
                        <div className="flex items-center gap-2">
                          {/* Sync Now */}
                          {!isStarter && (
                            <button
                              onClick={() => onSyncLibrary(lib.id, true)}
                              disabled={isSyncing}
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[var(--bg-app)] text-[var(--fg-card)] font-bold shadow-xs hover:opacity-90 transition-opacity disabled:opacity-50"
                            >
                              <RefreshCw className={`w-3 h-3 ${isSyncing ? 'animate-spin' : ''}`} />
                              <span>{isSyncing ? 'Syncing...' : 'Sync'}</span>
                            </button>
                          )}

                          {/* Copy Setup Link */}
                          {!isStarter && lib.url && (
                            <button
                              onClick={() => handleCopyShareLink(lib)}
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[var(--bg-app)] text-[var(--fg-card)] font-bold shadow-xs hover:opacity-90 transition-opacity"
                              title="Copy 1-tap setup link for mobile"
                            >
                              {copiedId === lib.id ? (
                                <>
                                  <Check className="w-3 h-3" />
                                  <span>Copied!</span>
                                </>
                              ) : (
                                <>
                                  <Share2 className="w-3 h-3" />
                                  <span>Share Link</span>
                                </>
                              )}
                            </button>
                          )}
                        </div>

                        {/* Delete Button */}
                        {!isStarter && (
                          <div>
                            {deleteConfirmId === lib.id ? (
                              <div className="flex items-center gap-1.5">
                                <button
                                  onClick={() => {
                                    onRemoveLibrary(lib.id, false)
                                    setDeleteConfirmId(null)
                                  }}
                                  className="px-2.5 py-1 rounded-lg bg-[var(--bg-app)] text-[var(--fg-card)] text-xs font-bold shadow-xs"
                                >
                                  Delete
                                </button>
                                <button
                                  onClick={() => setDeleteConfirmId(null)}
                                  className="px-2 py-1 text-xs opacity-80"
                                >
                                  Cancel
                                </button>
                              </div>
                            ) : (
                              <button
                                onClick={() => setDeleteConfirmId(lib.id)}
                                className="p-1 opacity-70 hover:opacity-100 transition-opacity"
                                title="Remove library"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Section 4: Add New Library Form */}
            <div className="p-5 rounded-2xl bg-[var(--bg-card)] text-[var(--fg-card)] shadow-sm space-y-3.5">
              <h3 className="text-xs uppercase tracking-wider font-bold flex items-center gap-1.5 opacity-90">
                <Plus className="w-4 h-4" />
                Add Remote Library
              </h3>

              <form onSubmit={handleAddSubmit} className="space-y-3">
                <div>
                  <label className="block text-xs font-medium opacity-85 mb-1">
                    Endpoint URL (Google Apps Script / JSON) *
                  </label>
                  <input
                    type="url"
                    required
                    placeholder="https://script.google.com/macros/s/.../exec"
                    value={urlInput}
                    onChange={(e) => setUrlInput(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-xl bg-[var(--bg-app)] text-[var(--fg-card)] placeholder-[var(--fg-card)]/50 focus:outline-hidden shadow-xs font-medium"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium opacity-85 mb-1">
                    Library Label (Optional)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. My AI & Systems Flashcards"
                    value={nameInput}
                    onChange={(e) => setNameInput(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-xl bg-[var(--bg-app)] text-[var(--fg-card)] placeholder-[var(--fg-card)]/50 focus:outline-hidden shadow-xs font-medium"
                  />
                </div>

                {addError && (
                  <div className="p-2.5 rounded-xl bg-[var(--bg-app)] text-[var(--fg-card)] text-xs font-medium flex items-start gap-1.5 shadow-xs">
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                    <span>{addError}</span>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={isAdding || !urlInput.trim()}
                  className="w-full py-2.5 px-4 rounded-xl bg-[var(--fg-card)] text-[var(--bg-card)] text-xs font-bold hover:opacity-90 transition-opacity flex items-center justify-center gap-2 shadow-sm disabled:opacity-50"
                >
                  {isAdding ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Validating & Connecting...</span>
                    </>
                  ) : (
                    <>
                      <Plus className="w-3.5 h-3.5" />
                      <span>Validate & Add Library</span>
                    </>
                  )}
                </button>
              </form>
            </div>

            {/* Section 5: Backup & Restore */}
            <div className="pt-1">
              <button
                type="button"
                onClick={() => setBackupOpen(true)}
                className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-[var(--bg-card)] text-[var(--fg-card)] text-xs font-bold shadow-sm hover:opacity-90 transition-opacity"
              >
                <Database className="w-4 h-4" />
                <span>Backup & Restore (JSON)</span>
              </button>
            </div>
          </div>

          {/* Backup Modal */}
          <BackupModal
            open={backupOpen}
            onOpenChange={setBackupOpen}
            librariesCount={libraries.length}
            reviewedCardsCount={reviewedCardsCount}
            onRestoreComplete={onRestoreComplete}
          />
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
