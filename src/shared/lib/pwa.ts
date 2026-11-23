export interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

export function isStandaloneMode(): boolean {
  if (typeof window === 'undefined') return false;
  const nav = window.navigator as Navigator & { standalone?: boolean };
  return (
    nav.standalone === true ||
    (typeof window.matchMedia === 'function' &&
      window.matchMedia('(display-mode: standalone)').matches)
  );
}

export function isIosSafariStandalonePromptEligible(
  userAgent = typeof navigator !== 'undefined' ? navigator.userAgent : '',
  standalone = isStandaloneMode(),
): boolean {
  if (standalone) return false;
  const isIos = /iPad|iPhone|iPod/i.test(userAgent);
  const isSafari =
    /Safari/i.test(userAgent) && !/CriOS|FxiOS|EdgiOS|OPiOS/i.test(userAgent);
  return isIos && isSafari;
}
