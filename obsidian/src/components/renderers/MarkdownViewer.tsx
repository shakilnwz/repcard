import {
  AlertTriangle,
  BookOpen,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  FileWarning,
  Flame,
  HelpCircle,
  Info,
  Lightbulb,
  Tag,
} from 'lucide-react';
import {
  Children,
  isValidElement,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { Fragment, jsx, jsxs } from 'react/jsx-runtime';
import { toJsxRuntime } from 'hast-util-to-jsx-runtime';
import { HighlightedCode } from '@/components/renderers/HighlightedCode';
import { MermaidViewport } from '@/components/renderers/MermaidViewport';
import { toArrayBuffer } from '@/lib/binaryStore';
import {
  parseMarkdownToHast,
  type HastComponents,
  type HeadingItem,
} from '@/lib/markdownPipeline';
import { scrollToHeadingSlug } from '@/lib/scroll';
import { readEntryBinary } from '@/lib/vaultService';
import { resolveWikilink, slugifyHeading } from '@/lib/wikilinks';
import { useAppStore } from '@/store/useAppStore';

interface MarkdownViewerProps {
  markdown: string;
  filePath: string;
  allPaths: readonly string[];
  compact?: boolean;
  onNavigate?: (targetPath: string, headingSlug?: string) => void;
  onHeadingsChange?: (headings: HeadingItem[]) => void;
  onToggleTask?: (taskIndex: number) => void;
}

function extractTextFromReactNode(node: ReactNode): string {
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(extractTextFromReactNode).join('');
  if (isValidElement<{ children?: ReactNode }>(node)) {
    return extractTextFromReactNode(node.props.children);
  }
  return '';
}

const CALLOUT_STYLES: Record<
  string,
  { border: string; bg: string; titleColor: string; Icon: typeof Info }
> = {
  warning: {
    border: 'border-amber-500/50',
    bg: 'bg-amber-500/10',
    titleColor: 'text-amber-400',
    Icon: AlertTriangle,
  },
  caution: {
    border: 'border-rose-500/50',
    bg: 'bg-rose-500/10',
    titleColor: 'text-rose-400',
    Icon: Flame,
  },
  danger: {
    border: 'border-rose-500/50',
    bg: 'bg-rose-500/10',
    titleColor: 'text-rose-400',
    Icon: Flame,
  },
  important: {
    border: 'border-[var(--accent-primary)]/50',
    bg: 'bg-[var(--bg-hover)]',
    titleColor: 'text-[var(--accent-primary)]',
    Icon: Info,
  },
  tip: {
    border: 'border-[var(--accent-primary)]/50',
    bg: 'bg-[var(--bg-hover)]',
    titleColor: 'text-[var(--accent-primary)]',
    Icon: Lightbulb,
  },
  success: {
    border: 'border-[var(--accent-primary)]/50',
    bg: 'bg-[var(--bg-hover)]',
    titleColor: 'text-[var(--accent-primary)]',
    Icon: Lightbulb,
  },
  question: {
    border: 'border-[var(--accent-primary)]/50',
    bg: 'bg-[var(--bg-hover)]',
    titleColor: 'text-[var(--accent-primary)]',
    Icon: HelpCircle,
  },
  note: {
    border: 'border-[var(--accent-primary)]/50',
    bg: 'bg-[var(--bg-hover)]',
    titleColor: 'text-[var(--accent-primary)]',
    Icon: BookOpen,
  },
};

function CalloutBlock({
  type,
  title,
  fold,
  children,
}: {
  type: string;
  title: string;
  fold: string;
  children: ReactNode;
}) {
  const [expanded, setExpanded] = useState(fold !== 'closed');
  const style = CALLOUT_STYLES[type] ?? CALLOUT_STYLES.note;
  const Icon = style.Icon;
  const collapsible = fold === 'open' || fold === 'closed';

  return (
    <blockquote
      data-callout={type}
      className={`my-4 rounded-lg border border-l-4 ${style.border} ${style.bg} p-3.5 text-sm not-italic`}
    >
      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          disabled={!collapsible}
          onClick={() => collapsible && setExpanded((prev) => !prev)}
          className={`flex items-center gap-2 font-semibold ${style.titleColor} ${
            collapsible ? 'cursor-pointer' : 'cursor-default'
          }`}
        >
          <Icon className="h-4 w-4 shrink-0" />
          <span>{title}</span>
          {collapsible &&
            (expanded ? (
              <ChevronDown className="h-3.5 w-3.5" />
            ) : (
              <ChevronRight className="h-3.5 w-3.5" />
            ))}
        </button>
      </div>
      {expanded && (
        <div className="mt-2 space-y-2 text-[var(--text-secondary)] [&>p]:m-0">
          {children}
        </div>
      )}
    </blockquote>
  );
}

function WikilinkEmbed({
  target,
  alias,
  sourcePath,
  allPaths,
  onNavigate,
}: {
  target: string;
  alias?: string;
  sourcePath: string;
  allPaths: readonly string[];
  onNavigate?: (path: string) => void;
}) {
  const resolved = resolveWikilink(target, sourcePath, allPaths);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);

  const isImage = Boolean(
    resolved && /\.(png|jpe?g|webp|gif|svg)$/i.test(resolved),
  );

  useEffect(() => {
    if (!resolved || !isImage) return;
    let cancelled = false;
    let createdUrl: string | null = null;

    void readEntryBinary(resolved)
      .then((res) => {
        if (cancelled) return;
        const blob = new Blob([toArrayBuffer(res.bytes)], { type: res.mimeType });
        createdUrl = URL.createObjectURL(blob);
        setImageUrl(createdUrl);
      })
      .catch(() => {
        if (!cancelled) setLoadFailed(true);
      });

    return () => {
      cancelled = true;
      if (createdUrl && typeof URL.revokeObjectURL === 'function') {
        URL.revokeObjectURL(createdUrl);
      }
    };
  }, [resolved, isImage]);

  if (!resolved) {
    return (
      <span
        title={`Unresolved embed: ${target}`}
        className="inline-flex items-center gap-1 rounded border border-dashed border-[var(--border-subtle)] px-2 py-0.5 text-xs italic text-[var(--text-muted)]"
      >
        Missing embed: {alias || target}
      </span>
    );
  }

  if (isImage) {
    if (loadFailed) {
      return (
        <button
          type="button"
          onClick={() => onNavigate?.(resolved)}
          className="my-2 inline-flex items-center gap-1.5 rounded-md border border-[var(--border-subtle)] bg-[var(--bg-canvas)] px-2.5 py-1 text-xs text-[var(--accent-primary)] hover:underline"
        >
          Open embedded image: {alias || resolved}
        </button>
      );
    }
    return imageUrl ? (
      <figure className="my-3 overflow-hidden rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-canvas)] p-2">
        <img
          src={imageUrl}
          alt={alias || resolved}
          className="mx-auto max-h-96 rounded object-contain"
        />
      </figure>
    ) : (
      <span className="inline-block rounded bg-[var(--bg-elevated)] px-2 py-1 text-xs text-[var(--text-muted)]">
        Loading embed {alias || target}...
      </span>
    );
  }

  return (
    <button
      type="button"
      onClick={() => onNavigate?.(resolved)}
      className="my-1 inline-flex items-center gap-1.5 rounded-md border border-[var(--border-subtle)] bg-[var(--bg-canvas)] px-2.5 py-1 text-xs font-medium text-[var(--accent-primary)] hover:border-[var(--accent-primary)]/50"
    >
      Embedded: {alias || resolved}
    </button>
  );
}

export function MarkdownViewer({
  markdown,
  filePath,
  allPaths,
  compact = false,
  onNavigate,
  onHeadingsChange,
  onToggleTask,
}: MarkdownViewerProps) {
  const onToggleTaskRef = useRef(onToggleTask);
  onToggleTaskRef.current = onToggleTask;
  const hasTaskToggle = Boolean(onToggleTask);
  const pendingHeadingSlug = useAppStore((s) => s.pendingHeadingSlug);
  const setPendingHeadingSlug = useAppStore((s) => s.setPendingHeadingSlug);
  const setTreeFilter = useAppStore((s) => s.setTreeFilter);
  const setSidebarOpen = useAppStore((s) => s.setSidebarOpen);
  const navigateToPath = useAppStore((s) => s.navigateToPath);

  const [propsOpen, setPropsOpen] = useState(true);
  const [excalidrawSourceOpen, setExcalidrawSourceOpen] = useState(false);

  const parsed = useMemo(
    () => parseMarkdownToHast(markdown, filePath),
    [markdown, filePath],
  );

  useEffect(() => {
    if (!compact) {
      onHeadingsChange?.(parsed.headings);
    }
  }, [parsed.headings, compact, onHeadingsChange]);

  useEffect(() => {
    if (compact || !pendingHeadingSlug) return;
    const timer = setTimeout(() => {
      scrollToHeadingSlug(pendingHeadingSlug);
      setPendingHeadingSlug(null);
    }, 60);
    return () => clearTimeout(timer);
  }, [compact, pendingHeadingSlug, parsed.hast, setPendingHeadingSlug]);

  const handleOpenLink = (targetPath: string, headingSlug?: string) => {
    if (onNavigate) {
      onNavigate(targetPath, headingSlug);
    } else {
      navigateToPath(targetPath, headingSlug);
    }
  };

  const components: HastComponents = {
    blockquote(props) {
      const recordProps = props as Record<string, unknown>;
      const calloutType =
        (recordProps['data-callout'] as string | undefined) ??
        (recordProps.dataCallout as string | undefined);
      if (calloutType) {
        const title =
          (recordProps['data-callout-title'] as string | undefined) ??
          (recordProps.dataCalloutTitle as string | undefined) ??
          calloutType;
        const fold =
          (recordProps['data-callout-fold'] as string | undefined) ??
          (recordProps.dataCalloutFold as string | undefined) ??
          'none';
        return (
          <CalloutBlock type={calloutType} title={title} fold={fold}>
            {props.children}
          </CalloutBlock>
        );
      }
      return (
        <blockquote className="my-4 border-l-4 border-[var(--border-subtle)] pl-4 italic text-[var(--text-secondary)]">
          {props.children}
        </blockquote>
      );
    },
    pre(props) {
      const firstChild = Children.toArray(props.children)[0];
      if (
        isValidElement<{ className?: string; children?: ReactNode }>(firstChild)
      ) {
        const className = firstChild.props.className ?? '';
        const langMatch = /language-([^\s]+)/i.exec(className);
        const lang = langMatch?.[1]?.toLowerCase() ?? 'text';
        const codeStr = extractTextFromReactNode(firstChild.props.children).replace(
          /\n$/,
          '',
        );

        if (lang === 'mermaid') {
          return <MermaidViewport code={codeStr} compact={compact} />;
        }

        return <HighlightedCode code={codeStr} language={lang} />;
      }
      return (
        <pre className="my-3 overflow-x-auto rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-canvas)] p-3 font-mono text-xs">
          {props.children}
        </pre>
      );
    },
    table(props) {
      return (
        <div className="my-4 overflow-x-auto rounded-lg border border-[var(--border-subtle)]">
          <table className="w-full border-collapse text-left text-xs sm:text-sm">
            {props.children}
          </table>
        </div>
      );
    },
    a(props) {
      const recordProps = props as Record<string, unknown>;
      const wikilinkTarget =
        (recordProps['data-wikilink'] as string | undefined) ??
        (recordProps.dataWikilink as string | undefined);

      if (typeof wikilinkTarget === 'string') {
        const headingRaw =
          (recordProps['data-heading'] as string | undefined) ??
          (recordProps.dataHeading as string | undefined);
        const resolved = resolveWikilink(wikilinkTarget, filePath, allPaths);
        const headingSlug = headingRaw ? slugifyHeading(headingRaw) : undefined;

        if (!resolved) {
          return (
            <span
              title={`Unresolved link: ${wikilinkTarget}`}
              className="cursor-not-allowed italic text-[var(--text-muted)] underline decoration-dotted"
            >
              {props.children}
            </span>
          );
        }

        return (
          <a
            href={`#${resolved}`}
            data-resolved-wikilink={resolved}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              if (resolved === filePath && headingSlug) {
                scrollToHeadingSlug(headingSlug);
              } else {
                handleOpenLink(resolved, headingSlug);
              }
            }}
            className="font-medium text-[var(--accent-primary)] underline decoration-[var(--accent-primary)]/40 underline-offset-2 hover:decoration-[var(--accent-primary)]"
          >
            {props.children}
          </a>
        );
      }

      const href = typeof props.href === 'string' ? props.href : '';
      if (href.startsWith('#')) {
        return (
          <a
            href={href}
            onClick={(e) => {
              e.preventDefault();
              scrollToHeadingSlug(href.slice(1));
            }}
            className="text-[var(--accent-primary)] underline underline-offset-2"
          >
            {props.children}
          </a>
        );
      }

      return (
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-0.5 text-[var(--accent-primary)] underline underline-offset-2 hover:opacity-80"
        >
          <span>{props.children}</span>
          <ExternalLink className="inline h-3 w-3 shrink-0" />
        </a>
      );
    },
    span(props) {
      const recordProps = props as Record<string, unknown>;
      const embedTarget =
        (recordProps['data-wikilink-embed'] as string | undefined) ??
        (recordProps.dataWikilinkEmbed as string | undefined);
      if (typeof embedTarget === 'string' && embedTarget.length > 0) {
        const alias =
          (recordProps['data-alias'] as string | undefined) ??
          (recordProps.dataAlias as string | undefined);
        return (
          <WikilinkEmbed
            target={embedTarget}
            alias={alias}
            sourcePath={filePath}
            allPaths={allPaths}
            onNavigate={(target) => handleOpenLink(target)}
          />
        );
      }
      return <span {...props} />;
    },
    input(props) {
      if (props.type === 'checkbox') {
        const recordProps = props as Record<string, unknown>;
        const rawIdx =
          (recordProps['data-task-index'] as string | undefined) ??
          (recordProps.dataTaskIndex as string | undefined);
        const taskIndex = rawIdx !== undefined ? Number.parseInt(rawIdx, 10) : -1;
        const interactive =
          hasTaskToggle && Number.isFinite(taskIndex) && taskIndex >= 0;

        return (
          <input
            type="checkbox"
            checked={Boolean(props.checked)}
            disabled={!interactive}
            readOnly={!interactive}
            data-task-index={rawIdx}
            onClick={(e) => {
              if (interactive) e.stopPropagation();
            }}
            onChange={() => {
              if (interactive) {
                onToggleTaskRef.current?.(taskIndex);
              }
            }}
            className={`mr-1.5 h-3.5 w-3.5 translate-y-0.5 accent-[var(--accent-primary)] ${
              interactive ? 'cursor-pointer' : ''
            }`}
          />
        );
      }
      return <input {...props} />;
    },
  };

  const renderedBody = useMemo(
    () =>
      toJsxRuntime(parsed.hast, {
        Fragment,
        jsx,
        jsxs,
        components,
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [parsed.hast, filePath, allPaths, hasTaskToggle],
  );

  const { frontmatter } = parsed;
  const hasProperties = Boolean(
    !compact &&
      (frontmatter.title ||
        frontmatter.topic ||
        frontmatter.date ||
        frontmatter.tags.length > 0),
  );

  return (
    <div className={compact ? 'text-xs' : 'space-y-4'}>
      {frontmatter.isExcalidraw && !compact && (
        <div className="rounded-lg border border-[var(--accent-primary)]/40 bg-[var(--bg-hover)] p-3 text-xs">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="inline-flex items-center gap-1.5 font-semibold text-[var(--accent-primary)]">
              <FileWarning className="h-4 w-4" />
              Excalidraw Drawing Note (.excalidraw.md)
            </span>
            <button
              type="button"
              onClick={() => setExcalidrawSourceOpen((o) => !o)}
              className="rounded border border-[var(--accent-primary)]/40 px-2 py-0.5 text-[11px] text-[var(--accent-primary)] hover:bg-[var(--accent-primary)]/20"
            >
              {excalidrawSourceOpen ? 'Hide Raw Scene' : 'Inspect Raw Source'}
            </button>
          </div>
          {excalidrawSourceOpen && (
            <pre className="mt-2 max-h-60 overflow-auto rounded bg-[var(--bg-canvas)] p-2 font-mono text-[11px] text-[var(--text-secondary)]">
              {markdown}
            </pre>
          )}
        </div>
      )}

      {hasProperties && (
        <section className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-canvas)] text-xs">
          <button
            type="button"
            onClick={() => setPropsOpen((o) => !o)}
            className="flex w-full items-center justify-between px-3 py-2 text-left font-semibold tracking-wide text-[var(--text-secondary)] uppercase hover:bg-[var(--bg-hover)]"
          >
            <span>Properties</span>
            {propsOpen ? (
              <ChevronDown className="h-3.5 w-3.5" />
            ) : (
              <ChevronRight className="h-3.5 w-3.5" />
            )}
          </button>

          {propsOpen && (
            <dl className="grid grid-cols-1 gap-2 border-t border-[var(--border-subtle)] px-3 py-2.5 sm:grid-cols-2">
              {frontmatter.title && (
                <div>
                  <dt className="text-[11px] text-[var(--text-muted)]">Title</dt>
                  <dd className="font-medium text-[var(--text-primary)]">
                    {frontmatter.title}
                  </dd>
                </div>
              )}
              {frontmatter.topic && (
                <div>
                  <dt className="text-[11px] text-[var(--text-muted)]">Topic</dt>
                  <dd className="font-medium text-[var(--accent-secondary)]">
                    {frontmatter.topic}
                  </dd>
                </div>
              )}
              {frontmatter.date && (
                <div>
                  <dt className="text-[11px] text-[var(--text-muted)]">Date</dt>
                  <dd className="font-mono text-[var(--text-primary)]">
                    {frontmatter.date}
                  </dd>
                </div>
              )}
              {frontmatter.tags.length > 0 && (
                <div className="sm:col-span-2">
                  <dt className="mb-1 text-[11px] text-[var(--text-muted)]">
                    Tags
                  </dt>
                  <dd className="flex flex-wrap gap-1.5">
                    {frontmatter.tags.map((tag) => (
                      <button
                        key={tag}
                        type="button"
                        onClick={() => {
                          setSidebarOpen(true);
                          setTreeFilter(tag);
                        }}
                        className="inline-flex items-center gap-1 rounded-full border border-[var(--accent-primary)]/30 bg-[var(--accent-primary)]/10 px-2 py-0.5 text-[11px] font-medium text-[var(--accent-primary)] hover:bg-[var(--accent-primary)]/20"
                      >
                        <Tag className="h-2.5 w-2.5" />
                        <span>{tag}</span>
                      </button>
                    ))}
                  </dd>
                </div>
              )}
            </dl>
          )}
        </section>
      )}

      <article className={`kb-prose ${compact ? 'kb-prose-compact' : ''}`}>
        {renderedBody}
      </article>
    </div>
  );
}
