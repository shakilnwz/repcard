import { getFileExtension } from '@/features/vault/lib/tree';
import type { FileKind } from '@/features/vault/types/vault';

export interface ParsedWikilink {
  raw: string;
  target: string;
  heading?: string;
  alias?: string;
  isEmbed: boolean;
}

export interface BacklinkItem {
  sourcePath: string;
  sourceName: string;
  sourceKind: FileKind;
}

export function parseWikilinkInner(
  rawInner: string,
  isEmbed = false,
): ParsedWikilink {
  const cleanInner = rawInner.trim();
  const pipeIdx = cleanInner.indexOf('|');
  const linkPart =
    pipeIdx >= 0 ? cleanInner.slice(0, pipeIdx).trim() : cleanInner;
  const alias =
    pipeIdx >= 0 ? cleanInner.slice(pipeIdx + 1).trim() || undefined : undefined;

  const hashIdx = linkPart.indexOf('#');
  const target =
    hashIdx >= 0 ? linkPart.slice(0, hashIdx).trim() : linkPart.trim();
  const heading =
    hashIdx >= 0 ? linkPart.slice(hashIdx + 1).trim() || undefined : undefined;

  return {
    raw: cleanInner,
    target,
    heading,
    alias,
    isEmbed,
  };
}

function stripCodeForLinkExtraction(markdown: string): string {
  // Remove YAML frontmatter if present
  let text = markdown.replace(/^---\r?\n[\s\S]*?\r?\n---(?:\r?\n|$)/, '');
  // Remove fenced code blocks (``` or ~~~)
  text = text.replace(/^[ \t]*(?:```|~~~)[\s\S]*?^[ \t]*(?:```|~~~)[ \t]*$/gm, '');
  // Remove inline code spans
  text = text.replace(/`[^`\r\n]+`/g, '');
  return text;
}

export function extractWikilinksFromMarkdown(
  markdown: string,
): ParsedWikilink[] {
  const scrubbed = stripCodeForLinkExtraction(markdown);
  const regex = /(!?)\[\[([^[\]\r\n]+)\]\]/g;
  const results: ParsedWikilink[] = [];
  let match: RegExpExecArray | null;

  while ((match = regex.exec(scrubbed)) !== null) {
    results.push(parseWikilinkInner(match[2], match[1] === '!'));
  }

  return results;
}

export function extractWikilinksFromCanvas(
  canvasJson: string,
): ParsedWikilink[] {
  try {
    const parsed = JSON.parse(canvasJson) as {
      nodes?: Array<{ type?: unknown; text?: unknown; file?: unknown }>;
    };
    if (!Array.isArray(parsed?.nodes)) return [];
    const results: ParsedWikilink[] = [];

    for (const node of parsed.nodes) {
      if (typeof node?.text === 'string') {
        results.push(...extractWikilinksFromMarkdown(node.text));
      }
      if (node?.type === 'file' && typeof node?.file === 'string') {
        results.push({
          raw: node.file,
          target: node.file.trim(),
          isEmbed: true,
        });
      }
    }
    return results;
  } catch {
    return [];
  }
}

export function slugifyHeading(heading: string): string {
  return heading
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]/gu, '')
    .replace(/\s/g, '-');
}

export function extractRawOutgoingTargets(
  kind: FileKind,
  content: string,
): string[] {
  const links =
    kind === 'markdown'
      ? extractWikilinksFromMarkdown(content)
      : kind === 'canvas'
        ? extractWikilinksFromCanvas(content)
        : [];
  const seen = new Set<string>();
  const targets: string[] = [];

  for (const link of links) {
    if (!link.target) continue;
    const key = link.target.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    targets.push(link.target);
  }
  return targets;
}

function normalizeVaultRelPath(raw: string): string {
  return raw
    .replace(/\\/g, '/')
    .replace(/^\.\/+/, '')
    .replace(/^\/+/, '');
}

/**
 * Obsidian-compatible deterministic wikilink resolver:
 * 1) Exact vault-relative path (or exact + .md)
 * 2) Same-directory sibling match (crucial for cpp/cpp.md -> cpp.canvas vs roadmaps/cpp.canvas)
 * 3) Basename match across vault (preferring .md when omitted, shortest depth, alphabetical)
 */
export function resolveWikilink(
  target: string,
  sourcePath: string,
  allPaths: readonly string[],
): string | null {
  const normalized = normalizeVaultRelPath(target.trim());
  if (!normalized) {
    // Self-note heading link like [[#Section]]
    return allPaths.includes(sourcePath) ? sourcePath : null;
  }

  const lowerTarget = normalized.toLowerCase();
  const hasExt = getFileExtension(normalized).length > 0;
  const lowerMap = new Map<string, string>();
  for (const p of allPaths) {
    lowerMap.set(p.toLowerCase(), p);
  }

  // 1. Exact vault-relative path match
  const exactHit = lowerMap.get(lowerTarget);
  if (exactHit) return exactHit;
  if (!hasExt) {
    const exactMdHit = lowerMap.get(`${lowerTarget}.md`);
    if (exactMdHit) return exactMdHit;
  }

  // 2. Same-directory sibling match (when target has no slash or relative subpath inside sourceDir)
  const slashIdx = sourcePath.lastIndexOf('/');
  const sourceDir = slashIdx >= 0 ? sourcePath.slice(0, slashIdx) : '';
  if (sourceDir) {
    const siblingKey = `${sourceDir}/${normalized}`.toLowerCase();
    const siblingHit = lowerMap.get(siblingKey);
    if (siblingHit) return siblingHit;
    if (!hasExt) {
      const siblingMdHit = lowerMap.get(`${siblingKey}.md`);
      if (siblingMdHit) return siblingMdHit;
    }
  }

  // 3. Shortest-path basename match
  const targetBase = (normalized.split('/').pop() ?? normalized).toLowerCase();
  const candidates = allPaths.filter((p) => {
    const base = (p.split('/').pop() ?? p).toLowerCase();
    if (base === targetBase) return true;
    if (!hasExt && base === `${targetBase}.md`) return true;
    return false;
  });

  if (candidates.length === 0) return null;

  candidates.sort((a, b) => {
    const aBase = (a.split('/').pop() ?? a).toLowerCase();
    const bBase = (b.split('/').pop() ?? b).toLowerCase();
    // Exact extension match beats inferred .md
    const aExact = aBase === targetBase ? 0 : 1;
    const bExact = bBase === targetBase ? 0 : 1;
    if (aExact !== bExact) return aExact - bExact;

    const aDepth = a.split('/').length;
    const bDepth = b.split('/').length;
    if (aDepth !== bDepth) return aDepth - bDepth;

    return a.localeCompare(b);
  });

  return candidates[0];
}

export function computeBacklinksForTarget(
  targetPath: string,
  files: readonly {
    path: string;
    name: string;
    kind: FileKind;
    outgoingLinks?: string[];
  }[],
): BacklinkItem[] {
  const allPaths = files.map((f) => f.path);
  const backlinks: BacklinkItem[] = [];
  const seen = new Set<string>();

  for (const file of files) {
    if (file.path === targetPath || !file.outgoingLinks?.length) continue;

    const linksHere = file.outgoingLinks.some(
      (rawTarget) =>
        resolveWikilink(rawTarget, file.path, allPaths) === targetPath,
    );

    if (linksHere && !seen.has(file.path)) {
      seen.add(file.path);
      backlinks.push({
        sourcePath: file.path,
        sourceName: file.name,
        sourceKind: file.kind,
      });
    }
  }

  backlinks.sort((a, b) => a.sourcePath.localeCompare(b.sourcePath));
  return backlinks;
}
