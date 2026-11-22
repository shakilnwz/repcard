import { useEffect, useRef, useState } from 'react';
import { registerSW } from 'virtual:pwa-register';

export interface PwaUpdateState {
  needRefresh: boolean;
  offlineReady: boolean;
  updateServiceWorker: () => Promise<void>;
  dismissOfflineReady: () => void;
  dismissNeedRefresh: () => void;
}

export function usePwaUpdate(): PwaUpdateState {
  const [needRefresh, setNeedRefresh] = useState(false);
  const [offlineReady, setOfflineReady] = useState(false);
  const updateFnRef = useRef<((reloadPage?: boolean) => Promise<void>) | null>(
    null,
  );

  useEffect(() => {
    if (import.meta.env.MODE === 'test') return;
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
      return;
    }

    const updateSW = registerSW({
      immediate: true,
      onNeedRefresh() {
        setNeedRefresh(true);
      },
      onOfflineReady() {
        setOfflineReady(true);
      },
    });
    updateFnRef.current = updateSW;
  }, []);

  return {
    needRefresh,
    offlineReady,
    updateServiceWorker: async () => {
      if (updateFnRef.current) {
        await updateFnRef.current(true);
      }
      setNeedRefresh(false);
    },
    dismissOfflineReady: () => setOfflineReady(false),
    dismissNeedRefresh: () => setNeedRefresh(false),
  };
}
