import { describe, expect, it } from 'vitest';
import { extractFrontmatter, normalizeFrontmatterTags } from '@/features/editor/lib/frontmatter';

describe('frontmatter normalizer', () => {
  it('handles all five tag/tags variants including non-breaking spaces', () => {
    expect(normalizeFrontmatterTags('', undefined)).toEqual([]);
    expect(
      normalizeFrontmatterTags(
        'course-outline, iot, embedded-systems, firmware, hardware-manufacturing',
      ),
    ).toEqual([
      'course-outline',
      'iot',
      'embedded-systems',
      'firmware',
      'hardware-manufacturing',
    ]);
    expect(
      normalizeFrontmatterTags(['AI\u00a0', 'AGI', 'ANI', '#ai']),
    ).toEqual(['AI', 'AGI', 'ANI']);
    expect(
      normalizeFrontmatterTags(undefined, ['rag-test-corpus']),
    ).toEqual(['rag-test-corpus']);
  });

  it('extracts scalar metadata and strips YAML frontmatter body cleanly', () => {
    const md = `---
filename: qwen-3.5-4b-lmstudio-rag-setup.md
title: Setup RAG with Qwen 3.5 4B
date: 2026-11-19
topic: RAG
tag:
  - RAG
  - Qwen
  - rag
---

# Heading Here`;

    const { frontmatter, body } = extractFrontmatter(
      md,
      'ai_enginnering/rag/qwen-3.5-4b-lmstudio-rag-setup.md',
    );
    expect(frontmatter.title).toBe('Setup RAG with Qwen 3.5 4B');
    expect(frontmatter.topic).toBe('RAG');
    expect(frontmatter.date).toBe('2026-11-19');
    expect(frontmatter.tags).toEqual(['RAG', 'Qwen']);
    expect(frontmatter.isExcalidraw).toBe(false);
    expect(body.trim()).toBe('# Heading Here');
  });

  it('detects Excalidraw notes by extension or frontmatter flag', () => {
    const byPath = extractFrontmatter('# Drawing', 'diagrams/arch.excalidraw.md');
    expect(byPath.frontmatter.isExcalidraw).toBe(true);

    const byFm = extractFrontmatter(
      '---\nexcalidraw-plugin: parsed\n---\n# Sketch',
      'notes/sketch.md',
    );
    expect(byFm.frontmatter.isExcalidraw).toBe(true);
  });
});
