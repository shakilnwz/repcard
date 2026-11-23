import { ExternalLink, Download, Maximize2, Minimize2, RotateCcw, ZoomIn, ZoomOut } from 'lucide-react';
import { useRef, useState } from 'react';
import { formatBytes } from '@/shared/lib/format';

interface ImageViewerProps {
  url: string;
  fileName: string;
  byteLength: number;
  fromCache: boolean;
}

export function ImageViewer({
  url,
  fileName,
  byteLength,
  fromCache,
}: ImageViewerProps) {
  const [scale, setScale] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [dimensions, setDimensions] = useState<{ w: number; h: number } | null>(
    null,
  );
  const [fullscreen, setFullscreen] = useState(false);
  const draggingRef = useRef<{
    startX: number;
    startY: number;
    origX: number;
    origY: number;
  } | null>(null);

  const resetView = () => {
    setScale(1);
    setPan({ x: 0, y: 0 });
  };

  const adjustScale = (delta: number) => {
    setScale((prev) => Math.max(0.25, Math.min(5, Number((prev + delta).toFixed(2)))));
  };

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    draggingRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      origX: pan.x,
      origY: pan.y,
    };
  };

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const drag = draggingRef.current;
    if (!drag) return;
    setPan({
      x: drag.origX + (e.clientX - drag.startX),
      y: drag.origY + (e.clientY - drag.startY),
    });
  };

  const onPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (draggingRef.current) {
      draggingRef.current = null;
      e.currentTarget.releasePointerCapture?.(e.pointerId);
    }
  };

  const stage = (
    <div className="flex flex-col overflow-hidden rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-canvas)]">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3 py-2 text-xs">
        <div className="flex flex-wrap items-center gap-2 text-[var(--text-secondary)]">
          <span className="font-semibold text-[var(--text-primary)]">{fileName}</span>
          <span>{formatBytes(byteLength)}</span>
          {dimensions && (
            <span className="tabular-nums text-[var(--text-muted)]">
              {dimensions.w} × {dimensions.h} px
            </span>
          )}
          <span className="rounded-full bg-[var(--bg-hover)] px-2 py-0.5 text-[11px] font-medium text-[var(--accent-primary)]">
            {fromCache ? 'Served Offline' : 'Cached Offline'}
          </span>
        </div>

        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => adjustScale(-0.25)}
            aria-label="Zoom out image"
            className="rounded p-1.5 text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]"
          >
            <ZoomOut className="h-3.5 w-3.5" />
          </button>
          <span className="min-w-11 text-center font-mono text-[11px] tabular-nums text-[var(--text-muted)]">
            {Math.round(scale * 100)}%
          </span>
          <button
            type="button"
            onClick={() => adjustScale(0.25)}
            aria-label="Zoom in image"
            className="rounded p-1.5 text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]"
          >
            <ZoomIn className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={resetView}
            aria-label="Reset image zoom"
            className="rounded p-1.5 text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]"
          >
            <RotateCcw className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={() => setFullscreen((f) => !f)}
            aria-label={fullscreen ? 'Exit image fullscreen' : 'Open image fullscreen'}
            className="rounded p-1.5 text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]"
          >
            {fullscreen ? (
              <Minimize2 className="h-3.5 w-3.5" />
            ) : (
              <Maximize2 className="h-3.5 w-3.5" />
            )}
          </button>
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Open image in tab"
            className="rounded p-1.5 text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]"
          >
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
          <a
            href={url}
            download={fileName}
            aria-label="Download image"
            className="rounded p-1.5 text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]"
          >
            <Download className="h-3.5 w-3.5" />
          </a>
        </div>
      </div>

      <div
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onDoubleClick={resetView}
        className={`relative flex touch-none select-none items-center justify-center overflow-hidden bg-[var(--bg-canvas)] p-4 ${
          fullscreen ? 'min-h-0 flex-1' : 'min-h-[360px] max-h-[70vh]'
        } cursor-grab active:cursor-grabbing`}
      >
        <img
          src={url}
          alt={fileName}
          draggable={false}
          onLoad={(e) =>
            setDimensions({
              w: e.currentTarget.naturalWidth,
              h: e.currentTarget.naturalHeight,
            })
          }
          style={{
            transform: `translate3d(${pan.x}px, ${pan.y}px, 0) scale(${scale})`,
            transformOrigin: 'center center',
          }}
          className="max-h-full max-w-full rounded object-contain transition-transform duration-75"
        />
      </div>
    </div>
  );

  if (fullscreen) {
    return (
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`Image lightbox: ${fileName}`}
        className="fixed inset-0 z-50 flex flex-col bg-[#0B132B]/92 p-4 backdrop-blur-xs"
      >
        {stage}
      </div>
    );
  }

  return stage;
}
