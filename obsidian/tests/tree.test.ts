import { describe, expect, it } from 'vitest';
import { DEFAULT_IGNORE_PATTERNS } from '@/lib/ignore';
import { SAMPLE_VAULT_ENTRIES } from '@/lib/sampleVault';
import { buildVaultTree, classifyFileKind } from '@/lib/tree';

describe('classifyFileKind', () => {
  it('maps vault file extensions accurately', () => {
    expect(classifyFileKind('roadmaps/python.md')).toBe('markdown');
    expect(classifyFileKind('ai_enginnering/AI Radar.canvas')).toBe('canvas');
    expect(classifyFileKind('laravel/clean-code-in-laravel.pdf')).toBe('pdf');
    expect(classifyFileKind('ai_enginnering/ai-eng.png')).toBe('image');
    expect(classifyFileKind('gen.py')).toBe('code');
    expect(classifyFileKind('LICENSE')).toBe('other');
  });
});

describe('buildVaultTree', () => {
  it('sorts folders before files and hides ignored paths by default', () => {
    const tree = buildVaultTree(SAMPLE_VAULT_ENTRIES, {
      ignorePatterns: DEFAULT_IGNORE_PATTERNS,
      showHidden: false,
    });

    const folderNames = tree
      .filter((n) => n.type === 'folder')
      .map((n) => n.name);
    const fileNames = tree
      .filter((n) => n.type === 'file')
      .map((n) => n.name);

    expect(folderNames).toEqual([
      'ai_enginnering',
      'cpp',
      'iot',
      'laravel',
      'roadmaps',
    ]);
    expect(fileNames).toEqual(['gen.py', 'README.md', 'Untitled.canvas']);
    expect(folderNames).not.toContain('.obsidian');
    expect(folderNames).not.toContain('.ai');
    expect(folderNames).not.toContain('app');
  });

  it('exposes ignored folders when showHidden is true', () => {
    const tree = buildVaultTree(SAMPLE_VAULT_ENTRIES, {
      ignorePatterns: DEFAULT_IGNORE_PATTERNS,
      showHidden: true,
    });

    const folderNames = tree
      .filter((n) => n.type === 'folder')
      .map((n) => n.name);

    expect(folderNames).toContain('.obsidian');
    expect(folderNames).toContain('.ai');
    expect(folderNames).toContain('app');
  });

  it('filters entries and prunes empty folders', () => {
    const tree = buildVaultTree(SAMPLE_VAULT_ENTRIES, {
      ignorePatterns: DEFAULT_IGNORE_PATTERNS,
      showHidden: false,
      filterQuery: 'AI Radar',
    });

    expect(tree).toHaveLength(1);
    expect(tree[0].type).toBe('folder');
    if (tree[0].type === 'folder') {
      expect(tree[0].name).toBe('ai_enginnering');
      expect(tree[0].fileCount).toBe(1);
      expect(tree[0].children[0].path).toBe('ai_enginnering/AI Radar.canvas');
    }
  });
});
