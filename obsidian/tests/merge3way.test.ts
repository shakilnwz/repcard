import { describe, expect, it } from 'vitest';
import { mergeThreeWay } from '@/lib/merge3way';

describe('mergeThreeWay', () => {
  it('handles identical and one-sided changes cleanly', () => {
    const base = 'line 1\nline 2\nline 3';
    expect(mergeThreeWay(base, base, 'line 1\nremote')).toEqual({
      merged: 'line 1\nremote',
      hasConflict: false,
    });
    expect(mergeThreeWay(base, 'line 1\nlocal', base)).toEqual({
      merged: 'line 1\nlocal',
      hasConflict: false,
    });
    expect(mergeThreeWay(base, 'same', 'same')).toEqual({
      merged: 'same',
      hasConflict: false,
    });
  });

  it('auto-merges non-overlapping edits cleanly', () => {
    const base = [
      '# Roadmap',
      '- [ ] Phase 1: Python',
      '- [ ] Phase 2: Stats',
      '- [ ] Phase 3: Linear Algebra',
      '- [ ] Phase 4: LLMs',
      '- [ ] Phase 5: RAG',
    ].join('\n');

    const local = base.replace('- [ ] Phase 1: Python', '- [x] Phase 1: Python');
    const remote = base.replace('- [ ] Phase 5: RAG', '- [x] Phase 5: RAG');

    const result = mergeThreeWay(base, local, remote);
    expect(result.hasConflict).toBe(false);
    expect(result.merged).toContain('- [x] Phase 1: Python');
    expect(result.merged).toContain('- [x] Phase 5: RAG');
  });

  it('flags overlapping conflicting edits with git-style markers', () => {
    const base = 'header\nstatus: draft\nfooter';
    const local = 'header\nstatus: completed locally\nfooter';
    const remote = 'header\nstatus: archived remotely\nfooter';

    const result = mergeThreeWay(base, local, remote);
    expect(result.hasConflict).toBe(true);
    expect(result.merged).toContain('<<<<<<< Local');
    expect(result.merged).toContain('status: completed locally');
    expect(result.merged).toContain('=======');
    expect(result.merged).toContain('status: archived remotely');
    expect(result.merged).toContain('>>>>>>> Remote');
  });
});
