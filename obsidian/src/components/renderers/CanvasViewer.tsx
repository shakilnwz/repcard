import {
  ChevronDown,
  ChevronUp,
  ExternalLink,
  FileText,
  LocateFixed,
  Map as MapIcon,
  Maximize2,
  Search,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { MarkdownViewer } from '@/components/renderers/MarkdownViewer';
import {
  computeCanvasBounds,
  computeEdgeGeometry,
  isDecorativeCircle,
  isDividerNode,
  isNodeInViewport,
  parseCanvasDocument,
  resolveCanvasColor,
  resolveEdgeStroke,
  type CanvasNode,
} from '@/lib/canvasLayout';
import { useResolvedTheme } from '@/lib/theme';
import { getUserStateValue, setUserStateValue } from '@/lib/vaultService';
import { resolveWikilink } from '@/lib/wikilinks';
import { useAppStore } from '@/store/useAppStore';

interface CanvasViewerProps {
  rawJson: string;
  filePath: string;
  allPaths: readonly string[];
  onNavigate?: (targetPath: string, headingSlug?: string) => void;
  onToggleCardTask?: (nodeId: string, taskIndex: number) => void;
}

interface CanvasViewportState {
  x: number;
  y: number;
  scale: number;
}

const MIN_SCALE = 0.08;
const MAX_SCALE = 3.0;
const LOD_SCALE_THRESHOLD = 0.32;

function clampScale(s: number): number {
  return Math.max(MIN_SCALE, Math.min(MAX_SCALE, s));
}

function summarizeNodeTitle(node: CanvasNode): string {
  if (node.label) return node.label;
  if (node.file) return node.file;
  if (node.url) return node.url;
  const firstLine = (node.text ?? '')
    .split('\n')
    .map((l) => l.replace(/^[-*#>\s\[\]xX]+/, '').trim())
    .find(Boolean);
  return firstLine ?? '';
}

export function CanvasViewer({
  rawJson,
  filePath,
  allPaths,
  onNavigate,
  onToggleCardTask,
}: CanvasViewerProps) {
  const pendingCanvasNodeId = useAppStore((s) => s.pendingCanvasNodeId);
  const setPendingCanvasNodeId = useAppStore((s) => s.setPendingCanvasNodeId);
  const theme = useResolvedTheme();
  const stageRef = useRef<HTMLDivElement | null>(null);
  const findInputRef = useRef<HTMLInputElement | null>(null);
  const pointersRef = useRef(new Map<number, { x: number; y: number }>());
  const dragOriginRef = useRef<{
    panX: number;
    panY: number;
    ptrX: number;
    ptrY: number;
  } | null>(null);
  const pinchOriginRef = useRef<{
    dist: number;
    midX: number;
    midY: number;
    scale: number;
    panX: number;
    panY: number;
  } | null>(null);

  const doc = useMemo(() => {
    try {
      return parseCanvasDocument(rawJson);
    } catch {
      return { nodes: [], edges: [] };
    }
  }, [rawJson]);

  const bounds = useMemo(() => computeCanvasBounds(doc.nodes), [doc.nodes]);
  const nodeMap = useMemo(
    () => new Map(doc.nodes.map((n) => [n.id, n])),
    [doc.nodes],
  );

  const [stageSize, setStageSize] = useState({ width: 960, height: 640 });
  const [viewport, setViewport] = useState<CanvasViewportState>({
    x: 40,
    y: 40,
    scale: 0.45,
  });
  const [viewportReady, setViewportReady] = useState(false);
  const [minimapOpen, setMinimapOpen] = useState(true);
  const [findOpen, setFindOpen] = useState(false);
  const [findQuery, setFindQuery] = useState('');
  const [matchIndex, setMatchIndex] = useState(0);

  const fitToBounds = (width: number, height: number): CanvasViewportState => {
    const pad = 48;
    const availW = Math.max(120, width - pad * 2);
    const availH = Math.max(120, height - pad * 2);
    const fitScale = clampScale(
      Math.min(availW / bounds.width, availH / bounds.height, 1.0),
    );
    const x = width / 2 - (bounds.minX + bounds.width / 2) * fitScale;
    const y = height / 2 - (bounds.minY + bounds.height / 2) * fitScale;
    return { x, y, scale: fitScale };
  };

  // Track container dimensions cleanly
  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;

    const measure = () => {
      if (el.clientWidth > 0 && el.clientHeight > 0) {
        setStageSize({ width: el.clientWidth, height: el.clientHeight });
      }
    };
    measure();

    if (typeof ResizeObserver !== 'undefined') {
      const ro = new ResizeObserver(measure);
      ro.observe(el);
      return () => ro.disconnect();
    }
    return undefined;
  }, []);

  // Initialize / restore per-canvas viewport memory
  useEffect(() => {
    let cancelled = false;
    setViewportReady(false);

    void getUserStateValue<Record<string, CanvasViewportState>>(
      'canvasViewportMap',
      {},
    ).then((savedMap) => {
      if (cancelled) return;
      const saved = savedMap[filePath];
      const el = stageRef.current;
      const w = el?.clientWidth || stageSize.width;
      const h = el?.clientHeight || stageSize.height;

      if (
        saved &&
        Number.isFinite(saved.x) &&
        Number.isFinite(saved.y) &&
        Number.isFinite(saved.scale)
      ) {
        setViewport(saved);
      } else {
        setViewport(fitToBounds(w, h));
      }
      setViewportReady(true);
    });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filePath, bounds.minX, bounds.minY, bounds.width, bounds.height]);

  // Center viewport on search-matched Canvas card when jumping from Global Search
  useEffect(() => {
    if (!viewportReady || !pendingCanvasNodeId) return;
    const match = doc.nodes.find((n) => n.id === pendingCanvasNodeId);
    if (match) {
      focusNode(match, 0.9);
    }
    setPendingCanvasNodeId(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewportReady, pendingCanvasNodeId, doc.nodes, setPendingCanvasNodeId]);

  // Debounce persist canvas viewport memory
  useEffect(() => {
    if (!viewportReady) return;
    const timer = setTimeout(() => {
      void getUserStateValue<Record<string, CanvasViewportState>>(
        'canvasViewportMap',
        {},
      ).then((curr) =>
        setUserStateValue('canvasViewportMap', {
          ...curr,
          [filePath]: viewport,
        }),
      );
    }, 250);
    return () => clearTimeout(timer);
  }, [filePath, viewport, viewportReady]);

  // Ctrl+F shortcut inside canvas opens node finder
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'f') {
        e.preventDefault();
        setFindOpen(true);
        setTimeout(() => findInputRef.current?.focus(), 0);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const focusNode = (node: CanvasNode, minScale = 0.85) => {
    setViewport((prev) => {
      const nextScale = clampScale(Math.max(prev.scale, minScale));
      return {
        scale: nextScale,
        x: stageSize.width / 2 - (node.x + node.width / 2) * nextScale,
        y: stageSize.height / 2 - (node.y + node.height / 2) * nextScale,
      };
    });
  };

  const searchMatches = useMemo(() => {
    const q = findQuery.trim().toLowerCase();
    if (!q) return [];
    return doc.nodes.filter((n) => {
      const text = `${n.text ?? ''} ${n.label ?? ''} ${n.file ?? ''} ${n.url ?? ''}`.toLowerCase();
      return text.includes(q);
    });
  }, [doc.nodes, findQuery]);

  const jumpToMatch = (nextIdx: number) => {
    if (searchMatches.length === 0) return;
    const wrapped =
      ((nextIdx % searchMatches.length) + searchMatches.length) %
      searchMatches.length;
    setMatchIndex(wrapped);
    focusNode(searchMatches[wrapped], 0.9);
  };

  const zoomAtPoint = (
    clientX: number,
    clientY: number,
    factor: number,
  ) => {
    const el = stageRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const px = clientX - rect.left;
    const py = clientY - rect.top;

    setViewport((prev) => {
      const nextScale = clampScale(prev.scale * factor);
      const ratio = nextScale / prev.scale;
      return {
        scale: nextScale,
        x: px - (px - prev.x) * ratio,
        y: py - (py - prev.y) * ratio,
      };
    });
  };

  const handleWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    e.preventDefault();
    const factor = e.deltaY < 0 ? 1.12 : 0.89;
    zoomAtPoint(e.clientX, e.clientY, factor);
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    // Allow interactive clicks on links/buttons/inputs inside cards
    const targetEl = e.target as HTMLElement | null;
    if (
      targetEl &&
      targetEl.closest('a, button, input, [data-canvas-interactive="true"]')
    ) {
      return;
    }

    e.currentTarget.setPointerCapture?.(e.pointerId);
    pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (pointersRef.current.size === 1) {
      dragOriginRef.current = {
        panX: viewport.x,
        panY: viewport.y,
        ptrX: e.clientX,
        ptrY: e.clientY,
      };
      pinchOriginRef.current = null;
    } else if (pointersRef.current.size === 2) {
      const [p1, p2] = Array.from(pointersRef.current.values());
      const el = stageRef.current;
      const rect = el?.getBoundingClientRect() ?? { left: 0, top: 0 };
      pinchOriginRef.current = {
        dist: Math.max(1, Math.hypot(p2.x - p1.x, p2.y - p1.y)),
        midX: (p1.x + p2.x) / 2 - rect.left,
        midY: (p1.y + p2.y) / 2 - rect.top,
        scale: viewport.scale,
        panX: viewport.x,
        panY: viewport.y,
      };
      dragOriginRef.current = null;
    }
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!pointersRef.current.has(e.pointerId)) return;
    pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (pointersRef.current.size === 2 && pinchOriginRef.current) {
      const [p1, p2] = Array.from(pointersRef.current.values());
      const dist = Math.max(1, Math.hypot(p2.x - p1.x, p2.y - p1.y));
      const pinch = pinchOriginRef.current;
      const nextScale = clampScale(pinch.scale * (dist / pinch.dist));
      const ratio = nextScale / pinch.scale;
      setViewport({
        scale: nextScale,
        x: pinch.midX - (pinch.midX - pinch.panX) * ratio,
        y: pinch.midY - (pinch.midY - pinch.panY) * ratio,
      });
      return;
    }

    if (pointersRef.current.size === 1 && dragOriginRef.current) {
      const d = dragOriginRef.current;
      setViewport((prev) => ({
        ...prev,
        x: d.panX + (e.clientX - d.ptrX),
        y: d.panY + (e.clientY - d.ptrY),
      }));
    }
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    pointersRef.current.delete(e.pointerId);
    if (pointersRef.current.size < 2) {
      pinchOriginRef.current = null;
    }
    if (pointersRef.current.size === 0) {
      dragOriginRef.current = null;
    }
    e.currentTarget.releasePointerCapture?.(e.pointerId);
  };

  // World viewport bounds with generous padding for smooth culling
  const padWorld = 320 / Math.max(0.1, viewport.scale);
  const viewRect = {
    minX: -viewport.x / viewport.scale - padWorld,
    minY: -viewport.y / viewport.scale - padWorld,
    maxX: (stageSize.width - viewport.x) / viewport.scale + padWorld,
    maxY: (stageSize.height - viewport.y) / viewport.scale + padWorld,
  };

  const isLowDetail = viewport.scale < LOD_SCALE_THRESHOLD;
  const activeMatchId = searchMatches[matchIndex]?.id;

  const visibleNodes = doc.nodes
    .map((node, index) => ({ node, index }))
    .filter(({ node }) => isNodeInViewport(node, viewRect));

  const edgeColors = Array.from(
    new Set(doc.edges.map((e) => resolveEdgeStroke(e.color, theme))),
  );

  // Minimap coordinate mapping
  const miniW = 160;
  const miniH = 110;
  const miniScale = Math.min(
    (miniW - 12) / bounds.width,
    (miniH - 12) / bounds.height,
  );
  const miniOffsetX = (miniW - bounds.width * miniScale) / 2 - bounds.minX * miniScale;
  const miniOffsetY = (miniH - bounds.height * miniScale) / 2 - bounds.minY * miniScale;

  const panFromMinimap = (e: React.MouseEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const worldX = (e.clientX - rect.left - miniOffsetX) / miniScale;
    const worldY = (e.clientY - rect.top - miniOffsetY) / miniScale;
    setViewport((prev) => ({
      ...prev,
      x: stageSize.width / 2 - worldX * prev.scale,
      y: stageSize.height / 2 - worldY * prev.scale,
    }));
  };

  return (
    <div
      ref={stageRef}
      onWheel={handleWheel}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      aria-label={`Canvas board ${filePath}`}
      className="relative h-full min-h-[520px] w-full touch-none select-none overflow-hidden rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-canvas)] cursor-grab active:cursor-grabbing"
      style={{
        backgroundImage:
          theme === 'dark'
            ? 'radial-gradient(rgba(148,163,184,0.16) 1px, transparent 1px)'
            : 'radial-gradient(rgba(71,85,105,0.16) 1px, transparent 1px)',
        backgroundSize: `${Math.max(14, 24 * viewport.scale)}px ${Math.max(14, 24 * viewport.scale)}px`,
        backgroundPosition: `${viewport.x}px ${viewport.y}px`,
      }}
    >
      {/* GPU-accelerated World Layer */}
      <div
        className="pointer-events-auto absolute top-0 left-0 will-change-transform"
        style={{
          transform: `translate3d(${viewport.x}px, ${viewport.y}px, 0) scale(${viewport.scale})`,
          transformOrigin: '0 0',
        }}
      >
        {/* SVG Edges Layer */}
        {doc.edges.length > 0 && (
          <svg
            aria-hidden="true"
            className="pointer-events-none absolute top-0 left-0 overflow-visible"
            width={1}
            height={1}
            style={{ zIndex: 1 }}
          >
            <defs>
              {edgeColors.map((stroke, idx) => (
                <marker
                  key={`arrow-${idx}`}
                  id={`canvas-arrow-${idx}`}
                  markerWidth="10"
                  markerHeight="10"
                  refX="8"
                  refY="5"
                  orient="auto"
                >
                  <path d="M 0 1 L 8 5 L 0 9 z" fill={stroke} />
                </marker>
              ))}
            </defs>

            {doc.edges.map((edge) => {
              const fromNode = nodeMap.get(edge.fromNode);
              const toNode = nodeMap.get(edge.toNode);
              if (!fromNode || !toNode) return null;

              const geom = computeEdgeGeometry(edge, fromNode, toNode);
              const stroke = resolveEdgeStroke(edge.color, theme);
              const markerIdx = edgeColors.indexOf(stroke);
              const markerUrl = `url(#canvas-arrow-${markerIdx})`;

              return (
                <g key={edge.id}>
                  <path
                    d={geom.pathD}
                    fill="none"
                    stroke={stroke}
                    strokeWidth={2.2}
                    markerEnd={geom.hasToArrow ? markerUrl : undefined}
                    markerStart={geom.hasFromArrow ? markerUrl : undefined}
                  />
                  {edge.label && !isLowDetail && (
                    <g transform={`translate(${geom.mid.x}, ${geom.mid.y})`}>
                      <rect
                        x={-(edge.label.length * 4 + 10)}
                        y={-12}
                        width={edge.label.length * 8 + 20}
                        height={24}
                        rx={12}
                        fill={theme === 'dark' ? '#121D3D' : '#FFFFFF'}
                        stroke={stroke}
                        strokeWidth={1.2}
                      />
                      <text
                        textAnchor="middle"
                        dominantBaseline="central"
                        fill={theme === 'dark' ? '#F2F6FF' : '#0B132B'}
                        fontSize={12}
                        fontWeight={600}
                      >
                        {edge.label}
                      </text>
                    </g>
                  )}
                </g>
              );
            })}
          </svg>
        )}

        {/* Nodes rendered in exact JSON array z-index order */}
        {visibleNodes.map(({ node, index }) => {
          const colors = resolveCanvasColor(node.color, theme);
          const styleAttrs = node.styleAttributes ?? {};
          const divider = isDividerNode(node);
          const decoCircle = isDecorativeCircle(node);
          const invisibleBorder = styleAttrs.border === 'invisible';
          const isMatched = activeMatchId === node.id;

          const borderRadius =
            styleAttrs.shape === 'circle' || styleAttrs.shape === 'pill'
              ? '9999px'
              : node.type === 'group'
                ? '14px'
                : '10px';

          const textAlign =
            styleAttrs.textAlign === 'center'
              ? 'center'
              : styleAttrs.textAlign === 'right'
                ? 'right'
                : 'left';

          if (divider) {
            return (
              <div
                key={node.id}
                style={{
                  position: 'absolute',
                  left: node.x,
                  top: node.y,
                  width: node.width,
                  height: node.height,
                  backgroundColor: colors.stroke,
                  zIndex: index,
                  pointerEvents: 'none',
                }}
              />
            );
          }

          if (node.type === 'group') {
            return (
              <div
                key={node.id}
                onDoubleClick={(e) => {
                  e.stopPropagation();
                  focusNode(node, 0.75);
                }}
                style={{
                  position: 'absolute',
                  left: node.x,
                  top: node.y,
                  width: node.width,
                  height: node.height,
                  borderRadius,
                  border: `2px dashed ${colors.stroke}`,
                  backgroundColor:
                    theme === 'dark'
                      ? 'rgba(11, 19, 43, 0.45)'
                      : 'rgba(243, 246, 252, 0.65)',
                  zIndex: index,
                }}
                className={`p-3 ${isMatched ? 'ring-4 ring-[var(--accent-primary)]' : ''}`}
              >
                {node.label && (
                  <span
                    className="inline-block rounded-md px-2 py-0.5 text-xs font-bold shadow-xs"
                    style={{
                      backgroundColor: colors.fill,
                      color: colors.text,
                      border: `1px solid ${colors.stroke}`,
                    }}
                  >
                    {node.label}
                  </span>
                )}
              </div>
            );
          }

          return (
            <div
              key={node.id}
              data-canvas-node-id={node.id}
              onDoubleClick={(e) => {
                if (decoCircle) return;
                e.stopPropagation();
                focusNode(node, 0.95);
              }}
              style={{
                position: 'absolute',
                left: node.x,
                top: node.y,
                width: node.width,
                height: node.height,
                borderRadius,
                border: invisibleBorder
                  ? 'none'
                  : `2px solid ${colors.stroke}`,
                backgroundColor: invisibleBorder
                  ? 'transparent'
                  : decoCircle
                    ? theme === 'dark'
                      ? `${colors.stroke}14`
                      : `${colors.stroke}0f`
                    : colors.fill,
                color: colors.text,
                textAlign,
                zIndex: index,
                pointerEvents: decoCircle ? 'none' : 'auto',
              }}
              className={`overflow-hidden ${
                decoCircle ? '' : invisibleBorder ? 'p-2' : 'p-3 shadow-sm'
              } ${isMatched ? 'ring-4 ring-[var(--accent-primary)]' : ''}`}
            >
              {node.type === 'text' && !decoCircle && (
                isLowDetail ? (
                  <div className="line-clamp-2 text-sm font-semibold leading-snug">
                    {summarizeNodeTitle(node)}
                  </div>
                ) : (
                  <div className="h-full overflow-y-auto">
                    <MarkdownViewer
                      markdown={node.text ?? ''}
                      filePath={filePath}
                      allPaths={allPaths}
                      compact
                      onNavigate={onNavigate}
                      onToggleTask={
                        onToggleCardTask
                          ? (taskIdx) => onToggleCardTask(node.id, taskIdx)
                          : undefined
                      }
                    />
                  </div>
                )
              )}

              {node.type === 'file' && node.file && (
                <button
                  type="button"
                  onClick={() => {
                    const resolved = resolveWikilink(node.file!, filePath, allPaths);
                    if (resolved) onNavigate?.(resolved);
                  }}
                  className="flex h-full w-full items-center gap-2 text-left text-xs font-semibold text-[var(--accent-primary)] hover:underline"
                >
                  <FileText className="h-4 w-4 shrink-0" />
                  <span className="truncate">{node.file}</span>
                </button>
              )}

              {node.type === 'link' && node.url && (
                <a
                  href={node.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex h-full w-full items-center gap-2 text-xs font-semibold text-[var(--accent-primary)] underline"
                >
                  <ExternalLink className="h-4 w-4 shrink-0" />
                  <span className="truncate">{node.url}</span>
                </a>
              )}
            </div>
          );
        })}
      </div>

      {/* Find Node Popover */}
      {findOpen && (
        <div
          data-canvas-interactive="true"
          className="absolute top-3 left-3 z-30 flex items-center gap-1.5 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)]/95 px-2.5 py-1.5 text-xs shadow-lg backdrop-blur-xs"
        >
          <Search className="h-3.5 w-3.5 text-[var(--text-muted)]" />
          <input
            ref={findInputRef}
            type="search"
            value={findQuery}
            onChange={(e) => {
              setFindQuery(e.target.value);
              setMatchIndex(0);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                jumpToMatch(e.shiftKey ? matchIndex - 1 : matchIndex + 1);
              } else if (e.key === 'Escape') {
                setFindOpen(false);
              }
            }}
            placeholder="Find node..."
            aria-label="Find node on canvas"
            className="w-40 bg-transparent text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none sm:w-52"
          />
          {findQuery && (
            <span className="font-mono text-[11px] tabular-nums text-[var(--text-muted)]">
              {searchMatches.length > 0
                ? `${matchIndex + 1}/${searchMatches.length}`
                : '0'}
            </span>
          )}
          <button
            type="button"
            disabled={searchMatches.length === 0}
            onClick={() => jumpToMatch(matchIndex - 1)}
            aria-label="Previous canvas match"
            className="rounded p-1 text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] disabled:opacity-40"
          >
            <ChevronUp className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            disabled={searchMatches.length === 0}
            onClick={() => jumpToMatch(matchIndex + 1)}
            aria-label="Next canvas match"
            className="rounded p-1 text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] disabled:opacity-40"
          >
            <ChevronDown className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* HUD Stats Badge */}
      <div className="pointer-events-none absolute top-3 right-3 z-20 rounded-full border border-[var(--border-subtle)] bg-[var(--bg-surface)]/90 px-2.5 py-1 text-[11px] font-medium tabular-nums text-[var(--text-secondary)] shadow-xs backdrop-blur-xs">
        {doc.nodes.length} nodes · {doc.edges.length} edges
        {isLowDetail ? ' · LOD Overview' : ''}
      </div>

      {/* Bottom-Left Controls HUD */}
      <div
        data-canvas-interactive="true"
        className="absolute bottom-3 left-3 z-20 flex flex-wrap items-center gap-1 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)]/95 p-1 text-xs shadow-lg backdrop-blur-xs"
      >
        <button
          type="button"
          onClick={() =>
            zoomAtPoint(stageSize.width / 2, stageSize.height / 2, 0.8)
          }
          aria-label="Zoom out canvas"
          className="rounded p-1.5 text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]"
        >
          <ZoomOut className="h-3.5 w-3.5" />
        </button>
        <span className="min-w-11 text-center font-mono text-[11px] tabular-nums text-[var(--text-muted)]">
          {Math.round(viewport.scale * 100)}%
        </span>
        <button
          type="button"
          onClick={() =>
            zoomAtPoint(stageSize.width / 2, stageSize.height / 2, 1.25)
          }
          aria-label="Zoom in canvas"
          className="rounded p-1.5 text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]"
        >
          <ZoomIn className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          onClick={() => setViewport(fitToBounds(stageSize.width, stageSize.height))}
          aria-label="Fit canvas"
          className="inline-flex items-center gap-1 rounded px-2 py-1 text-[11px] font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]"
        >
          <Maximize2 className="h-3 w-3" />
          <span>Fit</span>
        </button>
        <button
          type="button"
          onClick={() =>
            setViewport({
              scale: 1,
              x: stageSize.width / 2 - (bounds.minX + bounds.width / 2),
              y: stageSize.height / 2 - (bounds.minY + bounds.height / 2),
            })
          }
          aria-label="Reset zoom to 100%"
          className="inline-flex items-center gap-1 rounded px-2 py-1 text-[11px] font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]"
        >
          <LocateFixed className="h-3 w-3" />
          <span>100%</span>
        </button>
        <button
          type="button"
          onClick={() => {
            setFindOpen((o) => !o);
            setTimeout(() => findInputRef.current?.focus(), 0);
          }}
          aria-label="Toggle find node"
          className="inline-flex items-center gap-1 rounded px-2 py-1 text-[11px] font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]"
        >
          <Search className="h-3 w-3" />
          <span className="hidden sm:inline">Find</span>
        </button>
        <button
          type="button"
          onClick={() => setMinimapOpen((m) => !m)}
          aria-label="Toggle minimap"
          aria-pressed={minimapOpen}
          className="inline-flex items-center gap-1 rounded px-2 py-1 text-[11px] font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]"
        >
          <MapIcon className="h-3 w-3" />
        </button>
      </div>

      {/* Bottom-Right Interactive Minimap */}
      {minimapOpen && doc.nodes.length > 0 && (
        <div
          data-canvas-interactive="true"
          className="absolute right-3 bottom-3 z-20 hidden overflow-hidden rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)]/95 p-1 shadow-lg backdrop-blur-xs sm:block"
        >
          <svg
            width={miniW}
            height={miniH}
            onClick={panFromMinimap}
            aria-label="Canvas minimap"
            className="cursor-pointer rounded bg-[var(--bg-canvas)]"
          >
            {doc.nodes.map((n) => (
              <rect
                key={`m-${n.id}`}
                x={n.x * miniScale + miniOffsetX}
                y={n.y * miniScale + miniOffsetY}
                width={Math.max(2, n.width * miniScale)}
                height={Math.max(2, n.height * miniScale)}
                rx={n.styleAttributes?.shape === 'circle' ? 999 : 1}
                fill={
                  n.type === 'group'
                    ? 'rgba(148,163,184,0.18)'
                    : resolveEdgeStroke(n.color, theme)
                }
                fillOpacity={n.type === 'group' ? 0.3 : 0.65}
              />
            ))}
            <rect
              x={(-viewport.x / viewport.scale) * miniScale + miniOffsetX}
              y={(-viewport.y / viewport.scale) * miniScale + miniOffsetY}
              width={Math.max(
                8,
                (stageSize.width / viewport.scale) * miniScale,
              )}
              height={Math.max(
                8,
                (stageSize.height / viewport.scale) * miniScale,
              )}
              fill={
                theme === 'dark'
                  ? 'rgba(57, 255, 136, 0.16)'
                  : 'rgba(0, 122, 61, 0.14)'
              }
              stroke={theme === 'dark' ? '#39FF88' : '#007A3D'}
              strokeWidth={1.5}
            />
          </svg>
        </div>
      )}
    </div>
  );
}
