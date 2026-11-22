import { Code2 } from 'lucide-react';
import { HighlightedCode } from '@/components/renderers/HighlightedCode';
import { formatBytes } from '@/lib/format';
import { languageFromPath } from '@/lib/shikiHighlighter';

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
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-canvas)] px-3 py-2 text-xs text-[var(--text-secondary)]">
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
