import {
  forceCenter,
  forceCollide,
  forceLink,
  forceManyBody,
  forceSimulation,
  type SimulationLinkDatum,
  type SimulationNodeDatum,
} from 'd3-force';
import { Maximize2, Network, RotateCcw } from '@/shared/ui/MaterialIcons';
import { useEffect, useMemo, useRef, useState } from 'react';
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

  const [fullGraph, setFullGraph] = useState<VaultGraphData>({
    nodes: [],
    edges: [],
  });
  const [selectedFolder, setSelectedFolder] = useState<string>('all');
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [pan, setPan] = useState({ x: 0, y: 0, scale: 1 });
  const dragRef = useRef<{
    startX: number;
    startY: number;
    origX: number;
    origY: number;
  } | null>(null);

  const width = compact ? 240 : 760;
  const height = compact ? 220 : 520;

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

  if (vaultSource === 'preview') {
    return (
      <div className="rounded-2xl bg-[var(--bg-surface)] p-4 text-center text-xs text-[var(--text-muted)] shadow-sm">
        Connect your GitHub repository or Local Folder to render the interactive wikilink graph.
      </div>
    );
  }

  return (
    <div
      className={`flex flex-col overflow-hidden rounded-2xl bg-[var(--bg-canvas)] shadow-md ${
        compact ? '' : 'h-full min-h-[520px]'
      }`}
    >
      <div
        style={{ boxShadow: 'var(--header-shadow)' }}
        className="relative z-10 flex flex-wrap items-center justify-between gap-2 bg-[var(--bg-surface)] px-3.5 py-2 text-xs"
      >
        <div className="flex items-center gap-1.5 font-semibold text-[var(--text-primary)]">
          <Network className="h-3.5 w-3.5 text-[var(--accent-primary)]" />
          <span>
            {mode === 'local' ? 'Local Graph' : 'Global Vault Graph'} (
            {layout.nodes.length})
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          {!compact && folders.length > 1 && (
            <select
              aria-label="Filter graph folder"
              value={selectedFolder}
              onChange={(e) => setSelectedFolder(e.target.value)}
              className="rounded-lg bg-[var(--bg-canvas)] px-2.5 py-1 text-[11px] text-[var(--text-primary)] shadow-xs focus:outline-none"
            >
              <option value="all">All Folders</option>
              {folders.map((f) => (
                <option key={f} value={f}>
                  {f}
                </option>
              ))}
            </select>
          )}
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
      </div>

      <div
        onWheel={(e) => {
          e.preventDefault();
          const factor = e.deltaY < 0 ? 1.12 : 0.89;
          setPan((p) => ({
            ...p,
            scale: Math.max(0.3, Math.min(3.5, p.scale * factor)),
          }));
        }}
        onPointerDown={(e) => {
          const target = e.target as HTMLElement | null;
          if (target?.closest('[data-graph-node="true"]')) return;
          e.currentTarget.setPointerCapture?.(e.pointerId);
          dragRef.current = {
            startX: e.clientX,
            startY: e.clientY,
            origX: pan.x,
            origY: pan.y,
          };
        }}
        onPointerMove={(e) => {
          const drag = dragRef.current;
          if (!drag) return;
          setPan((p) => ({
            ...p,
            x: drag.origX + (e.clientX - drag.startX),
            y: drag.origY + (e.clientY - drag.startY),
          }));
        }}
        onPointerUp={(e) => {
          dragRef.current = null;
          e.currentTarget.releasePointerCapture?.(e.pointerId);
        }}
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
                  !hoveredId || link.s === hoveredId || link.t === hoveredId;
                return (
                  <line
                    key={`${link.s}-${link.t}-${idx}`}
                    x1={link.x1}
                    y1={link.y1}
                    x2={link.x2}
                    y2={link.y2}
                    stroke="#75b35c"
                    strokeWidth={active ? 1.4 : 0.8}
                    strokeOpacity={active ? 0.55 : 0.15}
                  />
                );
              })}

              {layout.nodes.map((node) => {
                const isCenter = node.id === centerPath;
                const isHovered = node.id === hoveredId;
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
                    onClick={() => navigateToPath(node.id)}
                    className="cursor-pointer"
                  >
                    <circle
                      r={Math.max(18, radius + 8)}
                      fill="transparent"
                    />
                    <circle
                      r={isCenter ? radius + 2 : radius}
                      fill={colorForFolder(node.topFolder)}
                      stroke={isCenter || isHovered ? '#a7ff83' : '#071a52'}
                      strokeWidth={isCenter || isHovered ? 2 : 1.5}
                    />
                    {(!compact || isCenter || isHovered) && (
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
      </div>
    </div>
  );
}
