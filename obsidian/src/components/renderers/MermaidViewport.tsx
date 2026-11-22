import {
  Check,
  Copy,
  Maximize2,
  Minimize2,
  RotateCcw,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import { useEffect, useId, useRef, useState } from 'react';
import { useResolvedTheme } from '@/lib/theme';

interface MermaidViewportProps {
  code: string;
  compact?: boolean;
}

const svgRenderCache = new Map<string, string>();
let mermaidRenderQueue: Promise<unknown> = Promise.resolve();

function hashCodeString(str: string): string {
  let h = 2166136261;
  for (let i = 0; i < str.length; i += 1) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(36);
}

function parseSvgDimensions(svgHtml: string): { w: number; h: number } | null {
  const vbMatch = /viewBox="[^"]*?\s([\d.]+)\s+([\d.]+)"/i.exec(svgHtml);
  if (vbMatch) {
    const w = Number(vbMatch[1]);
    const h = Number(vbMatch[2]);
    if (Number.isFinite(w) && Number.isFinite(h) && w > 0 && h > 0) {
      return { w, h };
    }
  }
  return null;
}

function renderMermaidQueued(
  renderId: string,
  code: string,
  theme: 'dark' | 'light',
): Promise<string> {
  const run = async (): Promise<string> => {
    const cacheKey = `${hashCodeString(code)}:${theme}`;
    const cached = svgRenderCache.get(cacheKey);
    if (cached) return cached;

    const [{ default: mermaid }, { default: DOMPurify }] = await Promise.all([
      import('mermaid'),
      import('dompurify'),
    ]);

    mermaid.initialize({
      startOnLoad: false,
      securityLevel: 'strict',
      theme: theme === 'dark' ? 'dark' : 'default',
      themeVariables:
        theme === 'dark'
          ? {
              darkMode: true,
              background: '#0B132B',
              primaryColor: '#121D3D',
              primaryTextColor: '#F2F6FF',
              primaryBorderColor: '#39FF88',
              lineColor: '#39FF88',
              secondaryColor: '#1A2852',
              tertiaryColor: '#0B132B',
            }
          : {
              background: '#FFFFFF',
              primaryColor: '#F3F6FC',
              primaryTextColor: '#0B132B',
              primaryBorderColor: '#007A3D',
              lineColor: '#0B132B',
            },
      flowchart: {
        htmlLabels: true,
        useMaxWidth: false,
      },
    });

    const result = await mermaid.render(renderId, code);
    const sanitized = DOMPurify.sanitize(result.svg, {
      USE_PROFILES: { svg: true, svgFilters: true, html: true },
      ADD_TAGS: ['foreignObject', 'style'],
      ADD_ATTR: ['dominant-baseline', 'text-anchor', 'marker-end', 'marker-start'],
      FORBID_TAGS: ['script', 'iframe', 'object', 'embed'],
      FORBID_ATTR: ['onerror', 'onload', 'onclick', 'onmouseover'],
    });

    svgRenderCache.set(cacheKey, sanitized);
    return sanitized;
  };

  const next = mermaidRenderQueue.then(run, run);
  mermaidRenderQueue = next.catch(() => {});
  return next;
}

export function MermaidViewport({ code, compact = false }: MermaidViewportProps) {
  const theme = useResolvedTheme();
  const rawReactId = useId().replace(/[^a-zA-Z0-9_-]/g, '');
  const containerRef = useRef<HTMLDivElement | null>(null);
  const stageRef = useRef<HTMLDivElement | null>(null);
  const dragRef = useRef<{
    startX: number;
    startY: number;
    origX: number;
    origY: number;
  } | null>(null);

  const [inViewport, setInViewport] = useState(
    () => typeof IntersectionObserver === 'undefined',
  );
  const [svgHtml, setSvgHtml] = useState<string | null>(() =>
    svgRenderCache.get(`${hashCodeString(code)}:${theme}`) ?? null,
  );
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [scale, setScale] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [fullscreen, setFullscreen] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (inViewport) return;
    const el = containerRef.current;
    if (!el || typeof IntersectionObserver === 'undefined') {
      setInViewport(true);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setInViewport(true);
          observer.disconnect();
        }
      },
      { rootMargin: '250px' },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [inViewport]);

  useEffect(() => {
    if (!inViewport) return;
    const cacheKey = `${hashCodeString(code)}:${theme}`;
    const hit = svgRenderCache.get(cacheKey);
    if (hit) {
      setSvgHtml(hit);
      setErrorMsg(null);
      return;
    }

    let cancelled = false;
    setErrorMsg(null);
    const uniqueId = `mmd-${rawReactId}-${Date.now().toString(36)}`;

    void renderMermaidQueued(uniqueId, code, theme)
      .then((cleanSvg) => {
        if (!cancelled) {
          setSvgHtml(cleanSvg);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setErrorMsg(
            err instanceof Error ? err.message : 'Failed to render Mermaid diagram.',
          );
        }
      });

    return () => {
      cancelled = true;
    };
  }, [code, theme, inViewport, rawReactId]);

  const handleReset = () => {
    setScale(1);
    setPan({ x: 0, y: 0 });
  };

  const handleFit = () => {
    const stageEl = stageRef.current;
    if (!stageEl || !svgHtml) {
      handleReset();
      return;
    }
    const dims = parseSvgDimensions(svgHtml);
    if (!dims) {
      handleReset();
      return;
    }
    const rect = stageEl.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;
    const fitScale = Math.min(
      (rect.width - 24) / dims.w,
      (rect.height - 24) / dims.h,
      1.5,
    );
    const clamped = Math.max(0.15, Number(fitScale.toFixed(2)));
    const centeredX = Math.max(0, (rect.width - dims.w * clamped) / 2);
    setScale(clamped);
    setPan({ x: centeredX, y: 12 });
  };

  const handleCopySource = async () => {
    try {
      await navigator.clipboard?.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Ignore clipboard failure
    }
  };

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    dragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      origX: pan.x,
      origY: pan.y,
    };
  };

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag) return;
    setPan({
      x: drag.origX + (e.clientX - drag.startX),
      y: drag.origY + (e.clientY - drag.startY),
    });
  };

  const onPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (dragRef.current) {
      dragRef.current = null;
      e.currentTarget.releasePointerCapture?.(e.pointerId);
    }
  };

  const card = (
    <div
      ref={containerRef}
      className={`my-3 flex flex-col overflow-hidden rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-canvas)] ${
        fullscreen ? 'h-full w-full' : ''
      }`}
    >
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3 py-1.5 text-xs">
        <span className="font-semibold text-[var(--accent-secondary)]">
          Mermaid Flowchart
        </span>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() =>
              setScale((s) => Math.max(0.2, Number((s - 0.15).toFixed(2))))
            }
            aria-label="Zoom out diagram"
            className="rounded p-1 text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]"
          >
            <ZoomOut className="h-3.5 w-3.5" />
          </button>
          <span className="min-w-10 text-center font-mono text-[11px] tabular-nums text-[var(--text-muted)]">
            {Math.round(scale * 100)}%
          </span>
          <button
            type="button"
            onClick={() =>
              setScale((s) => Math.min(3, Number((s + 0.15).toFixed(2))))
            }
            aria-label="Zoom in diagram"
            className="rounded p-1 text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]"
          >
            <ZoomIn className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={handleFit}
            className="rounded px-1.5 py-0.5 text-[11px] text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]"
          >
            Fit
          </button>
          <button
            type="button"
            onClick={handleReset}
            aria-label="Reset diagram view"
            className="rounded p-1 text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]"
          >
            <RotateCcw className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={() => void handleCopySource()}
            aria-label="Copy Mermaid source"
            className="rounded p-1 text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]"
          >
            {copied ? (
              <Check className="h-3.5 w-3.5 text-[var(--accent-primary)]" />
            ) : (
              <Copy className="h-3.5 w-3.5" />
            )}
          </button>
          <button
            type="button"
            onClick={() => setFullscreen((f) => !f)}
            aria-label={fullscreen ? 'Close fullscreen diagram' : 'Open diagram fullscreen'}
            className="rounded p-1 text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]"
          >
            {fullscreen ? (
              <Minimize2 className="h-3.5 w-3.5" />
            ) : (
              <Maximize2 className="h-3.5 w-3.5" />
            )}
          </button>
        </div>
      </div>

      {errorMsg ? (
        <div className="space-y-2 p-3 text-xs">
          <div className="rounded border border-rose-500/40 bg-rose-500/10 p-2 text-rose-300">
            Mermaid syntax error: {errorMsg}
          </div>
          <pre className="max-h-48 overflow-auto rounded bg-[var(--bg-surface)] p-2 font-mono text-[11px] text-[var(--text-secondary)]">
            {code}
          </pre>
        </div>
      ) : (
        <div
          ref={stageRef}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          onDoubleClick={handleReset}
          className={`relative touch-none select-none overflow-auto ${
            fullscreen
              ? 'min-h-0 flex-1'
              : compact
                ? 'h-56'
                : 'min-h-60 max-h-[36rem]'
          } cursor-grab p-3 active:cursor-grabbing`}
        >
          {svgHtml ? (
            <div
              className="origin-top-left transition-transform duration-75 [&>svg]:max-w-none"
              style={{
                transform: `translate3d(${pan.x}px, ${pan.y}px, 0) scale(${scale})`,
              }}
              dangerouslySetInnerHTML={{ __html: svgHtml }}
            />
          ) : (
            <div className="flex h-32 items-center justify-center text-xs text-[var(--text-muted)]">
              Rendering Mermaid diagram...
            </div>
          )}
        </div>
      )}
    </div>
  );

  if (fullscreen) {
    return (
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Fullscreen Mermaid Flowchart"
        className="fixed inset-0 z-50 flex flex-col bg-[#0B132B]/92 p-4 backdrop-blur-xs"
      >
        {card}
      </div>
    );
  }

  return card;
}
