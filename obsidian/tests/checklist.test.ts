import { describe, expect, it } from 'vitest';
import {
  buildConflictCopyPath,
  toggleCanvasNodeCheckbox,
  toggleMarkdownCheckboxAtIndex,
} from '@/lib/checklist';

describe('checklist helpers', () => {
  it('toggles exact GFM checkbox indices while skipping YAML frontmatter and code fences', () => {
    const md = [
      '---',
      'title: Roadmap Check',
      'note: "- [ ] not a real checkbox inside frontmatter"',
      '---',
      '',
      '# Checklist',
      '- [ ] First task',
      '',
      '```markdown',
      '- [ ] Inside fenced block (must skip)',
      '```',
      '',
      '1. [x] Second real task',
      '  - [ ] Nested third task',
    ].join('\n');

    const firstToggle = toggleMarkdownCheckboxAtIndex(md, 0);
    expect(firstToggle.changed).toBe(true);
    expect(firstToggle.checked).toBe(true);
    expect(firstToggle.content).toContain('- [x] First task');
    expect(firstToggle.content).toContain('- [ ] Inside fenced block (must skip)');

    const secondToggle = toggleMarkdownCheckboxAtIndex(firstToggle.content, 1);
    expect(secondToggle.changed).toBe(true);
    expect(secondToggle.checked).toBe(false);
    expect(secondToggle.content).toContain('1. [ ] Second real task');

    const thirdToggle = toggleMarkdownCheckboxAtIndex(secondToggle.content, 2);
    expect(thirdToggle.changed).toBe(true);
    expect(thirdToggle.checked).toBe(true);
    expect(thirdToggle.content).toContain('  - [x] Nested third task');

    const outOfRange = toggleMarkdownCheckboxAtIndex(thirdToggle.content, 99);
    expect(outOfRange.changed).toBe(false);
    expect(outOfRange.content).toBe(thirdToggle.content);
  });

  it('toggles checkboxes inside JSON Canvas text cards while preserving layout properties', () => {
    const canvas = JSON.stringify(
      {
        nodes: [
          {
            id: 'node-1',
            type: 'text',
            x: 10,
            y: 20,
            width: 300,
            height: 200,
            text: '## Python Basics\n- [ ] Variables\n- [x] Loops',
          },
          {
            id: 'node-2',
            type: 'text',
            x: 400,
            y: 20,
            width: 300,
            height: 200,
            text: '- [ ] Other card task',
          },
        ],
        edges: [{ id: 'edge-1', fromNode: 'node-1', toNode: 'node-2' }],
      },
      null,
      '\t',
    );

    const toggled = toggleCanvasNodeCheckbox(canvas, 'node-1', 0);
    expect(toggled.changed).toBe(true);
    expect(toggled.checked).toBe(true);

    const parsed = JSON.parse(toggled.content) as {
      nodes: Array<{ id: string; text: string }>;
      edges: Array<{ id: string }>;
    };
    expect(parsed.nodes[0].text).toContain('- [x] Variables');
    expect(parsed.nodes[0].text).toContain('- [x] Loops');
    expect(parsed.nodes[1].text).toContain('- [ ] Other card task');
    expect(parsed.edges).toHaveLength(1);
  });

  it('builds deterministic conflict copy file paths', () => {
    const fixed = new Date(2026, 10, 21, 9, 5, 3);
    expect(buildConflictCopyPath('roadmaps/ai-engineer.md', fixed)).toBe(
      'roadmaps/ai-engineer.conflict-20261121-090503.md',
    );
    expect(buildConflictCopyPath('notes', fixed)).toBe(
      'notes.conflict-20261121-090503.md',
    );
  });
});
