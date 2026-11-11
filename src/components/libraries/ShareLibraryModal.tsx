import { useMemo, useState } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { X, Check, Copy, Share2, QrCode, ShieldCheck } from '@/components/ui/MaterialIcons'
import { QrCodeImage } from '@/components/ui/QrCodeImage'
import { generateLibraryShareLink } from '@/lib/hashImport'
import type { LibrarySource } from '@/types/schema'

interface ShareLibraryModalProps {
  /** The library being shared. Kept by the parent after closing so the exit animation has content. */
  library: LibrarySource | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ShareLibraryModal({ library, open, onOpenChange }: ShareLibraryModalProps) {
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'failed'>('idle')

  const link = useMemo(
    () => (library?.url ? generateLibraryShareLink({ name: library.name, url: library.url }) : ''),
    [library],
  )
  const canNativeShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function'

  const handleCopy = () => {
    if (!navigator.clipboard) {
      setCopyState('failed')
      return
    }
    navigator.clipboard.writeText(link).then(
      () => {
        setCopyState('copied')
        setTimeout(() => setCopyState('idle'), 2000)
      },
      () => setCopyState('failed'),
    )
  }

  const handleNativeShare = () => {
    if (!library) return
    navigator
      .share({ title: library.name, text: `Add "${library.name}" to RepCard`, url: link })
      .catch(() => {
        // Dismissing the share sheet rejects with AbortError; nothing to report
      })
  }

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(next) => {
        if (!next) setCopyState('idle')
        onOpenChange(next)
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/60 backdrop-blur-xs z-60 modal-overlay" />
        <Dialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[calc(100%-2rem)] max-w-sm max-h-[calc(100dvh-2rem)] overflow-y-auto bg-[var(--bg-app)] text-[var(--fg-app)] z-60 rounded-3xl shadow-2xl p-6 space-y-5 focus:outline-hidden modal-content">
          {/* Header */}
          <div className="flex items-center justify-between pb-1">
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-8 h-8 shrink-0 rounded-xl bg-[var(--bg-card)] text-[var(--fg-card)] flex items-center justify-center shadow-xs">
                <QrCode className="w-4 h-4" />
              </div>
              <Dialog.Title className="text-base font-bold truncate">Share Library</Dialog.Title>
            </div>
            <Dialog.Close asChild>
              <button
                className="w-7 h-7 shrink-0 rounded-lg flex items-center justify-center opacity-70 hover:opacity-100 transition-opacity"
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </Dialog.Close>
          </div>

          {library && link && (
            <>
              <div className="text-center space-y-1">
                <p className="font-bold text-sm break-words">{library.name}</p>
                <p className="text-[11px] opacity-80">{library.cardCount} cards</p>
              </div>

              <div className="mx-auto w-full max-w-[260px] shadow-sm rounded-2xl">
                <QrCodeImage value={link} label={`QR code to add ${library.name} to RepCard`} />
              </div>

              <Dialog.Description className="text-xs opacity-85 leading-relaxed text-center">
                Scan with any phone camera to open the setup link, or in RepCard use{' '}
                <strong>Scan QR Code</strong> under Add Remote Library.
              </Dialog.Description>

              <div className={`grid gap-2.5 ${canNativeShare ? 'grid-cols-2' : 'grid-cols-1'}`}>
                <button
                  onClick={handleCopy}
                  className="flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl bg-[var(--bg-card)] text-[var(--fg-card)] text-xs font-bold shadow-xs hover:opacity-90 transition-opacity"
                >
                  {copyState === 'copied' ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  <span>{copyState === 'copied' ? 'Copied!' : 'Copy Link'}</span>
                </button>
                {canNativeShare && (
                  <button
                    onClick={handleNativeShare}
                    className="flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl bg-[var(--bg-card)] text-[var(--fg-card)] text-xs font-bold shadow-xs hover:opacity-90 transition-opacity"
                  >
                    <Share2 className="w-4 h-4" />
                    <span>Share…</span>
                  </button>
                )}
              </div>

              {copyState === 'failed' && (
                <p className="text-xs font-medium text-center" role="alert">
                  Couldn&apos;t copy here.{canNativeShare ? ' Use Share… instead.' : ''}
                </p>
              )}

              <p className="flex items-start gap-1.5 text-[11px] opacity-75 leading-relaxed">
                <ShieldCheck className="w-3.5 h-3.5 shrink-0 mt-px" />
                <span>The code carries this library&apos;s endpoint URL. Share it only with people who should read these cards.</span>
              </p>
            </>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
