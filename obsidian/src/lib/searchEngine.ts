import MiniSearch from 'minisearch';
import { vaultDb, type VaultFileRecord } from '@/db/vaultDb';
import type { FileKind } from '@/types/vault';

export interface VaultSearchHit {
  path: string;
  name: string;
  kind: FileKind;
  title: string;
  snippet: string;
  tags: string[];
  score: number;
  matchedCanvasNodeId?: string;
}

interface IndexedDoc {
  id: string;
  path: string;
  name: string;
  kind: FileKind;
  title: string;
  headings: string;
  tags: string;
  body: string;
  snippetSource: string;
}

const MINISEARCH_OPTIONS = {
  fields: ['title', 'name', 'headings', 'tags', 'path', 'body'],
  storeFields: ['path', 'name', 'kind', 'title', 'tags', 'snippetSource'],
  searchOptions: {
    boost: { title: 5, name: 4, headings: 3, tags: 3, path: 2, body: 1 },
    prefix: true,
    fuzzy: 0.2,
  },
};

let cachedMiniSearch: MiniSearch<IndexedDoc> | null = null;
let cachedDigest: string | null = null;

export function invalidateSearchIndexCache(): void {
  cachedMiniSearch = null;
  cachedDigest = null;
}

function extractHeadingsText(markdown: string): string {
  const headings: string[] = [];
  const regex = /^#{1,6}\s+(.+)$/gm;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(markdown)) !== null) {
    headings.push(match[1].trim());
  }
  return headings.join(' ');
}

function extractCanvasSearchableText(rawJson: string): string {
  try {
    const parsed = JSON.parse(rawJson) as {
      nodes?: Array<{ text?: unknown; label?: unknown; file?: unknown }>;
    };
    if (!Array.isArray(parsed?.nodes)) return '';
    const parts: string[] = [];
    for (const node of parsed.nodes) {
      if (typeof node?.label === 'string' && node.label.trim()) {
        parts.push(node.label.trim());
      }
      if (typeof node?.text === 'string' && node.text.trim()) {
        parts.push(node.text.trim());
      }
      if (typeof node?.file === 'string' && node.file.trim()) {
        parts.push(node.file.trim());
      }
    }
    return parts.join('\n');
  } catch {
    return rawJson;
  }
}

export function findMatchingCanvasNodeId(
  rawJson: string,
  query: string,
): string | undefined {
  const terms = query
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean);
  if (terms.length === 0) return undefined;

  try {
    const parsed = JSON.parse(rawJson) as {
      nodes?: Array<{
        id?: unknown;
        text?: unknown;
        label?: unknown;
        file?: unknown;
      }>;
    };
    if (!Array.isArray(parsed?.nodes)) return undefined;

    for (const node of parsed.nodes) {
      if (typeof node?.id !== 'string') continue;
      const hay = `${typeof node.label === 'string' ? node.label : ''} ${typeof node.text === 'string' ? node.text : ''} ${typeof node.file === 'string' ? node.file : ''}`.toLowerCase();
      if (terms.every((t) => hay.includes(t))) {
        return node.id;
      }
    }
    for (const node of parsed.nodes) {
      if (typeof node?.id !== 'string') continue;
      const hay = `${typeof node.label === 'string' ? node.label : ''} ${typeof node.text === 'string' ? node.text : ''} ${typeof node.file === 'string' ? node.file : ''}`.toLowerCase();
      if (terms.some((t) => hay.includes(t))) {
        return node.id;
      }
    }
  } catch {
    return undefined;
  }
  return undefined;
}

function buildDocForFile(file: VaultFileRecord): IndexedDoc {
  const fmTitle =
    typeof file.frontmatter?.title === 'string' && file.frontmatter.title.trim()
      ? file.frontmatter.title.trim()
      : file.name.replace(/\.(?:md|canvas)$/i, '');

  const rawContent = typeof file.content === 'string' ? file.content : '';
  const body =
    file.kind === 'canvas'
      ? extractCanvasSearchableText(rawContent)
      : rawContent.replace(/^---\r?\n[\s\S]*?\r?\n---(?:\r?\n|$)/, '');

  const headings =
    file.kind === 'markdown' ? extractHeadingsText(body) : '';
  const tags = (file.tags ?? []).join(' ');

  return {
    id: file.path,
    path: file.path,
    name: file.name,
    kind: file.kind,
    title: fmTitle,
    headings,
    tags,
    body,
    snippetSource: body.slice(0, 4000),
  };
}

function computeFilesDigest(files: readonly VaultFileRecord[]): string {
  let maxUpdated = 0;
  for (const f of files) {
    if (f.updatedAt > maxUpdated) maxUpdated = f.updatedAt;
  }
  return `${files.length}:${maxUpdated}`;
}

function makeSnippet(text: string, query: string): string {
  const compact = text.replace(/\s+/g, ' ').trim();
  if (!compact) return '';
  const firstTerm = query.trim().toLowerCase().split(/\s+/)[0];
  if (!firstTerm) return compact.slice(0, 140);

  const idx = compact.toLowerCase().indexOf(firstTerm);
  if (idx < 0) return compact.slice(0, 140);

  const start = Math.max(0, idx - 45);
  const end = Math.min(compact.length, idx + 95);
  return `${start > 0 ? '…' : ''}${compact.slice(start, end)}${end < compact.length ? '…' : ''}`;
}

export async function getOrBuildSearchIndex(
  filesOverride?: readonly VaultFileRecord[],
): Promise<MiniSearch<IndexedDoc>> {
  const files = (
    filesOverride ?? (await vaultDb.files.toArray())
  ).filter((f) => !f.isHidden);
  const digest = computeFilesDigest(files);

  if (cachedMiniSearch && cachedDigest === digest) {
    return cachedMiniSearch;
  }

  if (!filesOverride) {
    try {
      const saved = await vaultDb.searchIndex.get('minisearch');
      if (saved && saved.commitSha === digest && saved.serializedJson) {
        const loaded = MiniSearch.loadJSON<IndexedDoc>(
          saved.serializedJson,
          MINISEARCH_OPTIONS,
        );
        cachedMiniSearch = loaded;
        cachedDigest = digest;
        return loaded;
      }
    } catch {
      // Rebuild cleanly on corrupt cache
    }
  }

  const index = new MiniSearch<IndexedDoc>(MINISEARCH_OPTIONS);
  const docs = files.map(buildDocForFile);
  index.addAll(docs);

  cachedMiniSearch = index;
  cachedDigest = digest;

  if (!filesOverride) {
    try {
      await vaultDb.searchIndex.put({
        id: 'minisearch',
        serializedJson: JSON.stringify(index.toJSON()),
        commitSha: digest,
        updatedAt: Date.now(),
      });
    } catch {
      // Ignore IDB write error cleanly
    }
  }

  return index;
}

export async function searchVault(
  query: string,
  limit = 20,
  filesOverride?: readonly VaultFileRecord[],
): Promise<VaultSearchHit[]> {
  const trimmed = query.trim();
  if (!trimmed) return [];

  const index = await getOrBuildSearchIndex(filesOverride);
  const rawResults = index.search(trimmed, MINISEARCH_OPTIONS.searchOptions);
  const top = rawResults.slice(0, limit);

  const filesMap = filesOverride
    ? new Map(filesOverride.map((f) => [f.path, f]))
    : null;

  const hits: VaultSearchHit[] = [];
  for (const res of top) {
    const path = String(res.id);
    const kind = (res.kind as FileKind) ?? 'markdown';
    const rawTags = typeof res.tags === 'string' ? res.tags : '';
    const snippetSource =
      typeof res.snippetSource === 'string' ? res.snippetSource : '';

    let matchedCanvasNodeId: string | undefined;
    if (kind === 'canvas') {
      const canvasContent = filesMap
        ? filesMap.get(path)?.content
        : (await vaultDb.files.get(path))?.content;
      if (typeof canvasContent === 'string') {
        matchedCanvasNodeId = findMatchingCanvasNodeId(canvasContent, trimmed);
      }
    }

    hits.push({
      path,
      name: String(res.name ?? path.split('/').pop() ?? path),
      kind,
      title: String(res.title ?? res.name ?? path),
      snippet: makeSnippet(snippetSource, trimmed),
      tags: rawTags ? rawTags.split(/\s+/).filter(Boolean) : [],
      score: res.score,
      matchedCanvasNodeId,
    });
  }

  return hits;
}
