import { Code2 } from '@/shared/ui/MaterialIcons';
import { HighlightedCode } from '@/features/renderers/components/HighlightedCode';
import { formatBytes } from '@/shared/lib/format';
import { languageFromPath } from '@/features/editor/lib/shikiHighlighter';

interface CodeViewerProps {
  code: string;
  filePath: string;
  size: number;
}

export function CodeViewer({ code, filePath, size }: CodeViewerProps) {
  const language = languageFromPath(filePath);
  const lineCount = code ? code.split('\n').length : 0;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-[var(--bg-surface)] px-3.5 py-2.5 text-xs text-[var(--text-secondary)] shadow-sm">
        <div className="flex items-center gap-2">
          <Code2 className="h-4 w-4 text-[var(--accent-secondary)]" />
          <span className="font-mono font-semibold text-[var(--text-primary)]">
            {filePath}
          </span>
        </div>
        <div className="flex items-center gap-3 text-[11px] text-[var(--text-muted)] tabular-nums">
          <span>{lineCount.toLocaleString()} lines</span>
          <span>{formatBytes(size)}</span>
        </div>
      </div>

      <HighlightedCode
        code={code}
        language={language}
        showLineNumbers
        maxHeightClass="max-h-[72vh]"
      />
    </div>
  );
}
