import {
  ChevronLeft,
  ChevronRight,
  Download,
  ExternalLink,
  HardDrive,
  ListTree,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import type {
  PDFDocumentLoadingTask,
  PDFDocumentProxy,
  RenderTask,
} from 'pdfjs-dist';
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { useEffect, useRef, useState } from 'react';
import { formatBytes } from '@/shared/lib/format';
import { getUserStateValue, setUserStateValue } from '@/features/vault/lib/vaultService';

interface PdfViewerProps {
  filePath: string;
  fileName: string;
  bytes: Uint8Array;
  url: string;
  fromCache: boolean;
}

interface OutlineEntry {
  title: string;
  dest: unknown;
}

export function PdfViewer({
  filePath,
  fileName,
  bytes,
  url,
  fromCache,
}: PdfViewerProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const docRef = useRef<PDFDocumentProxy | null>(null);
  const loadingTaskRef = useRef<PDFDocumentLoadingTask | null>(null);
  const renderTaskRef = useRef<RenderTask | null>(null);

  const [numPages, setNumPages] = useState(0);
  const [pageNum, setPageNum] = useState(1);
  const [pageInput, setPageInput] = useState('1');
  const [scale, setScale] = useState(1.2);
  const [loadingDoc, setLoadingDoc] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [outline, setOutline] = useState<OutlineEntry[]>([]);
  const [outlineOpen, setOutlineOpen] = useState(false);

  // Load PDF document & restore remembered page
  useEffect(() => {
    let cancelled = false;
    setLoadingDoc(true);
    setErrorMsg(null);
    setOutline([]);

    void (async () => {
      try {
        const [pdfjs, pageMap] = await Promise.all([
          import('pdfjs-dist'),
          getUserStateValue<Record<string, number>>('pdfPageMap', {}),
        ]);
        if (cancelled) return;

        pdfjs.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;
        const loadingTask = pdfjs.getDocument({
          data: bytes.slice(),
          useWasm: false,
        });
        loadingTaskRef.current = loadingTask;
        const pdfDoc = await loadingTask.promise;
        if (cancelled) {
          void loadingTask.destroy();
          return;
        }

        docRef.current = pdfDoc;
        setNumPages(pdfDoc.numPages);

        const savedPage = pageMap[filePath];
        const initialPage =
          typeof savedPage === 'number' &&
          savedPage >= 1 &&
          savedPage <= pdfDoc.numPages
            ? savedPage
            : 1;
        setPageNum(initialPage);
        setPageInput(String(initialPage));

        const rawOutline = await pdfDoc.getOutline().catch(() => null);
        if (!cancelled && Array.isArray(rawOutline)) {
          setOutline(
            rawOutline.map((item) => ({
              title: item.title,
              dest: item.dest,
            })),
          );
        }
      } catch (err) {
        if (!cancelled) {
          setErrorMsg(
            err instanceof Error ? err.message : 'Failed to load PDF document.',
          );
        }
      } finally {
        if (!cancelled) setLoadingDoc(false);
      }
    })();

    return () => {
      cancelled = true;
      renderTaskRef.current?.cancel();
      docRef.current = null;
      const existingTask = loadingTaskRef.current;
      loadingTaskRef.current = null;
      if (existingTask) {
        void existingTask.destroy();
      }
    };
  }, [filePath, bytes]);

  // Persist remembered page per PDF path
  useEffect(() => {
    if (numPages <= 0) return;
    setPageInput(String(pageNum));
    void getUserStateValue<Record<string, number>>('pdfPageMap', {}).then(
      (current) =>
        setUserStateValue('pdfPageMap', {
          ...current,
          [filePath]: pageNum,
        }),
    );
  }, [filePath, pageNum, numPages]);

  // Render current page to HiDPI canvas
  useEffect(() => {
    const pdfDoc = docRef.current;
    const canvas = canvasRef.current;
    if (!pdfDoc || !canvas || loadingDoc || numPages <= 0) return;

    let cancelled = false;
    renderTaskRef.current?.cancel();

    void (async () => {
      try {
        const page = await pdfDoc.getPage(pageNum);
        if (cancelled) return;

        const dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;
        const viewport = page.getViewport({ scale });
        const context = canvas.getContext('2d');
        if (!context) return;

        canvas.width = Math.floor(viewport.width * dpr);
        canvas.height = Math.floor(viewport.height * dpr);
        canvas.style.width = `${Math.floor(viewport.width)}px`;
        canvas.style.height = `${Math.floor(viewport.height)}px`;

        const renderContext = {
          canvasContext: context,
          viewport,
          transform: dpr !== 1 ? [dpr, 0, 0, dpr, 0, 0] : undefined,
        };

        const task = page.render(
          renderContext as unknown as Parameters<typeof page.render>[0],
        );
        renderTaskRef.current = task;
        await task.promise;
      } catch (err) {
        if (
          !cancelled &&
          !(err instanceof Error && err.name === 'RenderingCancelledException')
        ) {
          setErrorMsg(
            err instanceof Error ? err.message : 'PDF page render failed.',
          );
        }
      }
    })();

    return () => {
      cancelled = true;
      renderTaskRef.current?.cancel();
    };
  }, [pageNum, scale, loadingDoc, numPages]);

  const handleFitWidth = async () => {
    const pdfDoc = docRef.current;
    const container = containerRef.current;
    if (!pdfDoc || !container) return;
    try {
      const page = await pdfDoc.getPage(pageNum);
      const baseVp = page.getViewport({ scale: 1 });
      const availableWidth = Math.max(240, container.clientWidth - 40);
      const nextScale = Number(
        Math.max(0.4, Math.min(3, availableWidth / baseVp.width)).toFixed(2),
      );
      setScale(nextScale);
    } catch {
      // Ignore fit failure
    }
  };

  const handleJumpOutline = async (dest: unknown) => {
    const pdfDoc = docRef.current;
    if (!pdfDoc || !dest) return;
    try {
      const resolved =
        typeof dest === 'string' ? await pdfDoc.getDestination(dest) : dest;
      if (Array.isArray(resolved) && resolved[0]) {
        const idx = await pdfDoc.getPageIndex(
          resolved[0] as Parameters<typeof pdfDoc.getPageIndex>[0],
        );
        setPageNum(idx + 1);
      }
    } catch {
      // Ignore unresolvable outline destination
    }
  };

  const submitPageInput = (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = Number.parseInt(pageInput, 10);
    if (Number.isFinite(parsed) && numPages > 0) {
      setPageNum(Math.max(1, Math.min(numPages, parsed)));
    } else {
      setPageInput(String(pageNum));
    }
  };

  return (
    <div className="flex flex-col overflow-hidden rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-canvas)]">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3 py-2 text-xs">
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1 rounded-full bg-[var(--bg-hover)] px-2 py-0.5 text-[11px] font-medium text-[var(--accent-primary)]">
            <HardDrive className="h-3 w-3" />
            <span>
              Saved Offline ({formatBytes(bytes.byteLength)} ·{' '}
              {fromCache ? 'Served from Local Cache' : 'Freshly Cached'})
            </span>
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          {outline.length > 0 && (
            <button
              type="button"
              onClick={() => setOutlineOpen((o) => !o)}
              aria-pressed={outlineOpen}
              className="inline-flex items-center gap-1 rounded border border-[var(--border-subtle)] px-2 py-1 text-[11px] text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
            >
              <ListTree className="h-3.5 w-3.5" />
              <span>TOC</span>
            </button>
          )}

          <div className="flex items-center gap-1 rounded border border-[var(--border-subtle)] bg-[var(--bg-canvas)] px-1 py-0.5">
            <button
              type="button"
              onClick={() => setPageNum((p) => Math.max(1, p - 1))}
              disabled={pageNum <= 1}
              aria-label="Previous PDF page"
              className="rounded p-1 text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] disabled:opacity-40"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
            </button>

            <form onSubmit={submitPageInput} className="flex items-center gap-1">
              <input
                type="text"
                inputMode="numeric"
                aria-label="PDF page number"
                value={pageInput}
                onChange={(e) => setPageInput(e.target.value)}
                onBlur={submitPageInput}
                className="w-10 rounded bg-[var(--bg-surface)] px-1 py-0.5 text-center font-mono text-[11px] text-[var(--text-primary)] focus:outline-none"
              />
              <span className="text-[11px] text-[var(--text-muted)] tabular-nums">
                / {numPages || '—'}
              </span>
            </form>

            <button
              type="button"
              onClick={() => setPageNum((p) => Math.min(numPages || p, p + 1))}
              disabled={numPages === 0 || pageNum >= numPages}
              aria-label="Next PDF page"
              className="rounded p-1 text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] disabled:opacity-40"
            >
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>

          <button
            type="button"
            onClick={() =>
              setScale((s) => Math.max(0.4, Number((s - 0.2).toFixed(2))))
            }
            aria-label="Zoom out PDF"
            className="rounded p-1 text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]"
          >
            <ZoomOut className="h-3.5 w-3.5" />
          </button>
          <span className="font-mono text-[11px] tabular-nums text-[var(--text-muted)]">
            {Math.round(scale * 100)}%
          </span>
          <button
            type="button"
            onClick={() =>
              setScale((s) => Math.min(3, Number((s + 0.2).toFixed(2))))
            }
            aria-label="Zoom in PDF"
            className="rounded p-1 text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]"
          >
            <ZoomIn className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={() => void handleFitWidth()}
            className="rounded border border-[var(--border-subtle)] px-2 py-0.5 text-[11px] text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
          >
            Fit Width
          </button>

          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Open PDF in tab"
            className="inline-flex items-center gap-1 rounded border border-[var(--border-subtle)] px-2 py-1 text-[11px] text-[var(--text-primary)] hover:border-[var(--accent-primary)]/50"
          >
            <ExternalLink className="h-3 w-3" />
            <span className="hidden sm:inline">Open</span>
          </a>
          <a
            href={url}
            download={fileName}
            aria-label="Download PDF"
            className="inline-flex items-center gap-1 rounded bg-[var(--accent-primary)] px-2 py-1 text-[11px] font-semibold text-[var(--accent-on-primary)] hover:opacity-90"
          >
            <Download className="h-3 w-3" />
            <span className="hidden sm:inline">Download</span>
          </a>
        </div>
      </div>

      <div className="flex min-h-[55vh] max-h-[75vh] overflow-hidden">
        {outlineOpen && outline.length > 0 && (
          <div className="w-56 shrink-0 overflow-y-auto border-r border-[var(--border-subtle)] bg-[var(--bg-surface)] p-2 text-xs">
            <div className="mb-1.5 px-2 text-[11px] font-semibold tracking-wide text-[var(--text-muted)] uppercase">
              Bookmarks
            </div>
            <ul className="space-y-0.5">
              {outline.map((entry, idx) => (
                <li key={`${entry.title}-${idx}`}>
                  <button
                    type="button"
                    onClick={() => void handleJumpOutline(entry.dest)}
                    className="w-full truncate rounded px-2 py-1 text-left text-[11px] text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]"
                  >
                    {entry.title}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div
          ref={containerRef}
          className="flex min-w-0 flex-1 items-start justify-center overflow-auto bg-[var(--bg-canvas)] p-4"
        >
          {loadingDoc ? (
            <div className="py-12 text-xs text-[var(--text-muted)]">
              Loading PDF via offline Worker...
            </div>
          ) : errorMsg ? (
            <div className="rounded-lg border border-rose-500/40 bg-rose-500/10 p-4 text-xs text-rose-300">
              {errorMsg}
            </div>
          ) : (
            <canvas
              ref={canvasRef}
              aria-label={`PDF canvas page ${pageNum}`}
              className="rounded border border-[var(--border-subtle)] bg-white shadow-md"
            />
          )}
        </div>
      </div>
    </div>
  );
}
