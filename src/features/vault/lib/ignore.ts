export const DEFAULT_IGNORE_PATTERNS: string[] = [
  '.git/',
  '.obsidian/',
  '.ai/',
  'app/',
  '.venv/',
  'stores/',
  '__pycache__/',
  '*.pyc',
  '.DS_Store',
];

function normalizePath(rawPath: string): string {
  return rawPath.replace(/\\/g, '/').replace(/^\/+/, '').replace(/\/+$/, '');
}

export function isPathIgnored(rawPath: string, patterns: string[]): boolean {
  const normalized = normalizePath(rawPath);
  if (!normalized) return false;

  const segments = normalized.split('/');
  const basename = segments[segments.length - 1] ?? normalized;

  for (const rawPattern of patterns) {
    const pattern = rawPattern.trim();
    if (!pattern) continue;

    if (pattern.endsWith('/')) {
      const dir = normalizePath(pattern);
      if (!dir) continue;
      if (dir.includes('/')) {
        if (
          normalized === dir ||
          normalized.startsWith(`${dir}/`) ||
          normalized.includes(`/${dir}/`)
        ) {
          return true;
        }
      } else if (segments.includes(dir)) {
        return true;
      }
      continue;
    }

    if (pattern.startsWith('*.')) {
      const suffix = pattern.slice(1);
      if (basename.endsWith(suffix)) {
        return true;
      }
      continue;
    }

    const cleanPattern = normalizePath(pattern);
    if (normalized === cleanPattern || basename === cleanPattern) {
      return true;
    }
  }

  return false;
}
