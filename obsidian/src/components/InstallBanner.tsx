import { Download, Share, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import {
  isIosSafariStandalonePromptEligible,
  isStandaloneMode,
  type BeforeInstallPromptEvent,
} from '@/lib/pwa';
import { useAppStore } from '@/store/useAppStore';

export function InstallBanner() {
  const dismissedIos = useAppStore((s) => s.dismissedIosInstall);
  const dismissIosInstallPrompt = useAppStore((s) => s.dismissIosInstallPrompt);

  const [deferredPrompt, setDeferredPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [iosEligible, setIosEligible] = useState(false);

  useEffect(() => {
    if (isStandaloneMode()) return;

    setIosEligible(isIosSafariStandalonePromptEligible());

    const handleBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstall);
    return () =>
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
  }, []);

  if (deferredPrompt) {
    const triggerInstall = async () => {
      await deferredPrompt.prompt();
      await deferredPrompt.userChoice;
      setDeferredPrompt(null);
    };

    return (
      <div className="flex items-center justify-between gap-3 border-b border-[var(--accent-primary)]/30 bg-[var(--accent-primary)]/10 px-4 py-2 text-xs">
        <div className="flex items-center gap-2 text-[var(--text-primary)]">
          <Download className="h-4 w-4 shrink-0 text-[var(--accent-primary)]" />
          <span>Install GenForge KB as a standalone app for offline access.</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={triggerInstall}
            className="rounded-md bg-[var(--accent-primary)] px-2.5 py-1 font-semibold text-[var(--accent-on-primary)] hover:opacity-90"
          >
            Install App
          </button>
          <button
            type="button"
            onClick={() => setDeferredPrompt(null)}
            aria-label="Dismiss install prompt"
            className="text-[var(--text-muted)] hover:text-[var(--text-primary)]"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    );
  }

  if (iosEligible && !dismissedIos) {
    return (
      <div className="flex items-center justify-between gap-3 border-b border-[var(--accent-primary)]/30 bg-[var(--accent-primary)]/10 px-4 py-2 text-xs">
        <div className="flex items-center gap-2 text-[var(--text-primary)]">
          <Share className="h-4 w-4 shrink-0 text-[var(--accent-primary)]" />
          <span>
            Install on iOS: tap <strong>Share</strong> then{' '}
            <strong>Add to Home Screen</strong>.
          </span>
        </div>
        <button
          type="button"
          onClick={dismissIosInstallPrompt}
          aria-label="Dismiss iOS install tip"
          className="text-[var(--text-muted)] hover:text-[var(--text-primary)]"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    );
  }

  return null;
}
