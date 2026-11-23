import { CheckCircle2, RefreshCw, X } from 'lucide-react';
import { usePwaUpdate } from '@/shared/hooks/usePwaUpdate';

export function SwUpdateToast() {
  const {
    needRefresh,
    offlineReady,
    updateServiceWorker,
    dismissNeedRefresh,
    dismissOfflineReady,
  } = usePwaUpdate();

  if (!needRefresh && !offlineReady) return null;

  return (
    <div className="fixed right-4 bottom-20 z-50 flex max-w-sm items-center gap-3 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-4 py-3 text-xs shadow-xl">
      {needRefresh ? (
        <>
          <RefreshCw className="h-4 w-4 shrink-0 text-[var(--accent-primary)]" />
          <span className="flex-1 text-[var(--text-primary)]">
            A new version of GenForge KB is available.
          </span>
          <button
            type="button"
            onClick={() => void updateServiceWorker()}
            className="rounded-md bg-[var(--accent-primary)] px-2.5 py-1 font-semibold text-[var(--accent-on-primary)]"
          >
            Reload
          </button>
          <button
            type="button"
            onClick={dismissNeedRefresh}
            aria-label="Dismiss update notification"
            className="text-[var(--text-muted)] hover:text-[var(--text-primary)]"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </>
      ) : (
        <>
          <CheckCircle2 className="h-4 w-4 shrink-0 text-[var(--accent-primary)]" />
          <span className="flex-1 text-[var(--text-primary)]">
            App cached for offline boot.
          </span>
          <button
            type="button"
            onClick={dismissOfflineReady}
            aria-label="Dismiss offline notification"
            className="text-[var(--text-muted)] hover:text-[var(--text-primary)]"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </>
      )}
    </div>
  );
}
