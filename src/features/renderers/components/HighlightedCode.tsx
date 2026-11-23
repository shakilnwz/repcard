import { Check, Copy } from 'lucide-react';
import { useEffect, useState } from 'react';
import { highlightCodeToHtml, normalizeCodeLanguage } from '@/features/editor/lib/shikiHighlighter';
import { useResolvedTheme } from '@/shared/lib/theme';

interface HighlightedCodeProps {
  code: string;
  language?: string;
  showLineNumbers?: boolean;
  maxHeightClass?: string;
}

export function HighlightedCode({
  code,
  language,
  showLineNumbers = false,
  maxHeightClass = 'max-h-[32rem]',
}: HighlightedCodeProps) {
  const theme = useResolvedTheme();
  const normalizedLang = normalizeCodeLanguage(language);
  const [highlightedHtml, setHighlightedHtml] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setHighlightedHtml(null);

    void Promise.all([
      highlightCodeToHtml(code, normalizedLang, theme),
      import('dompurify'),
    ])
      .then(([rawHtml, dpMod]) => {
        if (cancelled) return;
        const DOMPurify = dpMod.default;
        const cleanHtml = DOMPurify.sanitize(rawHtml, {
          ALLOWED_TAGS: ['pre', 'code', 'span'],
          ALLOWED_ATTR: ['class', 'style', 'tabindex'],
        });
        setHighlightedHtml(cleanHtml);
      })
      .catch(() => {
        // Fallback to plain code block on failure
      });

    return () => {
      cancelled = true;
    };
  }, [code, normalizedLang, theme]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard?.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      // Clipboard unavailable
    }
  };

  const lines = showLineNumbers ? code.split('\n') : [];

  return (
    <div className="my-3 overflow-hidden rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-canvas)] text-xs">
      <div className="flex items-center justify-between border-b border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3 py-1.5">
        <span className="font-mono text-[11px] font-medium uppercase text-[var(--accent-primary)]">
          {normalizedLang}
        </span>
        <button
          type="button"
          onClick={() => void handleCopy()}
          aria-label="Copy code"
          className="inline-flex items-center gap-1 rounded px-2 py-0.5 text-[11px] text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]"
        >
          {copied ? (
            <>
              <Check className="h-3 w-3 text-[var(--accent-primary)]" />
              <span className="text-[var(--accent-primary)]">Copied</span>
            </>
          ) : (
            <>
              <Copy className="h-3 w-3" />
              <span>Copy</span>
            </>
          )}
        </button>
      </div>

      <div className={`flex overflow-auto font-mono text-[12px] leading-relaxed ${maxHeightClass}`}>
        {showLineNumbers && (
          <div
            aria-hidden="true"
            className="select-none border-r border-[var(--border-subtle)] bg-[var(--bg-surface)]/40 px-2.5 py-3 text-right text-[11px] leading-relaxed tabular-nums text-[var(--text-muted)]"
          >
            {lines.map((_, idx) => (
              <div key={idx}>{idx + 1}</div>
            ))}
          </div>
        )}

        <div className="min-w-0 flex-1">
          {highlightedHtml ? (
            <div
              className="kb-shiki-wrapper [&>pre]:m-0 [&>pre]:!bg-transparent [&>pre]:p-3 [&>pre]:leading-relaxed"
              dangerouslySetInnerHTML={{ __html: highlightedHtml }}
            />
          ) : (
            <pre className="m-0 overflow-x-auto p-3 leading-relaxed text-[var(--text-primary)]">
              <code>{code}</code>
            </pre>
          )}
        </div>
      </div>
    </div>
  );
}
