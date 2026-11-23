import { describe, expect, it } from 'vitest';
import { parseMarkdownToHast } from '@/features/editor/lib/markdownPipeline';
const qwenSetupMd = `---
title: Setup RAG with Qwen 3.5 4B in LM Studio (llama.cpp)
tags:
  - RAG
  - Qwen
  - ChromaDB
  - Qdrant
---

# Setup RAG with Qwen 3.5 4B in LM Studio (llama.cpp)

> [!warning] Watch VRAM budget when enabling longer context windows.

> [!tip] Prefer Q4_K_M quantization for balanced latency and quality.

## 5. Turn Thinking Off

| Component | Stack |
| --- | --- |
| Inference | llama.cpp |
| Vector Store | ChromaDB / Qdrant |

\`\`\`mermaid
flowchart LR
  Docs --> Chunks --> Embeddings --> Retriever
\`\`\`
`;

function collectNodes(
  node: unknown,
  predicate: (el: Record<string, unknown>) => boolean,
  acc: Array<Record<string, unknown>> = [],
): Array<Record<string, unknown>> {
  if (!node || typeof node !== 'object') return acc;
  const record = node as Record<string, unknown>;
  if (predicate(record)) acc.push(record);
  if (Array.isArray(record.children)) {
    for (const child of record.children) {
      collectNodes(child, predicate, acc);
    }
  }
  return acc;
}

describe('markdownPipeline real-vault & security regression', () => {
  it('parses frontmatter, callouts, GFM tables, heading slugs, and Mermaid blocks in qwen setup guide', () => {
    const parsed = parseMarkdownToHast(
      qwenSetupMd,
      'ai_enginnering/rag/qwen-3.5-4b-lmstudio-rag-setup.md',
    );

    expect(parsed.frontmatter.title).toBe(
      'Setup RAG with Qwen 3.5 4B in LM Studio (llama.cpp)',
    );
    expect(parsed.frontmatter.tags).toEqual(
      expect.arrayContaining(['RAG', 'Qwen', 'ChromaDB', 'Qdrant']),
    );
    expect(parsed.headings.some((h) => h.slug === '5-turn-thinking-off')).toBe(
      true,
    );

    const callouts = collectNodes(
      parsed.hast,
      (el) =>
        el.tagName === 'blockquote' &&
        typeof (el.properties as Record<string, unknown> | undefined)?.[
          'data-callout'
        ] === 'string',
    );
    expect(
      callouts.map(
        (c) => (c.properties as Record<string, unknown>)['data-callout'],
      ),
    ).toEqual(expect.arrayContaining(['warning', 'tip']));

    const tables = collectNodes(parsed.hast, (el) => el.tagName === 'table');
    expect(tables.length).toBeGreaterThanOrEqual(1);

    const mermaidCode = collectNodes(parsed.hast, (el) => {
      if (el.tagName !== 'code') return false;
      const cls = (el.properties as Record<string, unknown> | undefined)?.className;
      return Array.isArray(cls) && cls.includes('language-mermaid');
    });
    expect(mermaidCode.length).toBe(1);
  });

  it('strips dangerous HTML/XSS vectors via rehype-sanitize', () => {
    const malicious = `# Test\n\n<script>alert('xss')</script>\n\n<img src="x" onerror="alert(1)" />\n\n[Click](javascript:alert(2))\n\n[[roadmaps/ai-engineer|Safe]]`;
    const parsed = parseMarkdownToHast(malicious, 'test.md');

    const scripts = collectNodes(parsed.hast, (el) => el.tagName === 'script');
    expect(scripts).toHaveLength(0);

    const imgs = collectNodes(parsed.hast, (el) => el.tagName === 'img');
    for (const img of imgs) {
      const props = (img.properties ?? {}) as Record<string, unknown>;
      expect(props.onerror).toBeUndefined();
      expect(props.onError).toBeUndefined();
    }

    const links = collectNodes(parsed.hast, (el) => el.tagName === 'a');
    for (const link of links) {
      const href = String(
        ((link.properties ?? {}) as Record<string, unknown>).href ?? '',
      );
      expect(href.toLowerCase()).not.toContain('javascript:');
    }
  });
});
