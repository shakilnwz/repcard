import { useEffect, useState } from 'react';
import { useAppStore } from '@/shared/store/useAppStore';
import type { ThemeMode } from '@/features/vault/types/vault';

export function resolveTheme(mode: ThemeMode): 'dark' | 'light' {
  if (mode === 'system') {
    if (
      typeof window !== 'undefined' &&
      typeof window.matchMedia === 'function'
    ) {
      return window.matchMedia('(prefers-color-scheme: light)').matches
        ? 'light'
        : 'dark';
    }
    return 'dark';
  }
  return mode;
}

export function useResolvedTheme(): 'dark' | 'light' {
  const mode = useAppStore((s) => s.theme);
  const [resolved, setResolved] = useState<'dark' | 'light'>(() =>
    resolveTheme(mode),
  );

  useEffect(() => {
    setResolved(resolveTheme(mode));
    if (
      mode === 'system' &&
      typeof window !== 'undefined' &&
      typeof window.matchMedia === 'function'
    ) {
      const mql = window.matchMedia('(prefers-color-scheme: light)');
      const onChange = () => setResolved(resolveTheme('system'));
      mql.addEventListener('change', onChange);
      return () => mql.removeEventListener('change', onChange);
    }
    return undefined;
  }, [mode]);

  return resolved;
}

export function applyTheme(mode: ThemeMode): () => void {
  if (typeof document === 'undefined') {
    return () => {};
  }

  const updateDom = () => {
    const resolved = resolveTheme(mode);
    const root = document.documentElement;
    root.dataset.theme = resolved;
    root.classList.toggle('dark', resolved === 'dark');

    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) {
      meta.setAttribute('content', resolved === 'dark' ? '#0B132B' : '#F3F6FC');
    }
  };

  updateDom();

  if (
    mode === 'system' &&
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function'
  ) {
    const mql = window.matchMedia('(prefers-color-scheme: light)');
    mql.addEventListener('change', updateDom);
    return () => mql.removeEventListener('change', updateDom);
  }

  return () => {};
}
