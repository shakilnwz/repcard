import { parse as parseYaml } from 'yaml';

export interface NormalizedFrontmatter {
  raw: Record<string, unknown>;
  title?: string;
  topic?: string;
  date?: string;
  filename?: string;
  tags: string[];
  isExcalidraw: boolean;
}

const FRONTMATTER_REGEX = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/;
const EMPTY_FRONTMATTER_REGEX = /^---\r?\n---(?:\r?\n|$)/;

function asScalarString(value: unknown): string | undefined {
  if (typeof value === 'string') {
    const clean = value.replace(/\u00a0/g, ' ').trim();
    return clean || undefined;
  }
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString().slice(0, 10);
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  return undefined;
}

export function normalizeFrontmatterTags(
  ...sources: unknown[]
): string[] {
  const seen = new Set<string>();
  const result: string[] = [];

  const pushTag = (candidate: string) => {
    const clean = candidate
      .replace(/\u00a0/g, ' ')
      .trim()
      .replace(/^#+/, '')
      .trim();
    if (!clean) return;
    const key = clean.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    result.push(clean);
  };

  for (const source of sources) {
    if (source === null || source === undefined) continue;

    if (Array.isArray(source)) {
      for (const item of source) {
        if (typeof item === 'string' || typeof item === 'number') {
          pushTag(String(item));
        }
      }
      continue;
    }

    if (typeof source === 'string') {
      const cleaned = source.replace(/\u00a0/g, ' ').trim();
      if (!cleaned) continue;
      if (cleaned.includes(',')) {
        for (const part of cleaned.split(',')) {
          pushTag(part);
        }
      } else {
        pushTag(cleaned);
      }
    }
  }

  return result;
}

export function extractFrontmatter(
  markdown: string,
  filePath?: string,
): { frontmatter: NormalizedFrontmatter; body: string } {
  const isExcalidrawPath = Boolean(
    filePath?.toLowerCase().endsWith('.excalidraw.md'),
  );

  const emptyMatch = EMPTY_FRONTMATTER_REGEX.exec(markdown);
  if (emptyMatch) {
    return {
      frontmatter: {
        raw: {},
        tags: [],
        isExcalidraw: isExcalidrawPath,
      },
      body: markdown.slice(emptyMatch[0].length),
    };
  }

  const match = FRONTMATTER_REGEX.exec(markdown);
  if (!match) {
    return {
      frontmatter: {
        raw: {},
        tags: [],
        isExcalidraw: isExcalidrawPath,
      },
      body: markdown,
    };
  }

  let parsedRaw: Record<string, unknown> = {};
  try {
    const parsed = parseYaml(match[1]);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      parsedRaw = parsed as Record<string, unknown>;
    }
  } catch {
    parsedRaw = {};
  }

  const tags = normalizeFrontmatterTags(parsedRaw.tag, parsedRaw.tags);
  const isExcalidraw = Boolean(
    isExcalidrawPath || parsedRaw['excalidraw-plugin'],
  );

  return {
    frontmatter: {
      raw: parsedRaw,
      title: asScalarString(parsedRaw.title),
      topic: asScalarString(parsedRaw.topic),
      date: asScalarString(parsedRaw.date),
      filename: asScalarString(parsedRaw.filename),
      tags,
      isExcalidraw,
    },
    body: markdown.slice(match[0].length),
  };
}
