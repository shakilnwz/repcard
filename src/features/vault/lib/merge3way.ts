export interface MergeThreeWayResult {
  merged: string;
  hasConflict: boolean;
}

interface LineEditHunk {
  baseStart: number;
  baseEnd: number;
  replacement: string[];
}

function computeLineOps(
  baseLines: readonly string[],
  targetLines: readonly string[],
): LineEditHunk[] {
  const m = baseLines.length;
  const n = targetLines.length;

  // Guard huge inputs against O(m*n) memory blowup; fall back to whole-file replacement check
  if (m * n > 2_000_000) {
    if (baseLines.join('\n') === targetLines.join('\n')) return [];
    return [{ baseStart: 0, baseEnd: m, replacement: [...targetLines] }];
  }

  const dp = new Uint32Array((m + 1) * (n + 1));
  const stride = n + 1;

  for (let i = m - 1; i >= 0; i -= 1) {
    const rowOff = i * stride;
    const nextRowOff = (i + 1) * stride;
    for (let j = n - 1; j >= 0; j -= 1) {
      if (baseLines[i] === targetLines[j]) {
        dp[rowOff + j] = dp[nextRowOff + j + 1] + 1;
      } else {
        const down = dp[nextRowOff + j];
        const right = dp[rowOff + j + 1];
        dp[rowOff + j] = down >= right ? down : right;
      }
    }
  }

  const hunks: LineEditHunk[] = [];
  let i = 0;
  let j = 0;

  while (i < m || j < n) {
    if (i < m && j < n && baseLines[i] === targetLines[j]) {
      i += 1;
      j += 1;
      continue;
    }

    const baseStart = i;
    const replacement: string[] = [];

    while (i < m || j < n) {
      if (i < m && j < n && baseLines[i] === targetLines[j]) {
        break;
      }
      const down = i < m ? dp[(i + 1) * stride + j] : -1;
      const right = j < n ? dp[i * stride + (j + 1)] : -1;
      if (i < m && (j >= n || down >= right)) {
        i += 1;
      } else if (j < n) {
        replacement.push(targetLines[j]);
        j += 1;
      }
    }

    hunks.push({
      baseStart,
      baseEnd: i,
      replacement,
    });
  }

  return hunks;
}

function linesEqual(a: readonly string[], b: readonly string[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i += 1) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

function hunksOverlap(a: LineEditHunk, b: LineEditHunk): boolean {
  // Two zero-length insertions at the exact same base offset overlap
  if (a.baseStart === a.baseEnd && b.baseStart === b.baseEnd) {
    return a.baseStart === b.baseStart;
  }
  if (a.baseStart === a.baseEnd) {
    return a.baseStart >= b.baseStart && a.baseStart <= b.baseEnd;
  }
  if (b.baseStart === b.baseEnd) {
    return b.baseStart >= a.baseStart && b.baseStart <= a.baseEnd;
  }
  return a.baseStart < b.baseEnd && b.baseStart < a.baseEnd;
}

/**
 * Clean line-level 3-way merge preserving non-overlapping concurrent edits (Obsidian github-sync interop)
 * and emitting readable git conflict markers when both sides modified overlapping lines differently.
 */
export function mergeThreeWay(
  base: string,
  local: string,
  remote: string,
): MergeThreeWayResult {
  if (local === remote) return { merged: local, hasConflict: false };
  if (local === base) return { merged: remote, hasConflict: false };
  if (remote === base) return { merged: local, hasConflict: false };

  const eol = local.includes('\r\n') || remote.includes('\r\n') ? '\r\n' : '\n';
  const baseLines = base.split(/\r?\n/);
  const localHunks = computeLineOps(baseLines, local.split(/\r?\n/));
  const remoteHunks = computeLineOps(baseLines, remote.split(/\r?\n/));

  const out: string[] = [];
  let cursor = 0;
  let li = 0;
  let ri = 0;
  let hasConflict = false;

  const appendBaseUntil = (endIdx: number) => {
    while (cursor < endIdx) {
      out.push(baseLines[cursor]);
      cursor += 1;
    }
  };

  while (li < localHunks.length || ri < remoteHunks.length) {
    const lh = localHunks[li];
    const rh = remoteHunks[ri];

    if (lh && (!rh || (lh.baseEnd < rh.baseStart && !hunksOverlap(lh, rh)))) {
      appendBaseUntil(lh.baseStart);
      out.push(...lh.replacement);
      cursor = lh.baseEnd;
      li += 1;
      continue;
    }

    if (rh && (!lh || (rh.baseEnd < lh.baseStart && !hunksOverlap(lh, rh)))) {
      appendBaseUntil(rh.baseStart);
      out.push(...rh.replacement);
      cursor = rh.baseEnd;
      ri += 1;
      continue;
    }

    // Overlapping local + remote edits
    if (
      lh &&
      rh &&
      lh.baseStart === rh.baseStart &&
      lh.baseEnd === rh.baseEnd &&
      linesEqual(lh.replacement, rh.replacement)
    ) {
      appendBaseUntil(lh.baseStart);
      out.push(...lh.replacement);
      cursor = lh.baseEnd;
      li += 1;
      ri += 1;
      continue;
    }

    // Collect maximal overlapping conflict span across both hunk chains
    let spanStart = Math.min(lh!.baseStart, rh!.baseStart);
    let spanEnd = Math.max(lh!.baseEnd, rh!.baseEnd);
    const localSpanHunks: LineEditHunk[] = [lh!];
    const remoteSpanHunks: LineEditHunk[] = [rh!];
    li += 1;
    ri += 1;

    let extended = true;
    while (extended) {
      extended = false;
      while (li < localHunks.length && localHunks[li].baseStart <= spanEnd) {
        spanStart = Math.min(spanStart, localHunks[li].baseStart);
        spanEnd = Math.max(spanEnd, localHunks[li].baseEnd);
        localSpanHunks.push(localHunks[li]);
        li += 1;
        extended = true;
      }
      while (ri < remoteHunks.length && remoteHunks[ri].baseStart <= spanEnd) {
        spanStart = Math.min(spanStart, remoteHunks[ri].baseStart);
        spanEnd = Math.max(spanEnd, remoteHunks[ri].baseEnd);
        remoteSpanHunks.push(remoteHunks[ri]);
        ri += 1;
        extended = true;
      }
    }

    const applySpan = (hunks: LineEditHunk[]): string[] => {
      const slice: string[] = [];
      let p = spanStart;
      for (const h of hunks) {
        while (p < h.baseStart) {
          slice.push(baseLines[p]);
          p += 1;
        }
        slice.push(...h.replacement);
        p = h.baseEnd;
      }
      while (p < spanEnd) {
        slice.push(baseLines[p]);
        p += 1;
      }
      return slice;
    };

    const localBlock = applySpan(localSpanHunks);
    const remoteBlock = applySpan(remoteSpanHunks);

    appendBaseUntil(spanStart);
    if (linesEqual(localBlock, remoteBlock)) {
      out.push(...localBlock);
    } else {
      hasConflict = true;
      out.push('<<<<<<< Local');
      out.push(...localBlock);
      out.push('=======');
      out.push(...remoteBlock);
      out.push('>>>>>>> Remote');
    }
    cursor = spanEnd;
  }

  appendBaseUntil(baseLines.length);

  return {
    merged: out.join(eol),
    hasConflict,
  };
}
