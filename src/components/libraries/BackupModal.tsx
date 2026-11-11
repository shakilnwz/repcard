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
        <Dialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-sm bg-[var(--bg-canvas)] border border-[var(--border-subtle)] text-[var(--text-primary)] z-60 rounded-2xl shadow-2xl p-5 space-y-5 focus:outline-hidden animate-in zoom-in-95 duration-150">
          {/* Header */}
          <div className="flex items-center justify-between pb-3 border-b border-[var(--border-subtle)]">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)] flex items-center justify-center text-[var(--accent-mint)]">
                <Database className="w-3.5 h-3.5" />
              </div>
              <Dialog.Title className="font-[family-name:var(--font-display)] text-base font-bold text-[var(--text-primary)]">
                Backup & Restore
              </Dialog.Title>
            </div>
            <Dialog.Close asChild>
              <button
                className="w-7 h-7 rounded-lg flex items-center justify-center text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-elevated)] transition-colors"
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </Dialog.Close>
          </div>

          {/* Current Local State Summary */}
          <div className="p-3 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-xs space-y-1">
            <p className="text-[var(--text-secondary)]">Current Local Browser State:</p>
            <p className="font-semibold text-[var(--text-primary)]">
              {librariesCount} libraries configured • {reviewedCardsCount} card records
            </p>
          </div>

          {/* Export Button */}
          <div className="space-y-2">
            <h4 className="font-[family-name:var(--font-display)] text-xs font-semibold text-[var(--accent-mint)] uppercase tracking-wider">
              Export Backup
            </h4>
            <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
              Save your configured endpoints, review intervals, and cram counters into an offline JSON file.
            </p>
            <button
              onClick={handleExport}
              className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-xs font-[family-name:var(--font-display)] font-semibold text-[var(--text-primary)] hover:border-[var(--accent-mint)]/60 transition-colors"
            >
              <Download className="w-3.5 h-3.5 text-[var(--accent-mint)]" />
              <span>Download Backup (.json)</span>
            </button>
          </div>

          {/* Import Button */}
          <div className="space-y-2 pt-2 border-t border-[var(--border-subtle)]">
            <h4 className="font-[family-name:var(--font-display)] text-xs font-semibold text-[var(--accent-mint)] uppercase tracking-wider">
              Restore from Backup
            </h4>
            <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
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
              className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-xl bg-[var(--accent-mint)] text-[var(--accent-mint-fg)] text-xs font-[family-name:var(--font-display)] font-bold hover:opacity-90 transition-opacity"
            >
              <Upload className="w-3.5 h-3.5" />
              <span>Select Backup File</span>
            </button>
          </div>

          {/* Status Alert */}
          {importStatus && (
            <div
              className={`p-3 rounded-xl text-xs flex items-start gap-2 ${
                importStatus.success
                  ? 'bg-emerald-950/40 border border-emerald-800 text-emerald-300'
                  : 'bg-red-950/40 border border-red-900/60 text-red-300'
              }`}
            >
              {importStatus.success ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              ) : (
                <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
              )}
              <span>{importStatus.message}</span>
            </div>
          )}

          {/* Tip */}
          <div className="flex items-center gap-1.5 text-[11px] text-[var(--text-secondary)] pt-1">
            <FileText className="w-3.5 h-3.5" />
            <span>Backups are plain JSON and 100% human-readable.</span>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
