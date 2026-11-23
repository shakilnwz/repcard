import { extractFrontmatter } from '@/features/editor/lib/frontmatter';
import { extractRawOutgoingTargets } from '@/shared/lib/wikilinks';
import type { FileKind } from '@/features/vault/types/vault';

function countTaskLines(text: string): { total: number; done: number } {
  const regex = /^\s*(?:[-*+]|\d+\.)\s+\[([ xX])\]/gm;
  let total = 0;
  let done = 0;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(text)) !== null) {
    total += 1;
    if (match[1].toLowerCase() === 'x') {
      done += 1;
    }
  }
  return { total, done };
}

export function countTasksInContent(
  kind: FileKind,
  content: string,
): { taskTotal?: number; taskDone?: number } {
  if (kind === 'markdown') {
    const { total, done } = countTaskLines(content);
    return total > 0 ? { taskTotal: total, taskDone: done } : {};
  }

  if (kind === 'canvas') {
    try {
      const parsed = JSON.parse(content) as {
        nodes?: Array<{ text?: unknown }>;
      };
      if (!Array.isArray(parsed?.nodes)) return {};
      let total = 0;
      let done = 0;
      for (const node of parsed.nodes) {
        if (typeof node?.text === 'string') {
          const counts = countTaskLines(node.text);
          total += counts.total;
          done += counts.done;
        }
      }
      return total > 0 ? { taskTotal: total, taskDone: done } : {};
    } catch {
      return {};
    }
  }

  return {};
}

export interface DocumentMetadataFields {
  taskTotal?: number;
  taskDone?: number;
  tags?: string[];
  topic?: string;
  frontmatter?: Record<string, unknown>;
  outgoingLinks?: string[];
}

export function extractDocumentMetadata(
  kind: FileKind,
  filePath: string,
  content: string,
): DocumentMetadataFields {
  const taskCounts = countTasksInContent(kind, content);
  const outgoingLinks = extractRawOutgoingTargets(kind, content);

  if (kind === 'markdown') {
    const { frontmatter } = extractFrontmatter(content, filePath);
    return {
      ...taskCounts,
      tags: frontmatter.tags,
      topic: frontmatter.topic,
      frontmatter: frontmatter.raw,
      outgoingLinks,
    };
  }

  return {
    ...taskCounts,
    outgoingLinks: outgoingLinks.length > 0 ? outgoingLinks : undefined,
  };
}
