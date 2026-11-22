import type { HighlighterCore } from 'shiki/core';
import { createHighlighterCore } from 'shiki/core';
import { createJavaScriptRegexEngine } from 'shiki/engine/javascript';
import { getFileExtension } from '@/lib/tree';

const LANG_ALIASES: Record<string, string> = {
  py: 'python',
  python: 'python',
  sh: 'bash',
  shell: 'bash',
  zsh: 'bash',
  bash: 'bash',
  js: 'javascript',
  mjs: 'javascript',
  cjs: 'javascript',
  javascript: 'javascript',
  ts: 'typescript',
  mts: 'typescript',
  typescript: 'typescript',
  tsx: 'tsx',
  jsx: 'jsx',
  json: 'json',
  jsonc: 'json',
  canvas: 'json',
  md: 'markdown',
  markdown: 'markdown',
  yml: 'yaml',
  yaml: 'yaml',
  toml: 'toml',
  cpp: 'cpp',
  cc: 'cpp',
  cxx: 'cpp',
  hpp: 'cpp',
  'c++': 'cpp',
  c: 'c',
  h: 'c',
  html: 'html',
  htm: 'html',
  css: 'css',
  sql: 'sql',
  dockerfile: 'dockerfile',
  docker: 'dockerfile',
  php: 'php',
  diff: 'diff',
  ini: 'ini',
  cfg: 'ini',
  rust: 'rust',
  rs: 'rust',
  go: 'go',
  xml: 'xml',
};

type DynamicLangModule = () => Promise<{ default: never }>;

const LANG_LOADERS: Record<string, DynamicLangModule> = {
  python: () => import('shiki/langs/python.mjs') as Promise<{ default: never }>,
  bash: () => import('shiki/langs/bash.mjs') as Promise<{ default: never }>,
  javascript: () => import('shiki/langs/javascript.mjs') as Promise<{ default: never }>,
  typescript: () => import('shiki/langs/typescript.mjs') as Promise<{ default: never }>,
  tsx: () => import('shiki/langs/tsx.mjs') as Promise<{ default: never }>,
  jsx: () => import('shiki/langs/jsx.mjs') as Promise<{ default: never }>,
  json: () => import('shiki/langs/json.mjs') as Promise<{ default: never }>,
  markdown: () => import('shiki/langs/markdown.mjs') as Promise<{ default: never }>,
  yaml: () => import('shiki/langs/yaml.mjs') as Promise<{ default: never }>,
  toml: () => import('shiki/langs/toml.mjs') as Promise<{ default: never }>,
  cpp: () => import('shiki/langs/cpp.mjs') as Promise<{ default: never }>,
  c: () => import('shiki/langs/c.mjs') as Promise<{ default: never }>,
  html: () => import('shiki/langs/html.mjs') as Promise<{ default: never }>,
  css: () => import('shiki/langs/css.mjs') as Promise<{ default: never }>,
  sql: () => import('shiki/langs/sql.mjs') as Promise<{ default: never }>,
  dockerfile: () => import('shiki/langs/dockerfile.mjs') as Promise<{ default: never }>,
  php: () => import('shiki/langs/php.mjs') as Promise<{ default: never }>,
  diff: () => import('shiki/langs/diff.mjs') as Promise<{ default: never }>,
  ini: () => import('shiki/langs/ini.mjs') as Promise<{ default: never }>,
  rust: () => import('shiki/langs/rust.mjs') as Promise<{ default: never }>,
  go: () => import('shiki/langs/go.mjs') as Promise<{ default: never }>,
  xml: () => import('shiki/langs/xml.mjs') as Promise<{ default: never }>,
};

let highlighterPromise: Promise<HighlighterCore> | null = null;
const loadedLangs = new Set<string>();
const pendingLangLoads = new Map<string, Promise<void>>();

async function getHighlighter(): Promise<HighlighterCore> {
  if (!highlighterPromise) {
    highlighterPromise = Promise.all([
      import('shiki/themes/github-dark-default.mjs'),
      import('shiki/themes/github-light-default.mjs'),
    ]).then(([darkTheme, lightTheme]) =>
      createHighlighterCore({
        themes: [darkTheme.default, lightTheme.default],
        langs: [],
        // Pure JS regex engine obeys strict CSP script-src 'self' (zero WASM eval)
        engine: createJavaScriptRegexEngine(),
      }),
    );
  }
  return highlighterPromise;
}

export function normalizeCodeLanguage(rawLang: string | undefined): string {
  const clean = (rawLang ?? '').trim().toLowerCase();
  return LANG_ALIASES[clean] ?? 'text';
}

export function languageFromPath(filePath: string): string {
  const base = filePath.split('/').pop()?.toLowerCase() ?? '';
  if (base === 'dockerfile') return 'dockerfile';
  const ext = getFileExtension(filePath);
  return LANG_ALIASES[ext] ?? 'text';
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

export async function highlightCodeToHtml(
  code: string,
  rawLanguage: string | undefined,
  theme: 'dark' | 'light',
): Promise<string> {
  const lang = normalizeCodeLanguage(rawLanguage);
  const loader = LANG_LOADERS[lang];

  if (!loader) {
    return `<pre class="shiki"><code>${escapeHtml(code)}</code></pre>`;
  }

  try {
    const highlighter = await getHighlighter();
    if (!loadedLangs.has(lang)) {
      let inflight = pendingLangLoads.get(lang);
      if (!inflight) {
        inflight = loader()
          .then(async (mod) => {
            await highlighter.loadLanguage(mod.default);
            loadedLangs.add(lang);
          })
          .finally(() => {
            pendingLangLoads.delete(lang);
          });
        pendingLangLoads.set(lang, inflight);
      }
      await inflight;
    }

    return highlighter.codeToHtml(code, {
      lang,
      theme: theme === 'dark' ? 'github-dark-default' : 'github-light-default',
    });
  } catch {
    return `<pre class="shiki"><code>${escapeHtml(code)}</code></pre>`;
  }
}
