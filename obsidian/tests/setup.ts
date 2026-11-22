import 'fake-indexeddb/auto';
import '@testing-library/jest-dom/vitest';
import { vi } from 'vitest';

vi.mock('virtual:pwa-register', () => ({
  registerSW: () => async () => {},
}));

if (!window.matchMedia) {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }),
  });
}
