import {
  COLOR_MODES,
  type ColorPaletteMode,
} from '@/features/repcard/lib/colorModes';
import {
  getColorModePreference,
  saveColorModePreference,
} from '@/features/repcard/lib/storage';

export const COLOR_MODE_LABELS: Record<ColorPaletteMode, string> = {
  default: 'Lime Hero (Black)',
  'navy-canvas': 'Lime Hero (Navy)',
  'black-navy-card': 'Navy Hero (Black)',
};

export function readInitialColorMode(): ColorPaletteMode {
  const stored = getColorModePreference();
  return COLOR_MODES.find((mode) => mode === stored) ?? 'default';
}

export function applyColorMode(mode: ColorPaletteMode): void {
  if (typeof document === 'undefined') {
    return;
  }

  const root = document.documentElement;
  root.removeAttribute('data-theme');
  if (mode === 'default') {
    root.removeAttribute('data-color-mode');
  } else {
    root.setAttribute('data-color-mode', mode);
  }

  const canvas = getComputedStyle(root).getPropertyValue('--bg-app').trim();
  const fallback = mode === 'navy-canvas' ? '#071a52' : '#000000';
  document
    .querySelector('meta[name="theme-color"]')
    ?.setAttribute('content', canvas || fallback);

  saveColorModePreference(mode);
}

/** Knowledgebase views render exclusively on RepCard's dark palette modes. */
export function useResolvedTheme(): 'dark' {
  return 'dark';
}
