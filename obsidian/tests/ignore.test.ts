import { describe, expect, it } from 'vitest';
import { DEFAULT_IGNORE_PATTERNS, isPathIgnored } from '@/lib/ignore';

describe('isPathIgnored', () => {
  it('ignores system, app, and environment paths by default', () => {
    const ignored = [
      '.git/HEAD',
      '.obsidian/app.json',
      '.ai/plan.md',
      'app/package.json',
      'ai_enginnering/rag/.venv/pyvenv.cfg',
      'ai_enginnering/rag/stores/chroma/chroma.sqlite3',
      'ai_enginnering/rag/scripts/__pycache__/rag_common.cpython-312.pyc',
      'roadmaps/temp.pyc',
      'cpp/.DS_Store',
    ];

    for (const filePath of ignored) {
      expect(
        isPathIgnored(filePath, DEFAULT_IGNORE_PATTERNS),
        `Expected ${filePath} to be ignored`,
      ).toBe(true);
    }
  });

  it('keeps real vault content files visible', () => {
    const visible = [
      'README.md',
      'gen.py',
      'roadmaps/ai-engineer.md',
      'roadmaps/python.canvas',
      'ai_enginnering/AI Radar.canvas',
      'ai_enginnering/rag/qwen-3.5-4b-lmstudio-rag-setup.md',
      'cpp/cpp.md',
      'iot/iot_roadmap.canvas',
      'laravel/clean-code-in-laravel.pdf',
    ];

    for (const filePath of visible) {
      expect(
        isPathIgnored(filePath, DEFAULT_IGNORE_PATTERNS),
        `Expected ${filePath} to stay visible`,
      ).toBe(false);
    }
  });
});
