const FENCE_OPEN_REGEX = /^\s*(```|~~~)/;
const TASK_LINE_REGEX = /^(\s*(?:[-*+]|\d+\.)\s+\[)([ xX])(\](?:\s|$).*)$/;

export interface CheckboxToggleResult {
  content: string;
  changed: boolean;
  checked: boolean;
}

/**
 * Toggles the Nth GFM task checkbox (`- [ ]` <-> `- [x]`) in Markdown while skipping
 * YAML frontmatter and fenced code blocks so indices match `remark-gfm` order 1:1.
 */
export function toggleMarkdownCheckboxAtIndex(
  markdown: string,
  taskIndex: number,
): CheckboxToggleResult {
  if (taskIndex < 0) {
    return { content: markdown, changed: false, checked: false };
  }

  const usesCrlf = markdown.includes('\r\n');
  const lines = markdown.split(/\r?\n/);

  let startLine = 0;
  // Skip leading YAML frontmatter if closed cleanly
  if (lines[0]?.trim() === '---') {
    for (let i = 1; i < lines.length; i += 1) {
      if (lines[i]?.trim() === '---') {
        startLine = i + 1;
        break;
      }
    }
  }

  let activeFence: '```' | '~~~' | null = null;
  let currentTaskIdx = 0;

  for (let i = startLine; i < lines.length; i += 1) {
    const line = lines[i];
    const fenceMatch = FENCE_OPEN_REGEX.exec(line);
    if (fenceMatch) {
      const marker = fenceMatch[1] as '```' | '~~~';
      if (!activeFence) {
        activeFence = marker;
      } else if (activeFence === marker && line.trim().startsWith(marker)) {
        activeFence = null;
      }
      continue;
    }

    if (activeFence) continue;

    const match = TASK_LINE_REGEX.exec(line);
    if (!match) continue;

    if (currentTaskIdx === taskIndex) {
      const nextChecked = match[2].toLowerCase() !== 'x';
      const nextMark = nextChecked ? 'x' : ' ';
      lines[i] = `${match[1]}${nextMark}${match[3]}`;
      return {
        content: lines.join(usesCrlf ? '\r\n' : '\n'),
        changed: true,
        checked: nextChecked,
      };
    }

    currentTaskIdx += 1;
  }

  return { content: markdown, changed: false, checked: false };
}

/**
 * Toggles the Nth checkbox inside a JSON Canvas text node, preserving canvas JSON formatting.
 */
export function toggleCanvasNodeCheckbox(
  rawJson: string,
  nodeId: string,
  taskIndex: number,
): CheckboxToggleResult {
  try {
    const parsed = JSON.parse(rawJson) as {
      nodes?: Array<Record<string, unknown>>;
      [key: string]: unknown;
    };
    if (!Array.isArray(parsed?.nodes)) {
      return { content: rawJson, changed: false, checked: false };
    }

    const targetNode = parsed.nodes.find((n) => n?.id === nodeId);
    if (!targetNode || typeof targetNode.text !== 'string') {
      return { content: rawJson, changed: false, checked: false };
    }

    const res = toggleMarkdownCheckboxAtIndex(targetNode.text, taskIndex);
    if (!res.changed) {
      return { content: rawJson, changed: false, checked: false };
    }

    targetNode.text = res.content;
    return {
      content: JSON.stringify(parsed, null, '\t'),
      changed: true,
      checked: res.checked,
    };
  } catch {
    return { content: rawJson, changed: false, checked: false };
  }
}

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

export function buildConflictCopyPath(
  originalPath: string,
  now: Date = new Date(),
): string {
  const stamp = [
    now.getFullYear(),
    pad2(now.getMonth() + 1),
    pad2(now.getDate()),
    '-',
    pad2(now.getHours()),
    pad2(now.getMinutes()),
    pad2(now.getSeconds()),
  ].join('');

  const slashIdx = originalPath.lastIndexOf('/');
  const dir = slashIdx >= 0 ? originalPath.slice(0, slashIdx + 1) : '';
  const base = slashIdx >= 0 ? originalPath.slice(slashIdx + 1) : originalPath;
  const dotIdx = base.lastIndexOf('.');

  if (dotIdx > 0) {
    const stem = base.slice(0, dotIdx);
    const ext = base.slice(dotIdx);
    return `${dir}${stem}.conflict-${stamp}${ext}`;
  }

  return `${dir}${base}.conflict-${stamp}.md`;
}
