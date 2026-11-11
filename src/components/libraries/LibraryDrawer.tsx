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
} from 'lucide-react'
import type { LibrarySource } from '@/types/schema'
import { generateLibraryShareLink, type ImportableLibraryPayload } from '@/lib/hashImport'
import { STARTER_LIBRARY_ID } from '@/lib/starterDeck'

interface LibraryDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  libraries: LibrarySource[];
  syncingMap: Record<string, boolean>;
  pendingImport: ImportableLibraryPayload | null;
  onAddLibrary: (url: string, name?: string) => Promise<{ success: boolean; error?: string }>;
  onToggleEnabled: (id: string) => void;
  onSyncLibrary: (id: string, force?: boolean) => Promise<boolean>;
  onSyncAll: (force?: boolean) => Promise<void>;
  onRemoveLibrary: (id: string, purgeProgress?: boolean) => void;
  onConfirmPendingImport: () => Promise<unknown>;
  onDismissPendingImport: () => void;
}

export function LibraryDrawer({
  open,
  onOpenChange,
  libraries,
  syncingMap,
  pendingImport,
  onAddLibrary,
  onToggleEnabled,
  onSyncLibrary,
  onSyncAll,
  onRemoveLibrary,
  onConfirmPendingImport,
  onDismissPendingImport,
}: LibraryDrawerProps) {
  const [urlInput, setUrlInput] = useState('')
  const [nameInput, setNameInput] = useState('')
  const [isAdding, setIsAdding] = useState(false)
  const [addError, setAddError] = useState<string | null>(null)
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null)

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

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 animate-in fade-in duration-200" />
        <Dialog.Content className="fixed inset-y-0 right-0 w-full max-w-md bg-[var(--bg-canvas)] border-l border-[var(--border-subtle)] text-[var(--text-primary)] z-50 flex flex-col shadow-2xl focus:outline-hidden animate-in slide-in-from-right duration-200">
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border-subtle)] bg-[var(--bg-surface)]">
            <div>
              <Dialog.Title className="font-[family-name:var(--font-display)] text-lg font-bold tracking-tight text-[var(--text-primary)]">
                Libraries & Sync
              </Dialog.Title>
              <p className="text-xs text-[var(--text-secondary)] flex items-center gap-1 mt-0.5">
                <ShieldCheck className="w-3.5 h-3.5 text-[var(--accent-mint)]" />
                Endpoints stored strictly in browser localStorage
              </p>
            </div>
            <Dialog.Close asChild>
              <button
                className="w-8 h-8 rounded-lg flex items-center justify-center text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-elevated)] transition-colors"
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </Dialog.Close>
          </div>

          {/* Scrollable Content */}
          <div className="flex-1 overflow-y-auto px-5 py-4 space-y-6">
            {/* Pending URL Hash Import Banner */}
            {pendingImport && (
              <div className="p-4 rounded-xl bg-[var(--bg-surface)] border border-[var(--accent-mint)] space-y-3">
                <div className="flex items-start gap-2.5">
                  <CheckCircle2 className="w-5 h-5 text-[var(--accent-mint)] shrink-0 mt-0.5" />
                  <div>
                    <h3 className="font-[family-name:var(--font-display)] text-sm font-bold text-[var(--text-primary)]">
                      Import Library Detected
                    </h3>
                    <p className="text-xs text-[var(--text-secondary)] mt-0.5">
                      Ready to add <strong className="text-[var(--text-primary)]">{pendingImport.name || 'Private Deck'}</strong> to your local study queue.
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 pt-1">
                  <button
                    onClick={onConfirmPendingImport}
                    className="flex-1 py-1.5 px-3 rounded-lg bg-[var(--accent-mint)] text-[var(--accent-mint-fg)] font-[family-name:var(--font-display)] text-xs font-bold hover:opacity-90 transition-opacity"
                  >
                    Confirm Import
                  </button>
                  <button
                    onClick={onDismissPendingImport}
                    className="py-1.5 px-3 rounded-lg bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-xs font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
                  >
                    Dismiss
                  </button>
                </div>
              </div>
            )}

            {/* Configured Libraries List */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-[family-name:var(--font-display)] text-xs uppercase tracking-wider text-[var(--accent-mint)] font-semibold">
                  Configured Sources ({libraries.length})
                </h3>
                <button
                  onClick={() => onSyncAll(true)}
                  className="flex items-center gap-1 text-xs text-[var(--text-secondary)] hover:text-[var(--accent-mint)] transition-colors"
                >
                  <RefreshCw className="w-3 h-3" />
                  <span>Sync All</span>
                </button>
              </div>

              <div className="space-y-2.5">
                {libraries.map((lib) => {
                  const isSyncing = Boolean(syncingMap[lib.id])
                  const isStarter = lib.id === STARTER_LIBRARY_ID

                  return (
                    <div
                      key={lib.id}
                      className="p-3.5 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] space-y-2.5"
                    >
                      {/* Top Row: Name, Active Toggle, Card Count */}
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <h4 className="font-[family-name:var(--font-display)] font-semibold text-sm text-[var(--text-primary)] truncate">
                              {lib.name}
                            </h4>
                            {isStarter && (
                              <span className="px-1.5 py-0.2 text-[10px] font-semibold rounded bg-[var(--bg-elevated)] text-[var(--accent-mint)] border border-[var(--border-subtle)]">
                                Demo
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-[var(--text-secondary)] mt-0.5">
                            {lib.cardCount} cards • {lib.lastSyncedAt ? 'Synced ' + new Date(lib.lastSyncedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Never synced'}
                          </p>
                        </div>

                        {/* Enable/Disable Toggle */}
                        <button
                          onClick={() => onToggleEnabled(lib.id)}
                          className={`px-2.5 py-1 text-xs font-[family-name:var(--font-display)] font-semibold rounded transition-colors ${
                            lib.enabled
                              ? 'bg-[var(--accent-mint)] text-[var(--accent-mint-fg)]'
                              : 'bg-[var(--bg-elevated)] text-[var(--text-secondary)] border border-[var(--border-subtle)]'
                          }`}
                        >
                          {lib.enabled ? 'Active' : 'Disabled'}
                        </button>
                      </div>

                      {/* Error state if any */}
                      {lib.lastError && (
                        <div className="flex items-start gap-1.5 p-2 rounded bg-red-950/40 border border-red-900/60 text-xs text-red-300">
                          <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5 text-red-400" />
                          <span className="break-all">{lib.lastError}</span>
                        </div>
                      )}

                      {/* Bottom Actions Row */}
                      <div className="flex items-center justify-between pt-1 border-t border-[var(--border-subtle)]/60 text-xs">
                        <div className="flex items-center gap-1.5">
                          {/* Sync Now */}
                          {!isStarter && (
                            <button
                              onClick={() => onSyncLibrary(lib.id, true)}
                              disabled={isSyncing}
                              className="inline-flex items-center gap-1 px-2 py-1 rounded bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors disabled:opacity-50"
                            >
                              <RefreshCw className={`w-3 h-3 ${isSyncing ? 'animate-spin text-[var(--accent-mint)]' : ''}`} />
                              <span>{isSyncing ? 'Syncing...' : 'Sync'}</span>
                            </button>
                          )}

                          {/* Copy Setup Link */}
                          {!isStarter && lib.url && (
                            <button
                              onClick={() => handleCopyShareLink(lib)}
                              className="inline-flex items-center gap-1 px-2 py-1 rounded bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
                              title="Copy 1-tap setup link for mobile"
                            >
                              {copiedId === lib.id ? (
                                <>
                                  <Check className="w-3 h-3 text-[var(--accent-mint)]" />
                                  <span className="text-[var(--accent-mint)]">Copied!</span>
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
                              <div className="flex items-center gap-1">
                                <button
                                  onClick={() => {
                                    onRemoveLibrary(lib.id, false)
                                    setDeleteConfirmId(null)
                                  }}
                                  className="px-2 py-0.5 rounded bg-red-600 text-white text-[11px] font-semibold"
                                >
                                  Delete
                                </button>
                                <button
                                  onClick={() => setDeleteConfirmId(null)}
                                  className="px-1.5 py-0.5 text-[11px] text-[var(--text-secondary)]"
                                >
                                  Cancel
                                </button>
                              </div>
                            ) : (
                              <button
                                onClick={() => setDeleteConfirmId(lib.id)}
                                className="p-1 text-[var(--text-secondary)] hover:text-red-400 transition-colors"
                                title="Remove library"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
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

            {/* Add New Library Form */}
            <div className="p-4 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] space-y-3.5">
              <h3 className="font-[family-name:var(--font-display)] text-xs uppercase tracking-wider text-[var(--accent-mint)] font-semibold flex items-center gap-1.5">
                <Plus className="w-3.5 h-3.5" />
                Add Remote Library
              </h3>

              <form onSubmit={handleAddSubmit} className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
                    Endpoint URL (Google Apps Script / JSON) *
                  </label>
                  <input
                    type="url"
                    required
                    placeholder="https://script.google.com/macros/s/.../exec"
                    value={urlInput}
                    onChange={(e) => setUrlInput(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-lg bg-[var(--bg-canvas)] border border-[var(--border-subtle)] text-[var(--text-primary)] placeholder-[var(--text-secondary)]/50 focus:outline-hidden focus:border-[var(--accent-mint)]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
                    Library Label (Optional)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. My AI & Systems Flashcards"
                    value={nameInput}
                    onChange={(e) => setNameInput(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-lg bg-[var(--bg-canvas)] border border-[var(--border-subtle)] text-[var(--text-primary)] placeholder-[var(--text-secondary)]/50 focus:outline-hidden focus:border-[var(--accent-mint)]"
                  />
                </div>

                {addError && (
                  <div className="p-2.5 rounded bg-red-950/40 border border-red-900/60 text-xs text-red-300 flex items-start gap-1.5">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5 text-red-400" />
                    <span>{addError}</span>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={isAdding || !urlInput.trim()}
                  className="w-full py-2.5 px-4 rounded-lg bg-[var(--accent-mint)] text-[var(--accent-mint-fg)] font-[family-name:var(--font-display)] text-xs font-bold hover:opacity-90 transition-opacity flex items-center justify-center gap-2 disabled:opacity-50"
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

            {/* Quick Tip on Privacy */}
            <div className="p-3.5 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-xs text-[var(--text-secondary)] space-y-1">
              <p className="font-semibold text-[var(--text-primary)]">Tip: 1-Tap Mobile Sync</p>
              <p>
                Click <strong>Share Link</strong> on any library to copy an encrypted URL hash link. Open that link on your phone browser to instantly prefill your endpoint without typing.
              </p>
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
