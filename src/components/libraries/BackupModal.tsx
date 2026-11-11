import { useState, useRef } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import {
  X,
  Download,
  Upload,
  Database,
  CheckCircle2,
  AlertCircle,
  FileText,
} from 'lucide-react'
import { exportAppData, importAppData } from '@/lib/storage'

interface BackupModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  librariesCount: number;
  reviewedCardsCount: number;
  onRestoreComplete: () => void;
}

export function BackupModal({
  open,
  onOpenChange,
  librariesCount,
  reviewedCardsCount,
  onRestoreComplete,
}: BackupModalProps) {
  const [importStatus, setImportStatus] = useState<{
    success?: boolean;
    message?: string;
  } | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleExport = () => {
    const data = exportAppData()
    const jsonStr = JSON.stringify(data, null, 2)
    const blob = new Blob([jsonStr], { type: 'application/json' })
    const url = URL.createObjectURL(blob)

    const dateStr = new Date().toISOString().split('T')[0]
    const a = document.createElement('a')
    a.href = url
    a.download = `repcard-backup-${dateStr}.json`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (event) => {
      const content = event.target?.result as string
      if (!content) return

      const result = importAppData(content)
      if (result.success) {
        setImportStatus({
          success: true,
          message: 'Backup restored successfully! Updating data...',
        })
        setTimeout(() => {
          onRestoreComplete()
          onOpenChange(false)
          setImportStatus(null)
        }, 1200)
      } else {
        setImportStatus({
          success: false,
          message: result.error || 'Failed to restore backup file.',
        })
      }
    }
    reader.readAsText(file)
  }

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/60 backdrop-blur-xs z-60 animate-in fade-in duration-200" />
        <Dialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-sm bg-[var(--bg-app)] text-[var(--fg-app)] z-60 rounded-3xl shadow-2xl p-6 space-y-5 focus:outline-hidden animate-in zoom-in-95 duration-150">
          {/* Header */}
          <div className="flex items-center justify-between pb-1">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-[var(--fg-app)] text-[var(--bg-app)] flex items-center justify-center shadow-xs">
                <Database className="w-4 h-4" />
              </div>
              <Dialog.Title className="font-[family-name:var(--font-display)] text-base font-bold">
                Backup & Restore
              </Dialog.Title>
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

          {/* Current Local State Summary */}
          <div className="p-3.5 rounded-2xl bg-[var(--fg-app)] text-[var(--bg-app)] text-xs space-y-1 shadow-xs">
            <p className="opacity-80">Current Local Browser State:</p>
            <p className="font-bold">
              {librariesCount} libraries configured • {reviewedCardsCount} card records
            </p>
          </div>

          {/* Export Button */}
          <div className="space-y-2">
            <h4 className="font-[family-name:var(--font-display)] text-xs font-bold uppercase tracking-wider opacity-85">
              Export Backup
            </h4>
            <p className="text-xs opacity-80 leading-relaxed">
              Save your configured endpoints, review intervals, and cram counters into an offline JSON file.
            </p>
            <button
              onClick={handleExport}
              className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-[var(--fg-app)] text-[var(--bg-app)] text-xs font-[family-name:var(--font-display)] font-bold shadow-xs hover:opacity-90 transition-opacity"
            >
              <Download className="w-4 h-4" />
              <span>Download Backup (.json)</span>
            </button>
          </div>

          {/* Import Button */}
          <div className="space-y-2 pt-2">
            <h4 className="font-[family-name:var(--font-display)] text-xs font-bold uppercase tracking-wider opacity-85">
              Restore from Backup
            </h4>
            <p className="text-xs opacity-80 leading-relaxed">
              Restore previously exported flashcard endpoints and FSRS study progress.
            </p>

            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              accept=".json"
              className="hidden"
            />

            <button
              onClick={() => fileInputRef.current?.click()}
              className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-[var(--fg-app)] text-[var(--bg-app)] text-xs font-[family-name:var(--font-display)] font-bold shadow-xs hover:opacity-90 transition-opacity"
            >
              <Upload className="w-4 h-4" />
              <span>Select Backup File</span>
            </button>
          </div>

          {/* Status Alert */}
          {importStatus && (
            <div className="p-3 rounded-xl bg-[var(--fg-app)] text-[var(--bg-app)] text-xs flex items-start gap-2 shadow-xs font-medium">
              {importStatus.success ? (
                <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
              ) : (
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              )}
              <span>{importStatus.message}</span>
            </div>
          )}

          {/* Tip */}
          <div className="flex items-center gap-1.5 text-[11px] opacity-75 pt-1">
            <FileText className="w-3.5 h-3.5" />
            <span>Backups are plain JSON and 100% human-readable.</span>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
