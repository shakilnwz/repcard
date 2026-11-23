import { describe, expect, it } from 'vitest';
import {
  computeBacklinksForTarget,
  extractWikilinksFromCanvas,
  extractWikilinksFromMarkdown,
  parseWikilinkInner,
  resolveWikilink,
  slugifyHeading,
} from '@/shared/lib/wikilinks';

const VAULT_PATHS = [
  'README.md',
  'roadmaps/ai-engineer.md',
  'roadmaps/ai-engineer.canvas',
  'roadmaps/cpp.md',
  'roadmaps/cpp.canvas',
  'ai_enginnering/ai-engineer.md',
  'ai_enginnering/ai-engineer.canvas',
  'ai_enginnering/AI Radar.canvas',
  'ai_enginnering/ai-eng.png',
  'cpp/cpp.md',
  'cpp/cpp.canvas',
];

describe('wikilinks disambiguation and backlinks engine', () => {
  it('parses target, heading, alias, and embed syntax', () => {
    expect(parseWikilinkInner('roadmaps/ai-engineer|AI Engineer')).toEqual({
      raw: 'roadmaps/ai-engineer|AI Engineer',
      target: 'roadmaps/ai-engineer',
      heading: undefined,
      alias: 'AI Engineer',
      isEmbed: false,
    });
    expect(parseWikilinkInner('qwen#5. Turn thinking off|section 5')).toEqual({
      raw: 'qwen#5. Turn thinking off|section 5',
      target: 'qwen',
      heading: '5. Turn thinking off',
      alias: 'section 5',
      isEmbed: false,
    });
    expect(parseWikilinkInner('ai-eng.png', true)).toEqual({
      raw: 'ai-eng.png',
      target: 'ai-eng.png',
      heading: undefined,
      alias: undefined,
      isEmbed: true,
    });
  });

  it('disambiguates sibling paths deterministically for duplicate filenames', () => {
    expect(
      resolveWikilink('cpp.canvas', 'cpp/cpp.md', VAULT_PATHS),
    ).toBe('cpp/cpp.canvas');

    expect(
      resolveWikilink('cpp.canvas', 'roadmaps/cpp.md', VAULT_PATHS),
    ).toBe('roadmaps/cpp.canvas');

    expect(
      resolveWikilink(
        'ai-engineer.canvas',
        'roadmaps/ai-engineer.md',
        VAULT_PATHS,
      ),
    ).toBe('roadmaps/ai-engineer.canvas');

    expect(
      resolveWikilink(
        'ai-engineer.canvas',
        'ai_enginnering/ai-engineer.md',
        VAULT_PATHS,
      ),
    ).toBe('ai_enginnering/ai-engineer.canvas');

    expect(
      resolveWikilink(
        'roadmaps/ai-engineer',
        'ai_enginnering/AI Radar.canvas',
        VAULT_PATHS,
      ),
    ).toBe('roadmaps/ai-engineer.md');

    expect(
      resolveWikilink('does-not-exist', 'README.md', VAULT_PATHS),
    ).toBeNull();
  });

  it('extracts wikilinks outside code blocks and builds backlinks from MD and Canvas', () => {
    const md = [
      'See [[cpp.canvas|C++ Board]] and ![[ai-eng.png]].',
      '`[[ignored-inline-code]]`',
      '```md',
      '[[ignored-fenced-code]]',
      '```',
    ].join('\n');

    expect(extractWikilinksFromMarkdown(md).map((l) => l.target)).toEqual([
      'cpp.canvas',
      'ai-eng.png',
    ]);

    const canvasJson = JSON.stringify({
      nodes: [
        {
          id: 'legend',
          type: 'text',
          text: 'Related: [[roadmaps/ai-engineer|AI Engineer]]',
        },
        { id: 'f1', type: 'file', file: 'ai_enginnering/ai-eng.png' },
      ],
      edges: [],
    });
    expect(extractWikilinksFromCanvas(canvasJson).map((l) => l.target)).toEqual([
      'roadmaps/ai-engineer',
      'ai_enginnering/ai-eng.png',
    ]);

    const backlinks = computeBacklinksForTarget('roadmaps/ai-engineer.md', [
      {
        path: 'roadmaps/ai-engineer.md',
        name: 'ai-engineer.md',
        kind: 'markdown',
      },
      {
        path: 'ai_enginnering/AI Radar.canvas',
        name: 'AI Radar.canvas',
        kind: 'canvas',
        outgoingLinks: ['roadmaps/ai-engineer'],
      },
      {
        path: 'cpp/cpp.md',
        name: 'cpp.md',
        kind: 'markdown',
        outgoingLinks: ['cpp.canvas'],
      },
    ]);
    expect(backlinks).toEqual([
      {
        sourcePath: 'ai_enginnering/AI Radar.canvas',
        sourceName: 'AI Radar.canvas',
        sourceKind: 'canvas',
      },
    ]);

    expect(slugifyHeading('5. Turn thinking off')).toBe('5-turn-thinking-off');
  });
});
