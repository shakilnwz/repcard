import {
  forceCenter,
  forceCollide,
  forceLink,
  forceManyBody,
  forceSimulation,
  type SimulationLinkDatum,
  type SimulationNodeDatum,
} from 'd3-force';
import {
  Maximize2,
  Network,
  RotateCcw,
  X,
  ZoomIn,
  ZoomOut,
} from '@/shared/ui/MaterialIcons';
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import {
  extractLocalGraph,
  type GraphNode,
  type VaultGraphData,
} from '@/features/graph/lib/graphBuilder';
import { getVaultGraphData } from '@/features/vault/lib/vaultService';
import { useAppStore } from '@/shared/store/useAppStore';

interface GraphViewProps {
  mode: 'global' | 'local';
  centerPath?: string | null;
  compact?: boolean;
  onOpenGlobal?: () => void;
}

interface SimNode extends GraphNode, SimulationNodeDatum {
  x: number;
  y: number;
}

interface SimLink extends SimulationLinkDatum<SimNode> {
  source: string | SimNode;
  target: string | SimNode;
}

const FOLDER_COLORS: Record<string, string> = {
  roadmaps: '#a7ff83',
  ai_enginnering: '#75b35c',
  iot: '#00C86F',
  cpp: '#64DFDF',
  laravel: '#A8C5FF',
  '(root)': '#ffffff',
};

function colorForFolder(folder: string): string {
  return FOLDER_COLORS[folder] ?? '#a7ff83';
}

export function GraphView({
  mode,
  centerPath,
  compact = false,
  onOpenGlobal,
}: GraphViewProps) {
  const vaultSource = useAppStore((s) => s.vaultSource);
  const syncedEntries = useAppStore((s) => s.syncedEntries);
  const navigateToPath = useAppStore((s) => s.navigateToPath);
  const setOnboardingOpen = useAppStore((s) => s.setOnboardingOpen);

  const [fullGraph, setFullGraph] = useState<VaultGraphData>({
    nodes: [],
    edges: [],
  });
  const [selectedFolder, setSelectedFolder] = useState<string>('all');
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [pan, setPan] = useState({ x: 0, y: 0, scale: 1 });
  const [stageSize, setStageSize] = useState({
    width: compact ? 240 : 760,
    height: compact ? 220 : 520,
  });

  const stageRef = useRef<HTMLDivElement | null>(null);
  const pointersRef = useRef(new Map<number, { x: number; y: number }>());
  const dragRef = useRef<{
    startX: number;
    startY: number;
    origX: number;
    origY: number;
    moved: boolean;
  } | null>(null);
  const pinchRef = useRef<{
    dist: number;
    midX: number;
    midY: number;
    scale: number;
    panX: number;
    panY: number;
  } | null>(null);

  const width = compact ? 240 : stageSize.width;
  const height = compact ? 220 : stageSize.height;

  useEffect(() => {
    if (compact) return;
    const el = stageRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    let raf = 0;
    const update = () => {
      const rect = el.getBoundingClientRect();
      if (rect.width > 120 && rect.height > 120) {
        const nextW = Math.round(rect.width);
        const nextH = Math.round(rect.height);
        setStageSize((prev) =>
          Math.abs(prev.width - nextW) > 12 || Math.abs(prev.height - nextH) > 12
            ? { width: nextW, height: nextH }
            : prev,
        );
      }
    };
    update();
    const ro = new ResizeObserver(() => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(update);
    });
    ro.observe(el);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, [compact]);

  useEffect(() => {
    let cancelled = false;
    void getVaultGraphData().then((data) => {
      if (!cancelled) setFullGraph(data);
    });
    return () => {
      cancelled = true;
    };
  }, [vaultSource, syncedEntries]);

  const activeGraph = useMemo(() => {
    if (mode === 'local' && centerPath) {
      return extractLocalGraph(centerPath, fullGraph, 1);
    }
    if (selectedFolder === 'all') return fullGraph;
    const nodeIds = new Set(
      fullGraph.nodes
        .filter((n) => n.topFolder === selectedFolder)
        .map((n) => n.id),
    );
    return {
      nodes: fullGraph.nodes.filter((n) => nodeIds.has(n.id)),
      edges: fullGraph.edges.filter(
        (e) => nodeIds.has(e.source) && nodeIds.has(e.target),
      ),
    };
  }, [mode, centerPath, fullGraph, selectedFolder]);

  const [layout, setLayout] = useState<{
    nodes: SimNode[];
    links: Array<{ x1: number; y1: number; x2: number; y2: number; s: string; t: string }>;
  }>({ nodes: [], links: [] });

  useEffect(() => {
    if (activeGraph.nodes.length === 0) {
      setLayout({ nodes: [], links: [] });
      return;
    }

    const simNodes: SimNode[] = activeGraph.nodes.map((n, i) => ({
      ...n,
      x: width / 2 + Math.cos(i * 0.7) * 80,
      y: height / 2 + Math.sin(i * 0.7) * 80,
    }));
    const simLinks: SimLink[] = activeGraph.edges.map((e) => ({
      source: e.source,
      target: e.target,
    }));

    const sim = forceSimulation<SimNode>(simNodes)
      .force(
        'link',
        forceLink<SimNode, SimLink>(simLinks)
          .id((d) => d.id)
          .distance(compact ? 56 : 90),
      )
      .force('charge', forceManyBody().strength(compact ? -140 : -220))
      .force('center', forceCenter(width / 2, height / 2))
      .force('collide', forceCollide(compact ? 16 : 24));

    // Synchronously warm up initial ticks so first paint is already well-arranged
    sim.tick(Math.min(120, Math.max(40, simNodes.length * 2)));

    const snapshot = () => {
      setLayout({
        nodes: simNodes.map((n) => ({ ...n })),
        links: simLinks.map((l) => {
          const src = l.source as SimNode;
          const tgt = l.target as SimNode;
          return {
            x1: src.x,
            y1: src.y,
            x2: tgt.x,
            y2: tgt.y,
            s: src.id,
            t: tgt.id,
          };
        }),
      });
    };

    snapshot();
    sim.stop();
    return () => {
      sim.stop();
    };
  }, [activeGraph, compact, width, height]);

  const folders = useMemo(
    () =>
      Array.from(new Set(fullGraph.nodes.map((n) => n.topFolder))).sort(),
    [fullGraph.nodes],
  );

  const selectedNode = useMemo(
    () =>
      selectedNodeId
        ? layout.nodes.find((n) => n.id === selectedNodeId) ?? null
        : null,
    [selectedNodeId, layout.nodes],
  );

  const focusId = hoveredId ?? selectedNodeId;

  const handlePointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement | null;
    if (target?.closest('[data-graph-node="true"], button, a')) return;
    pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    e.currentTarget.setPointerCapture?.(e.pointerId);

    if (pointersRef.current.size === 2) {
      const pts = Array.from(pointersRef.current.values());
      const dist = Math.hypot(pts[1].x - pts[0].x, pts[1].y - pts[0].y);
      const rect = e.currentTarget.getBoundingClientRect();
      const midX = (pts[0].x + pts[1].x) / 2 - rect.left;
      const midY = (pts[0].y + pts[1].y) / 2 - rect.top;
      pinchRef.current = {
        dist: Math.max(1, dist),
        midX,
        midY,
        scale: pan.scale,
        panX: pan.x,
        panY: pan.y,
      };
      dragRef.current = null;
      return;
    }

    if (pointersRef.current.size === 1) {
      dragRef.current = {
        startX: e.clientX,
        startY: e.clientY,
        origX: pan.x,
        origY: pan.y,
        moved: false,
      };
    }
  };

  const handlePointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (pointersRef.current.has(e.pointerId)) {
      pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    }

    if (pointersRef.current.size === 2 && pinchRef.current) {
      const pts = Array.from(pointersRef.current.values());
      const dist = Math.hypot(pts[1].x - pts[0].x, pts[1].y - pts[0].y);
      const nextScale = Math.max(
        0.3,
        Math.min(3.5, pinchRef.current.scale * (dist / pinchRef.current.dist)),
      );
      const ratio = nextScale / pinchRef.current.scale;
      const rect = e.currentTarget.getBoundingClientRect();
      const midX = (pts[0].x + pts[1].x) / 2 - rect.left;
      const midY = (pts[0].y + pts[1].y) / 2 - rect.top;
      setPan({
        scale: nextScale,
        x: midX - (pinchRef.current.midX - pinchRef.current.panX) * ratio,
        y: midY - (pinchRef.current.midY - pinchRef.current.panY) * ratio,
      });
      return;
    }

    const drag = dragRef.current;
    if (!drag) return;
    const dx = e.clientX - drag.startX;
    const dy = e.clientY - drag.startY;
    if (Math.hypot(dx, dy) > 3) {
      drag.moved = true;
    }
    setPan((p) => ({
      ...p,
      x: drag.origX + dx,
      y: drag.origY + dy,
    }));
  };

  const handlePointerUpOrCancel = (e: ReactPointerEvent<HTMLDivElement>) => {
    pointersRef.current.delete(e.pointerId);
    e.currentTarget.releasePointerCapture?.(e.pointerId);
    if (pointersRef.current.size < 2) {
      pinchRef.current = null;
    }
    const drag = dragRef.current;
    dragRef.current = null;
    if (
      e.type === 'pointerup' &&
      drag &&
      !drag.moved &&
      !(e.target as HTMLElement | null)?.closest('[data-graph-node="true"], button, a')
    ) {
      setSelectedNodeId(null);
    }
  };

  if (vaultSource === 'preview') {
    if (compact) {
      return (
        <div className="rounded-2xl bg-[var(--bg-surface)] p-4 text-center text-xs text-[var(--text-muted)] shadow-sm">
          Connect your GitHub repository or Local Folder to render the interactive wikilink graph.
        </div>
      );
    }
    return (
      <div className="flex h-full items-center justify-center p-4">
        <div className="mx-auto w-full max-w-sm space-y-4 rounded-3xl bg-[var(--bg-card)] p-6 text-center text-[var(--fg-card)] shadow-[var(--card-shadow)] sm:p-8">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-[var(--fg-card)] text-[var(--bg-card)] shadow-xs">
            <Network className="h-6 w-6" />
          </div>
          <div>
            <h3 className="text-lg font-bold">Connect Vault for Link Graph</h3>
            <p className="mx-auto mt-1 max-w-xs text-xs leading-relaxed opacity-85">
              Connect your GitHub repository or Local Folder to explore interactive wikilink clusters and backlinks.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setOnboardingOpen(true)}
            className="min-h-[44px] rounded-xl bg-[var(--fg-card)] px-5 py-2.5 text-xs font-bold text-[var(--bg-card)] shadow-xs transition-opacity hover:opacity-90"
          >
            Connect Repository
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`flex flex-col overflow-hidden rounded-2xl bg-[var(--bg-canvas)] shadow-md ${
        compact ? '' : 'h-full min-h-0 flex-1'
      }`}
    >
      <div
        style={{ boxShadow: 'var(--header-shadow)' }}
        className="relative z-10 flex flex-wrap items-center justify-between gap-2 bg-[var(--bg-surface)] px-3.5 py-2 text-xs"
      >
        <div className="flex items-center gap-1.5 font-semibold text-[var(--text-primary)]">
          <Network className="h-3.5 w-3.5 text-[var(--accent-primary)]" />
          <span>
            {mode === 'local' ? 'Local Graph' : 'Vault Graph'} (
            {layout.nodes.length})
          </span>
        </div>

        {!compact && folders.length > 1 ? (
          <div
            role="group"
            aria-label="Filter graph folder"
            className="no-scrollbar flex max-w-full flex-nowrap items-center gap-1.5 overflow-x-auto py-0.5"
          >
            <button
              type="button"
              onClick={() => {
                setSelectedFolder('all');
                setSelectedNodeId(null);
              }}
              aria-pressed={selectedFolder === 'all'}
              className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold transition-colors ${
                selectedFolder === 'all'
                  ? 'bg-[var(--button-primary-bg)] text-[var(--button-primary-fg)]'
                  : 'bg-[var(--bg-canvas)] text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]'
              }`}
            >
              All
            </button>
            {folders.map((f) => {
              const active = selectedFolder === f;
              return (
                <button
                  key={f}
                  type="button"
                  onClick={() => {
                    setSelectedFolder(active ? 'all' : f);
                    setSelectedNodeId(null);
                  }}
                  aria-pressed={active}
                  className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold transition-colors ${
                    active
                      ? 'bg-[var(--button-primary-bg)] font-bold text-[var(--button-primary-fg)]'
                      : 'bg-[var(--bg-canvas)] text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]'
                  }`}
                >
                  <span
                    className="h-2 w-2 shrink-0 rounded-full"
                    style={{
                      backgroundColor: active ? 'currentColor' : colorForFolder(f),
                    }}
                  />
                  <span>{f}</span>
                </button>
              );
            })}
          </div>
        ) : (
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setPan({ x: 0, y: 0, scale: 1 })}
              aria-label="Reset graph view"
              className="rounded p-1 text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]"
            >
              <RotateCcw className="h-3 w-3" />
            </button>
            {compact && onOpenGlobal && (
              <button
                type="button"
                onClick={onOpenGlobal}
                aria-label="Open full vault graph"
                className="rounded p-1 text-[var(--accent-primary)] hover:bg-[var(--bg-hover)]"
              >
                <Maximize2 className="h-3 w-3" />
              </button>
            )}
          </div>
        )}
      </div>

      <div
        ref={stageRef}
        onWheel={(e) => {
          e.preventDefault();
          const factor = e.deltaY < 0 ? 1.12 : 0.89;
          setPan((p) => ({
            ...p,
            scale: Math.max(0.3, Math.min(3.5, p.scale * factor)),
          }));
        }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUpOrCancel}
        onPointerCancel={handlePointerUpOrCancel}
        className={`relative touch-none select-none overflow-hidden cursor-grab active:cursor-grabbing ${
          compact ? 'h-56' : 'min-h-0 flex-1'
        }`}
      >
        {layout.nodes.length === 0 ? (
          <div className="flex h-full items-center justify-center p-4 text-center text-xs text-[var(--text-muted)]">
            No linked nodes in this view yet.
          </div>
        ) : (
          <svg
            viewBox={`0 0 ${width} ${height}`}
            className="h-full w-full"
            aria-label="Interactive vault link graph"
          >
            <g
              transform={`translate(${pan.x}, ${pan.y}) scale(${pan.scale})`}
            >
              {layout.links.map((link, idx) => {
                const active =
                  !focusId || link.s === focusId || link.t === focusId;
                return (
                  <line
                    key={`${link.s}-${link.t}-${idx}`}
                    x1={link.x1}
                    y1={link.y1}
                    x2={link.x2}
                    y2={link.y2}
                    stroke="#75b35c"
                    strokeWidth={active ? 1.4 : 0.8}
                    strokeOpacity={active ? 0.65 : 0.15}
                  />
                );
              })}

              {layout.nodes.map((node) => {
                const isCenter = node.id === centerPath;
                const isFocused = node.id === hoveredId || node.id === selectedNodeId;
                const radius = Math.min(
                  compact ? 8 : 11,
                  (compact ? 4.5 : 5.5) + node.degree * 0.9,
                );
                return (
                  <g
                    key={node.id}
                    data-graph-node="true"
                    transform={`translate(${node.x}, ${node.y})`}
                    onMouseEnter={() => setHoveredId(node.id)}
                    onMouseLeave={() => setHoveredId(null)}
                    onClick={(e) => {
                      e.stopPropagation();
                      if (compact || selectedNodeId === node.id) {
                        navigateToPath(node.id);
                      } else {
                        setSelectedNodeId(node.id);
                      }
                    }}
                    className="cursor-pointer"
                  >
                    <circle
                      r={Math.max(18, radius + 8)}
                      fill="transparent"
                    />
                    <circle
                      r={isCenter || isFocused ? radius + 2 : radius}
                      fill={colorForFolder(node.topFolder)}
                      stroke={isCenter || isFocused ? '#a7ff83' : '#071a52'}
                      strokeWidth={isCenter || isFocused ? 2.2 : 1.5}
                    />
                    {(!compact || isCenter || isFocused) && (
                      <text
                        y={radius + 11}
                        textAnchor="middle"
                        fill="var(--text-secondary)"
                        fontSize={compact ? 9 : 10}
                        className="pointer-events-none select-none font-medium"
                      >
                        {node.name.replace(/\.(md|canvas)$/i, '').slice(0, 22)}
                      </text>
                    )}
                  </g>
                );
              })}
            </g>
          </svg>
        )}

        {!compact && selectedNode && (
          <div
            data-testid="graph-node-card"
            className="absolute right-3 bottom-16 left-3 z-20 flex items-center justify-between gap-3 rounded-2xl bg-[var(--bg-card)] p-3 text-[var(--fg-card)] shadow-[var(--card-shadow)] sm:right-auto sm:bottom-3 sm:w-80"
          >
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase opacity-80">
                <span className="rounded bg-[var(--fg-card)] px-1.5 py-0.5 text-[var(--bg-card)]">
                  {selectedNode.topFolder}
                </span>
                <span className="tabular-nums">
                  {selectedNode.degree} {selectedNode.degree === 1 ? 'link' : 'links'}
                </span>
              </div>
              <div className="mt-1 truncate text-sm font-bold">
                {selectedNode.name.replace(/\.(md|canvas)$/i, '')}
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-1.5">
              <button
                type="button"
                onClick={() => navigateToPath(selectedNode.id)}
                className="min-h-[36px] rounded-xl bg-[var(--fg-card)] px-3 py-1.5 text-xs font-bold text-[var(--bg-card)] shadow-xs hover:opacity-90"
              >
                Open Note
              </button>
              <button
                type="button"
                onClick={() => setSelectedNodeId(null)}
                aria-label="Close selected node"
                className="flex h-9 w-9 items-center justify-center rounded-xl opacity-75 hover:opacity-100"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}

        {!compact && (
          <div className="liquid-glass absolute right-3 bottom-3 z-20 flex items-center gap-1 rounded-full p-1 shadow-[var(--pill-shadow)]">
            <button
              type="button"
              onClick={() =>
                setPan((p) => ({ ...p, scale: Math.min(3.5, Number((p.scale * 1.2).toFixed(2))) }))
              }
              aria-label="Zoom in graph"
              className="flex h-9 w-9 items-center justify-center rounded-full text-[var(--fg-app)] hover:bg-white/10"
            >
              <ZoomIn className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() =>
                setPan((p) => ({ ...p, scale: Math.max(0.3, Number((p.scale * 0.83).toFixed(2))) }))
              }
              aria-label="Zoom out graph"
              className="flex h-9 w-9 items-center justify-center rounded-full text-[var(--fg-app)] hover:bg-white/10"
            >
              <ZoomOut className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => {
                setPan({ x: 0, y: 0, scale: 1 });
                setSelectedNodeId(null);
              }}
              aria-label="Reset graph view"
              className="flex h-9 w-9 items-center justify-center rounded-full text-[var(--fg-app)] hover:bg-white/10"
            >
              <RotateCcw className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
