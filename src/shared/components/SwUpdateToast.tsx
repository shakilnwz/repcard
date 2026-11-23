import { CheckCircle2, RefreshCw, X } from '@/shared/ui/MaterialIcons';
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
    <div className="fixed right-4 bottom-20 z-50 flex max-w-sm items-center gap-3 rounded-2xl bg-[var(--bg-surface)] px-4 py-3 text-xs shadow-2xl">
      {needRefresh ? (
        <>
          <RefreshCw className="h-4 w-4 shrink-0 text-[var(--accent-primary)]" />
          <span className="flex-1 text-[var(--text-primary)]">
            A new version of RepCard is available.
          </span>
          <button
            type="button"
            onClick={() => void updateServiceWorker()}
            className="rounded-xl bg-[var(--button-primary-bg)] px-3 py-1 font-bold text-[var(--button-primary-fg)] hover:opacity-90"
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
