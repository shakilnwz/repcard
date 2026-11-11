import { useEffect, useEffectEvent, useRef, useState } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import {
  X,
  Plus,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  ImageIcon,
  NoPhotography,
  QrCodeScanner,
} from '@/components/ui/MaterialIcons'
import { parseScannedLibrary, type ImportableLibraryPayload } from '@/lib/hashImport'
import { decodeQrFromImageFile, describeCameraError, drawScaled, loadQrDecoder } from '@/lib/qrScan'

interface ScanLibraryModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAddLibrary: (url: string, name?: string) => Promise<{ success: boolean; error?: string }>;
}

export function ScanLibraryModal({ open, onOpenChange, onAddLibrary }: ScanLibraryModalProps) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/60 backdrop-blur-xs z-60 modal-overlay" />
        <Dialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[calc(100%-2rem)] max-w-sm max-h-[calc(100dvh-2rem)] overflow-y-auto bg-[var(--bg-app)] text-[var(--fg-app)] z-60 rounded-3xl shadow-2xl p-6 space-y-5 focus:outline-hidden modal-content">
          <div className="flex items-center justify-between pb-1">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-[var(--bg-card)] text-[var(--fg-card)] flex items-center justify-center shadow-xs">
                <QrCodeScanner className="w-4 h-4" />
              </div>
              <Dialog.Title className="text-base font-bold">Scan Library QR</Dialog.Title>
            </div>
            <Dialog.Close asChild>
              <button
                className="w-7 h-7 rounded-lg flex items-center justify-center opacity-70 hover:opacity-100 transition-opacity"
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </Dialog.Close>
          </div>

          <Dialog.Description className="text-xs opacity-85 leading-relaxed">
            Scan a library QR code shared from RepCard. You confirm before anything is added.
          </Dialog.Description>

          {/* Mounted only while open: the camera starts on mount and stops on unmount */}
          <ScannerBody onAddLibrary={onAddLibrary} onDone={() => onOpenChange(false)} />
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

type Step =
  | { kind: 'scanning' }
  | { kind: 'found'; library: ImportableLibraryPayload; adding: boolean; error: string | null }
  | { kind: 'added'; name: string }

const FRAME_INTERVAL_MS = 120
const FRAME_MAX_PX = 640
const NOT_A_LIBRARY = "That QR code isn't a RepCard library link."

function hostOf(url: string): string {
  try {
    return new URL(url).host
  } catch {
    return url
  }
}

function ScannerBody({
  onAddLibrary,
  onDone,
}: {
  onAddLibrary: ScanLibraryModalProps['onAddLibrary'];
  onDone: () => void;
}) {
  const [step, setStep] = useState<Step>({ kind: 'scanning' })
  const [cameraLive, setCameraLive] = useState(false)
  const [cameraError, setCameraError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [photoBusy, setPhotoBusy] = useState(false)
  const videoRef = useRef<HTMLVideoElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const cameraSupported = typeof navigator !== 'undefined' && Boolean(navigator.mediaDevices?.getUserMedia)
  const scanning = step.kind === 'scanning'

  /** Returns true when the text was a library (scanning should stop). */
  const acceptScan = (text: string): boolean => {
    const library = parseScannedLibrary(text)
    if (!library) {
      setNotice(NOT_A_LIBRARY)
      return false
    }
    setNotice(null)
    setStep({ kind: 'found', library, adding: false, error: null })
    return true
  }
  const onFrameDecoded = useEffectEvent(acceptScan)
  const finish = useEffectEvent(onDone)

  // Live camera scanning: runs while on the scanning step, and fully stops the camera otherwise
  useEffect(() => {
    const video = videoRef.current
    if (!scanning || !cameraSupported || !video) return

    let cancelled = false
    let stream: MediaStream | null = null
    let timer = 0
    const canvas = document.createElement('canvas')

    const run = async () => {
      const decoderPromise = loadQrDecoder()
      decoderPromise.catch(() => {}) // handled where it is awaited below
      try {
        const media = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: false,
        })
        if (cancelled) {
          media.getTracks().forEach((t) => t.stop())
          return
        }
        stream = media
        video.srcObject = media
        await video.play()
        const decoder = await decoderPromise
        if (cancelled) return
        setCameraLive(true)

        const tick = async () => {
          if (cancelled) return
          // Decode the centered square: exactly what the object-cover viewfinder shows
          const side = Math.min(video.videoWidth, video.videoHeight)
          if (side > 0) {
            const crop = {
              x: (video.videoWidth - side) / 2,
              y: (video.videoHeight - side) / 2,
              width: side,
              height: side,
            }
            let text: string | null = null
            try {
              if (drawScaled(canvas, video, crop, FRAME_MAX_PX)) text = await decoder.decode(canvas)
            } catch {
              // A frame that fails to decode is just skipped
            }
            if (cancelled) return
            if (text && onFrameDecoded(text)) return
          }
          timer = window.setTimeout(tick, FRAME_INTERVAL_MS)
        }
        void tick()
      } catch (err) {
        if (!cancelled) setCameraError(describeCameraError(err))
      }
    }
    void run()

    return () => {
      cancelled = true
      window.clearTimeout(timer)
      stream?.getTracks().forEach((t) => t.stop())
      video.srcObject = null
      setCameraLive(false)
    }
  }, [scanning, cameraSupported])

  // After a successful add, show the confirmation briefly, then close
  useEffect(() => {
    if (step.kind !== 'added') return
    const timer = window.setTimeout(finish, 1200)
    return () => window.clearTimeout(timer)
  }, [step.kind])

  const handlePhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = '' // allow picking the same file again
    if (!file) return
    setPhotoBusy(true)
    setNotice(null)
    try {
      const text = await decodeQrFromImageFile(file)
      if (text) acceptScan(text)
      else setNotice('No QR code was found in that image.')
    } catch {
      setNotice('That image could not be read.')
    } finally {
      setPhotoBusy(false)
    }
  }

  const scanAgain = () => {
    setNotice(null)
    setCameraError(null)
    setStep({ kind: 'scanning' })
  }

  const handleAdd = async () => {
    if (step.kind !== 'found' || step.adding) return
    const { library } = step
    setStep({ ...step, adding: true, error: null })
    const result = await onAddLibrary(library.url, library.name)
    if (result.success) {
      setStep({ kind: 'added', name: library.name || hostOf(library.url) })
    } else {
      setStep({ kind: 'found', library, adding: false, error: result.error || 'Failed to add library' })
    }
  }

  if (step.kind === 'added') {
    return (
      <div className="p-4 rounded-2xl bg-[var(--bg-card)] text-[var(--fg-card)] shadow-xs flex items-center gap-2.5" role="status">
        <CheckCircle2 className="w-5 h-5" />
        <p className="text-sm font-bold break-words min-w-0">Added {step.name}</p>
      </div>
    )
  }

  if (step.kind === 'found') {
    return (
      <div className="space-y-4">
        <div className="p-4 rounded-2xl bg-[var(--bg-card)] text-[var(--fg-card)] shadow-xs space-y-1">
          <p className="text-[11px] uppercase tracking-wider font-bold opacity-80">Library found</p>
          <p className="text-sm font-bold break-words">{step.library.name || 'Unnamed library'}</p>
          <p className="text-xs opacity-85 break-all">{hostOf(step.library.url)}</p>
        </div>

        {step.error && (
          <div className="p-2.5 rounded-xl bg-[var(--bg-card)] text-[var(--fg-card)] text-xs font-medium flex items-start gap-1.5 shadow-xs" role="alert">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span className="break-words min-w-0">{step.error}</span>
          </div>
        )}

        <div className="flex items-center gap-2">
          <button
            onClick={handleAdd}
            disabled={step.adding}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl bg-[var(--bg-card)] text-[var(--fg-card)] text-xs font-bold shadow-xs hover:opacity-90 transition-opacity disabled:opacity-60"
          >
            {step.adding ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            <span>{step.adding ? 'Adding…' : 'Add Library'}</span>
          </button>
          <button
            onClick={scanAgain}
            disabled={step.adding}
            className="flex items-center gap-1.5 py-2.5 px-3 rounded-xl text-xs font-bold opacity-85 hover:opacity-100 transition-opacity disabled:opacity-40"
          >
            <QrCodeScanner className="w-4 h-4" />
            <span>Scan Again</span>
          </button>
        </div>
      </div>
    )
  }

  const viewfinderMessage = !cameraSupported
    ? 'Camera scanning needs a secure (HTTPS) connection. Scan from a photo instead.'
    : cameraError

  return (
    <div className="space-y-4">
      {/* Viewfinder: square, so the decoded crop matches what's on screen */}
      <div className="relative aspect-square w-full overflow-hidden rounded-2xl bg-[var(--bg-card)] text-[var(--fg-card)] shadow-sm">
        <video
          ref={videoRef}
          playsInline
          muted
          className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-200 ${cameraLive ? 'opacity-100' : 'opacity-0'}`}
        />
        {viewfinderMessage ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-6 text-center">
            <NoPhotography className="w-8 h-8" />
            <p className="text-xs font-medium leading-relaxed">{viewfinderMessage}</p>
          </div>
        ) : !cameraLive ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2" role="status">
            <RefreshCw className="w-6 h-6 animate-spin" />
            <p className="text-xs font-medium">Starting camera…</p>
          </div>
        ) : (
          // Corner guides
          <div className="absolute inset-[14%] pointer-events-none" aria-hidden="true">
            <span className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-[var(--c-mint)] rounded-tl-xl" />
            <span className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-[var(--c-mint)] rounded-tr-xl" />
            <span className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-[var(--c-mint)] rounded-bl-xl" />
            <span className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-[var(--c-mint)] rounded-br-xl" />
          </div>
        )}
      </div>

      {notice && (
        <div className="p-2.5 rounded-xl bg-[var(--bg-card)] text-[var(--fg-card)] text-xs font-medium flex items-start gap-1.5 shadow-xs" role="alert">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{notice}</span>
        </div>
      )}

      <input type="file" accept="image/*" ref={fileInputRef} onChange={handlePhoto} className="hidden" />
      <button
        onClick={() => fileInputRef.current?.click()}
        disabled={photoBusy}
        className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-[var(--bg-card)] text-[var(--fg-card)] text-xs font-bold shadow-xs hover:opacity-90 transition-opacity disabled:opacity-60"
      >
        {photoBusy ? <RefreshCw className="w-4 h-4 animate-spin" /> : <ImageIcon className="w-4 h-4" />}
        <span>{photoBusy ? 'Reading image…' : 'Scan from a Photo'}</span>
      </button>
    </div>
  )
}
