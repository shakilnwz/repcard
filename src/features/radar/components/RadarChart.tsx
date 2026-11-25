import {
  Download,
  ImageIcon,
  Maximize2,
  Minimize2,
  Move,
  RotateCcw,
  Tag,
  ZoomIn,
  ZoomOut,
} from '@/shared/ui/MaterialIcons';
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import { createPortal } from 'react-dom';
import {
  computeScreenProjection,
  getFocusViewBox,
  pointToStepAndQuadrant,
  RADAR_OUTER_RADIUS,
  screenToWorld,
  solveScreenSpaceLabels,
  worldToScreen,
  type PlacedBlip,
  type RadarLayout,
} from '@/features/radar/lib/radarLayout';
import type { RadarDocument, RadarLabelMode } from '@/features/radar/types/radar';

export interface RadarChartProps {
  doc: RadarDocument;
  layout: RadarLayout;
  selectedItemId: string | null;
  hoveredItemId: string | null;
  activeStepIds: Set<string>;
  matchedItemIds: Set<string> | null;
  focusedQuadrantIndex: number | null;
  labelMode: RadarLabelMode;
  dragToRerate?: boolean;
  onChangeLabelMode?: (mode: RadarLabelMode) => void;
  onToggleDragToRerate?: (enabled: boolean) => void;
  onSelectItem: (blip: PlacedBlip | null) => void;
  onHoverItem: (itemId: string | null) => void;
  onFocusQuadrant: (index: number | null) => void;
  onToggleStepFilter?: (stepId: string) => void;
  onMoveItem?: (
    itemId: string,
    fromStepId: string,
    toStepId: string,
    toQuadrantId?: string,
  ) => void;
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function RadarChart({
  doc,
  layout,
  selectedItemId,
  hoveredItemId,
  activeStepIds,
  matchedItemIds,
  focusedQuadrantIndex,
  labelMode,
  dragToRerate = false,
  onChangeLabelMode,
  onToggleDragToRerate,
  onSelectItem,
  onHoverItem,
  onFocusQuadrant,
  onToggleStepFilter,
  onMoveItem,
}: RadarChartProps) {
  const stageRef = useRef<HTMLDivElement | null>(null);
  const [stageSize, setStageSize] = useState({ width: 760, height: 620 });
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [fullscreen, setFullscreen] = useState(false);
  const [exportNotice, setExportNotice] = useState<string | null>(null);

  const pointersRef = useRef(new Map<number, { x: number; y: number }>());
  const pinchRef = useRef<{
    dist: number;
    midX: number;
    midY: number;
    zoom: number;
    panX: number;
    panY: number;
  } | null>(null);
  const panDragRef = useRef<{
    startX: number;
    startY: number;
    origX: number;
    origY: number;
    moved: boolean;
  } | null>(null);

  const [draggingBlip, setDraggingBlip] = useState<{
    blip: PlacedBlip;
    worldX: number;
    worldY: number;
    targetStepId: string;
    targetQuadrantId?: string;
  } | null>(null);

  useEffect(() => {
    const el = stageRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const update = () => {
      const rect = el.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        setStageSize({ width: rect.width, height: rect.height });
      }
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [fullscreen]);

  useEffect(() => {
    if (!fullscreen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        setFullscreen(false);
      }
    };
    window.addEventListener('keydown', onKeyDown, true);
    return () => window.removeEventListener('keydown', onKeyDown, true);
  }, [fullscreen]);

  // Reset pan/zoom cleanly when switching quadrant focus
  useEffect(() => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  }, [focusedQuadrantIndex, doc.title]);

  const viewBox = useMemo(
    () => getFocusViewBox(focusedQuadrantIndex, layout.sectors),
    [focusedQuadrantIndex, layout.sectors],
  );

  const proj = useMemo(
    () =>
      computeScreenProjection(
        viewBox,
        stageSize.width,
        stageSize.height,
        zoom,
        pan.x,
        pan.y,
      ),
    [viewBox, stageSize.width, stageSize.height, zoom, pan.x, pan.y],
  );

  const visibleBlips = useMemo(() => {
    return layout.blips.filter((b) => {
      if (!activeStepIds.has(b.step.id)) return false;
      if (
        focusedQuadrantIndex !== null &&
        layout.sectors.length > 1 &&
        b.quadrantIndex !== focusedQuadrantIndex
      ) {
        return false;
      }
      if (matchedItemIds !== null && !matchedItemIds.has(b.item.id)) {
        return false;
      }
      return true;
    });
  }, [layout.blips, layout.sectors.length, activeStepIds, focusedQuadrantIndex, matchedItemIds]);

  const prioritizedIds = useMemo(() => {
    const ids = new Set<string>();
    if (selectedItemId) ids.add(selectedItemId);
    if (hoveredItemId) ids.add(hoveredItemId);
    if (matchedItemIds) {
      for (const id of matchedItemIds) ids.add(id);
    }
    return ids;
  }, [selectedItemId, hoveredItemId, matchedItemIds]);

  const screenLabels = useMemo(
    () =>
      solveScreenSpaceLabels({
        blips: visibleBlips,
        viewBox,
        containerWidth: stageSize.width,
        containerHeight: stageSize.height,
        zoom,
        panX: pan.x,
        panY: pan.y,
        labelMode,
        prioritizedIds,
      }),
    [
      visibleBlips,
      viewBox,
      stageSize.width,
      stageSize.height,
      zoom,
      pan.x,
      pan.y,
      labelMode,
      prioritizedIds,
    ],
  );

  const hoveredBlip = useMemo(
    () =>
      hoveredItemId
        ? layout.blips.find((b) => b.item.id === hoveredItemId) ?? null
        : null,
    [hoveredItemId, layout.blips],
  );

  const hoveredScreenPos = useMemo(() => {
    if (!hoveredBlip || draggingBlip) return null;
    const { px, py } = worldToScreen(hoveredBlip.x, hoveredBlip.y, proj);
    const tipW = 248;
    const tipH = 124;
    const placeLeft = px + tipW + 24 > stageSize.width;
    const placeAbove = py + tipH + 16 > stageSize.height;
    return {
      left: Math.max(
        10,
        Math.min(
          stageSize.width - tipW - 10,
          placeLeft ? px - tipW - 18 : px + 18,
        ),
      ),
      top: Math.max(
        10,
        Math.min(
          stageSize.height - tipH - 10,
          placeAbove ? py - tipH - 12 : py - 24,
        ),
      ),
    };
  }, [hoveredBlip, draggingBlip, proj, stageSize.width, stageSize.height]);

  const clientToStage = useCallback((clientX: number, clientY: number) => {
    const rect = stageRef.current?.getBoundingClientRect();
    if (!rect) return { px: 0, py: 0 };
    return {
      px: clientX - rect.left,
      py: clientY - rect.top,
    };
  }, []);

  const handleStagePointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (e.button !== 0 && e.pointerType === 'mouse') return;
    if ((e.target as HTMLElement).closest('button, input, a')) return;
    pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    e.currentTarget.setPointerCapture?.(e.pointerId);

    if (pointersRef.current.size === 2) {
      const pts = Array.from(pointersRef.current.values());
      const dist = Math.hypot(pts[1].x - pts[0].x, pts[1].y - pts[0].y);
      const rect = e.currentTarget.getBoundingClientRect();
      pinchRef.current = {
        dist: Math.max(1, dist),
        midX: (pts[0].x + pts[1].x) / 2 - rect.left,
        midY: (pts[0].y + pts[1].y) / 2 - rect.top,
        zoom,
        panX: pan.x,
        panY: pan.y,
      };
      panDragRef.current = null;
      setDraggingBlip(null);
      return;
    }

    if (pointersRef.current.size === 1) {
      panDragRef.current = {
        startX: e.clientX,
        startY: e.clientY,
        origX: pan.x,
        origY: pan.y,
        moved: false,
      };
    }
  };

  const handleStagePointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (pointersRef.current.has(e.pointerId)) {
      pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    }

    if (pointersRef.current.size === 2 && pinchRef.current) {
      const pts = Array.from(pointersRef.current.values());
      const dist = Math.hypot(pts[1].x - pts[0].x, pts[1].y - pts[0].y);
      const nextZoom = Math.max(
        0.65,
        Math.min(3.5, Number((pinchRef.current.zoom * (dist / pinchRef.current.dist)).toFixed(2))),
      );
      const ratio = nextZoom / pinchRef.current.zoom;
      const rect = e.currentTarget.getBoundingClientRect();
      const curMidX = (pts[0].x + pts[1].x) / 2 - rect.left;
      const curMidY = (pts[0].y + pts[1].y) / 2 - rect.top;
      const relX = pinchRef.current.midX - stageSize.width / 2;
      const relY = pinchRef.current.midY - stageSize.height / 2;
      const newRelX = curMidX - stageSize.width / 2;
      const newRelY = curMidY - stageSize.height / 2;
      setZoom(nextZoom);
      setPan({
        x: newRelX - (relX - pinchRef.current.panX) * ratio,
        y: newRelY - (relY - pinchRef.current.panY) * ratio,
      });
      return;
    }

    if (draggingBlip) {
      const { px, py } = clientToStage(e.clientX, e.clientY);
      const world = screenToWorld(px, py, proj);
      const target = pointToStepAndQuadrant(world.x, world.y, layout);
      setDraggingBlip((prev) =>
        prev
          ? {
              ...prev,
              worldX: world.x,
              worldY: world.y,
              targetStepId: target.stepId,
              targetQuadrantId: target.quadrantId,
            }
          : null,
      );
      return;
    }

    const drag = panDragRef.current;
    if (!drag) return;
    const dx = e.clientX - drag.startX;
    const dy = e.clientY - drag.startY;
    if (Math.hypot(dx, dy) > 3) {
      drag.moved = true;
    }
    setPan({
      x: drag.origX + dx,
      y: drag.origY + dy,
    });
  };

  const handleStagePointerUp = (e: ReactPointerEvent<HTMLDivElement>) => {
    pointersRef.current.delete(e.pointerId);
    e.currentTarget.releasePointerCapture?.(e.pointerId);
    if (pointersRef.current.size < 2) {
      pinchRef.current = null;
    }

    if (draggingBlip) {
      const dropped = draggingBlip;
      setDraggingBlip(null);
      if (
        onMoveItem &&
        (dropped.targetStepId !== dropped.blip.step.id ||
          dropped.targetQuadrantId !== dropped.blip.quadrant?.id)
      ) {
        onMoveItem(
          dropped.blip.item.id,
          dropped.blip.step.id,
          dropped.targetStepId,
          dropped.targetQuadrantId,
        );
      }
      return;
    }

    const drag = panDragRef.current;
    panDragRef.current = null;
    if (drag && !drag.moved && !(e.target as HTMLElement).closest('[data-radar-blip]')) {
      onSelectItem(null);
    }
  };

  const handleBlipPointerDown = (
    e: ReactPointerEvent<SVGGElement>,
    blip: PlacedBlip,
  ) => {
    if (!dragToRerate || !onMoveItem) return;
    e.stopPropagation();
    const { px, py } = clientToStage(e.clientX, e.clientY);
    const world = screenToWorld(px, py, proj);
    const target = pointToStepAndQuadrant(world.x, world.y, layout);
    setDraggingBlip({
      blip,
      worldX: blip.x,
      worldY: blip.y,
      targetStepId: target.stepId,
      targetQuadrantId: target.quadrantId,
    });
    stageRef.current?.setPointerCapture?.(e.pointerId);
  };

  const buildStandaloneSvgString = useCallback(() => {
    const bg = '#000000';
    const surface = '#071a52';
    const textMain = '#ffffff';
    const textMuted = '#a7ff83';
    const divider = '#071a52';

    const ringMarkup = [...layout.rings]
      .reverse()
      .map(
        (band) => `
      <circle cx="0" cy="0" r="${band.outerRadius}" fill="${band.step.color}" fill-opacity="0.06" stroke="${band.step.color}" stroke-opacity="0.55" stroke-width="1.5" />
    `,
      )
      .join('\n');

    const sectorLines =
      layout.sectors.length > 1
        ? layout.sectors
            .map((sec) => {
              const x2 = Math.cos(sec.startAngle) * RADAR_OUTER_RADIUS;
              const y2 = Math.sin(sec.startAngle) * RADAR_OUTER_RADIUS;
              return `<line x1="0" y1="0" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}" stroke="${divider}" stroke-width="1.5" />`;
            })
            .join('\n')
        : '';

    const quadHeaders = layout.sectors
      .filter((s) => s.quadrant)
      .map((s) => {
        const q = s.quadrant!;
        const anchor = s.align === 'right' ? 'end' : s.align === 'center' ? 'middle' : 'start';
        return `<text x="${s.anchorX}" y="${s.anchorY}" fill="${textMain}" font-family="Google Sans, sans-serif" font-size="14" font-weight="700" text-anchor="${anchor}">${escapeXml(q.name)}</text>`;
      })
      .join('\n');

    const blipMarkup = visibleBlips
      .map((b) => {
        const short =
          b.item.title.length > 22
            ? `${b.item.title.slice(0, 20)}...`
            : b.item.title;
        return `
      <g transform="translate(${b.x.toFixed(1)}, ${b.y.toFixed(1)})">
        <circle r="9" fill="${b.step.color}" stroke="${surface}" stroke-width="1.8" />
        <text y="3" text-anchor="middle" fill="#071a52" font-family="Google Sans, sans-serif" font-size="8.5" font-weight="700">${b.number}</text>
        <text x="12" y="3.5" fill="${textMain}" font-family="Google Sans, sans-serif" font-size="9.5" font-weight="500">${escapeXml(short)}</text>
      </g>
    `;
      })
      .join('\n');

    return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="-520 -520 1040 1040" width="1200" height="1200">
  <rect x="-520" y="-520" width="1040" height="1040" fill="${bg}" />
  <text x="0" y="-475" text-anchor="middle" fill="${textMain}" font-family="Google Sans, sans-serif" font-size="22" font-weight="700">${escapeXml(doc.title)}</text>
  ${doc.subtitle ? `<text x="0" y="-453" text-anchor="middle" fill="${textMuted}" font-family="Google Sans, sans-serif" font-size="12">${escapeXml(doc.subtitle)}</text>` : ''}
  ${ringMarkup}
  ${sectorLines}
  ${quadHeaders}
  ${blipMarkup}
</svg>`;
  }, [doc.title, doc.subtitle, layout.rings, layout.sectors, visibleBlips]);

  const handleExportSvg = () => {
    const svg = buildStandaloneSvgString();
    const slug = doc.title.toLowerCase().replace(/[^a-z0-9]+/g, '-') || 'radar';
    downloadBlob(new Blob([svg], { type: 'image/svg+xml;charset=utf-8' }), `${slug}.svg`);
    setExportNotice('Exported SVG');
    setTimeout(() => setExportNotice(null), 1800);
  };

  const handleExportPng = () => {
    const svg = buildStandaloneSvgString();
    const img = new Image();
    const svgBlob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(svgBlob);
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = 1600;
      canvas.height = 1600;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(img, 0, 0, 1600, 1600);
        canvas.toBlob((pngBlob) => {
          if (pngBlob) {
            const slug = doc.title.toLowerCase().replace(/[^a-z0-9]+/g, '-') || 'radar';
            downloadBlob(pngBlob, `${slug}.png`);
            setExportNotice('Exported PNG');
            setTimeout(() => setExportNotice(null), 1800);
          }
        }, 'image/png');
      }
      URL.revokeObjectURL(url);
    };
    img.src = url;
  };

  const markerScaleFactor = 1 / Math.sqrt(Math.max(0.75, Math.min(2.6, zoom)));

  const ringLabelPositions = useMemo(() => {
    const targetAngle =
      focusedQuadrantIndex !== null && layout.sectors[focusedQuadrantIndex]
        ? layout.sectors[focusedQuadrantIndex].midAngle
        : -Math.PI / 2;

    const minVerticalGap = 24;
    const raw = layout.rings.map((band) => {
      const rMid = (band.innerRadius + band.outerRadius) / 2;
      const wx = Math.cos(targetAngle) * rMid;
      const wy = Math.sin(targetAngle) * rMid;
      const { px, py } = worldToScreen(wx, wy, proj);
      return {
        band,
        px: Math.max(44, Math.min(stageSize.width - 44, px)),
        py: Math.max(24, Math.min(stageSize.height - 24, py)),
        visible:
          px >= -30 &&
          px <= stageSize.width + 30 &&
          py >= -30 &&
          py <= stageSize.height + 30,
      };
    });

    const sinT = Math.sin(targetAngle);
    for (let i = 1; i < raw.length; i += 1) {
      const prev = raw[i - 1];
      const curr = raw[i];
      if (!prev.visible || !curr.visible) continue;
      if (sinT < -0.25 && curr.py > prev.py - minVerticalGap) {
        curr.py = Math.max(20, prev.py - minVerticalGap);
      } else if (sinT > 0.25 && curr.py < prev.py + minVerticalGap) {
        curr.py = Math.min(stageSize.height - 20, prev.py + minVerticalGap);
      }
    }

    return raw;
  }, [layout.rings, layout.sectors, focusedQuadrantIndex, proj, stageSize.width, stageSize.height]);

  const dividerColor = '#071a52';
  const surfaceBg = '#000000';
  const textOnAccent = '#071a52';

  const dragTargetStep = draggingBlip
    ? layout.rings.find((r) => r.step.id === draggingBlip.targetStepId)?.step
    : null;
  const dragTargetQuad = draggingBlip?.targetQuadrantId
    ? doc.quadrants.find((q) => q.id === draggingBlip.targetQuadrantId)
    : null;

  const compactStage = stageSize.width < 480;

  const chartSurface = (
    <div
      className={`flex h-full min-h-0 flex-1 flex-col overflow-hidden rounded-2xl bg-[var(--bg-surface)] shadow-md ${
        fullscreen ? '' : 'lg:min-h-[460px]'
      }`}
    >
      {/* Chart Controls Toolbar */}
      <div
        style={{ boxShadow: 'var(--header-shadow)' }}
        className="relative z-10 flex flex-wrap items-center justify-between gap-1.5 bg-[var(--bg-surface)] px-3 py-2 text-xs sm:gap-2 sm:px-3.5"
      >
        <div className="no-scrollbar flex max-w-full flex-nowrap items-center gap-1 overflow-x-auto pb-0.5 sm:flex-wrap sm:overflow-visible sm:pb-0">
          {layout.sectors.length > 1 && (
            <>
              <button
                type="button"
                onClick={() => onFocusQuadrant(null)}
                className={`shrink-0 rounded-lg px-2.5 py-1 text-[11px] font-semibold transition-colors ${
                  focusedQuadrantIndex === null
                    ? 'bg-[var(--button-primary-bg)] font-bold text-[var(--button-primary-fg)]'
                    : 'bg-[var(--bg-canvas)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                }`}
              >
                All Quadrants
              </button>
              {layout.sectors.map((sec) => {
                if (!sec.quadrant) return null;
                const active = focusedQuadrantIndex === sec.index;
                return (
                  <button
                    key={sec.quadrant.id}
                    type="button"
                    onClick={() => onFocusQuadrant(active ? null : sec.index)}
                    className={`shrink-0 rounded-lg px-2.5 py-1 text-[11px] font-medium transition-colors ${
                      active
                        ? 'bg-[var(--button-primary-bg)] font-bold text-[var(--button-primary-fg)]'
                        : 'bg-[var(--bg-canvas)] text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]'
                    }`}
                  >
                    {sec.quadrant.name}
                  </button>
                );
              })}
            </>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          {onChangeLabelMode && (
            <div
              role="group"
              aria-label="Blip label density"
              className="inline-flex items-center rounded-lg bg-[var(--bg-canvas)] p-0.5 shadow-xs"
            >
              {(
                [
                  { id: 'auto', label: 'Auto' },
                  { id: 'labels', label: 'All Labels' },
                  { id: 'numbers', label: 'Numbers' },
                ] as const
              ).map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => onChangeLabelMode(opt.id)}
                  aria-pressed={labelMode === opt.id}
                  className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-medium transition-colors ${
                    labelMode === opt.id
                      ? 'bg-[var(--button-primary-bg)] font-bold text-[var(--button-primary-fg)]'
                      : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                  }`}
                >
                  {opt.id === 'labels' && <Tag className="h-2.5 w-2.5" />}
                  <span>{opt.label}</span>
                </button>
              ))}
            </div>
          )}

          {onMoveItem && onToggleDragToRerate && (
            <button
              type="button"
              onClick={() => onToggleDragToRerate(!dragToRerate)}
              aria-pressed={dragToRerate}
              title="Drag any blip between rings or quadrants to re-rate it"
              className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-[11px] font-medium transition-colors ${
                dragToRerate
                  ? 'bg-[var(--bg-hover)] font-semibold text-[var(--accent-primary)]'
                  : 'bg-[var(--bg-canvas)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              }`}
            >
              <Move className="h-3 w-3" />
              <span className="hidden sm:inline">Drag Re-rate</span>
            </button>
          )}

          <div className="hidden items-center gap-0.5 rounded-lg bg-[var(--bg-canvas)] px-1 py-0.5 shadow-xs sm:inline-flex">
            <button
              type="button"
              onClick={() =>
                setZoom((z) => Math.max(0.65, Number((z - 0.25).toFixed(2))))
              }
              aria-label="Zoom out radar"
              className="rounded p-1 text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]"
            >
              <ZoomOut className="h-3.5 w-3.5" />
            </button>
            <span className="min-w-9 text-center font-mono text-[10px] tabular-nums text-[var(--text-muted)]">
              {Math.round(zoom * 100)}%
            </span>
            <button
              type="button"
              onClick={() =>
                setZoom((z) => Math.min(3.5, Number((z + 0.25).toFixed(2))))
              }
              aria-label="Zoom in radar"
              className="rounded p-1 text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]"
            >
              <ZoomIn className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={() => {
                setZoom(1);
                setPan({ x: 0, y: 0 });
                onFocusQuadrant(null);
              }}
              aria-label="Reset radar viewport"
              title="Fit All / Reset"
              className="rounded p-1 text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]"
            >
              <RotateCcw className="h-3.5 w-3.5" />
            </button>
          </div>

          <button
            type="button"
            onClick={handleExportSvg}
            title="Export vector SVG"
            className="hidden items-center gap-1 rounded-lg bg-[var(--bg-canvas)] px-2.5 py-1 text-[11px] font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)] sm:inline-flex"
          >
            <Download className="h-3 w-3" />
            <span className="hidden md:inline">SVG</span>
          </button>
          <button
            type="button"
            onClick={handleExportPng}
            title="Export PNG image"
            className="hidden items-center gap-1 rounded-lg bg-[var(--bg-canvas)] px-2.5 py-1 text-[11px] font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)] sm:inline-flex"
          >
            <ImageIcon className="h-3 w-3" />
            <span className="hidden md:inline">PNG</span>
          </button>
          <button
            type="button"
            onClick={() => setFullscreen((f) => !f)}
            aria-label={fullscreen ? 'Exit radar fullscreen' : 'Enter radar fullscreen'}
            aria-pressed={fullscreen}
            title={fullscreen ? 'Exit Fullscreen (Esc)' : 'Fullscreen View'}
            className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-[11px] font-medium transition-colors ${
              fullscreen
                ? 'bg-[var(--button-primary-bg)] font-bold text-[var(--button-primary-fg)]'
                : 'bg-[var(--bg-canvas)] text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]'
            }`}
          >
            {fullscreen ? (
              <>
                <Minimize2 className="h-3.5 w-3.5" />
                <span>Exit</span>
              </>
            ) : (
              <>
                <Maximize2 className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Fullscreen</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Main Radar Canvas + Screen-Space HTML Overlay */}
      <div
        ref={stageRef}
        data-testid="radar-chart-stage"
        onWheel={(e) => {
          e.preventDefault();
          const delta = e.deltaY < 0 ? 0.15 : -0.15;
          setZoom((z) => Math.max(0.65, Math.min(3.5, Number((z + delta).toFixed(2)))));
        }}
        onPointerDown={handleStagePointerDown}
        onPointerMove={handleStagePointerMove}
        onPointerUp={handleStagePointerUp}
        onPointerCancel={(e) => {
          pointersRef.current.delete(e.pointerId);
          if (pointersRef.current.size < 2) pinchRef.current = null;
          panDragRef.current = null;
          setDraggingBlip(null);
        }}
        className="relative min-h-[280px] flex-1 touch-none select-none overflow-hidden bg-[var(--bg-canvas)] cursor-grab active:cursor-grabbing sm:min-h-[420px]"
      >
        {/* Vector Radar Rings & Blip Markers */}
        <svg
          viewBox={`${viewBox.x} ${viewBox.y} ${viewBox.width} ${viewBox.height}`}
          className="h-full w-full"
          style={{
            transform: `translate3d(${pan.x}px, ${pan.y}px, 0) scale(${zoom})`,
            transformOrigin: 'center center',
          }}
          aria-label={`Interactive radar chart: ${doc.title}`}
        >
          <circle
            cx={0}
            cy={0}
            r={RADAR_OUTER_RADIUS}
            fill="#071a52"
            fillOpacity={0.28}
          />

          {/* Concentric Step Rings (outer -> inner) */}
          {[...layout.rings].reverse().map((band) => {
            const isStepActive = activeStepIds.has(band.step.id);
            const isDragTarget = draggingBlip?.targetStepId === band.step.id;
            return (
              <circle
                key={band.step.id}
                cx={0}
                cy={0}
                r={band.outerRadius}
                fill={band.step.color}
                fillOpacity={
                  isDragTarget ? 0.16 : isStepActive ? 0.055 : 0.015
                }
                stroke={band.step.color}
                strokeOpacity={isDragTarget ? 0.95 : isStepActive ? 0.48 : 0.16}
                strokeWidth={isDragTarget ? 2.6 : 1.4}
              />
            );
          })}

          {/* Subtle intermediate dashed ring ticks */}
          {layout.rings.map((band) => {
            const midR = (band.innerRadius + band.outerRadius) / 2;
            return (
              <circle
                key={`mid-${band.step.id}`}
                cx={0}
                cy={0}
                r={midR}
                fill="none"
                stroke={dividerColor}
                strokeOpacity={0.35}
                strokeDasharray="3 6"
                strokeWidth={0.8}
              />
            );
          })}

          {/* Quadrant Dividers */}
          {layout.sectors.length > 1 ? (
            layout.sectors.map((sec) => {
              const x2 = Math.cos(sec.startAngle) * RADAR_OUTER_RADIUS;
              const y2 = Math.sin(sec.startAngle) * RADAR_OUTER_RADIUS;
              return (
                <line
                  key={`div-${sec.index}`}
                  x1={0}
                  y1={0}
                  x2={x2}
                  y2={y2}
                  stroke={dividerColor}
                  strokeWidth={1.6}
                />
              );
            })
          ) : (
            <>
              <line
                x1={-RADAR_OUTER_RADIUS}
                y1={0}
                x2={RADAR_OUTER_RADIUS}
                y2={0}
                stroke={dividerColor}
                strokeDasharray="4 6"
                strokeOpacity={0.55}
                strokeWidth={1}
              />
              <line
                x1={0}
                y1={-RADAR_OUTER_RADIUS}
                x2={0}
                y2={RADAR_OUTER_RADIUS}
                stroke={dividerColor}
                strokeDasharray="4 6"
                strokeOpacity={0.55}
                strokeWidth={1}
              />
            </>
          )}

          {/* Blips */}
          {layout.blips.map((blip) => {
            const stepActive = activeStepIds.has(blip.step.id);
            const quadrantVisible =
              focusedQuadrantIndex === null ||
              layout.sectors.length <= 1 ||
              blip.quadrantIndex === focusedQuadrantIndex;
            if (!quadrantVisible) return null;

            const isMatched =
              matchedItemIds === null || matchedItemIds.has(blip.item.id);
            const isSelected = selectedItemId === blip.item.id;
            const isHovered = hoveredItemId === blip.item.id;
            const isDraggingThis = draggingBlip?.blip.item.id === blip.item.id;

            const bx = isDraggingThis ? draggingBlip.worldX : blip.x;
            const by = isDraggingThis ? draggingBlip.worldY : blip.y;
            const dimmed = !stepActive || !isMatched;
            const radius = (isSelected || isHovered ? 12 : 9.5) * markerScaleFactor;

            return (
              <g
                key={blip.item.id}
                data-radar-blip={blip.item.id}
                transform={`translate(${bx}, ${by})`}
                opacity={dimmed ? 0.18 : 1}
                onPointerEnter={(e) => {
                  if (e.pointerType !== 'touch') onHoverItem(blip.item.id);
                }}
                onPointerLeave={(e) => {
                  if (e.pointerType !== 'touch') onHoverItem(null);
                }}
                onPointerDown={(e) => handleBlipPointerDown(e, blip)}
                onClick={(e) => {
                  e.stopPropagation();
                  onSelectItem(blip);
                }}
                className={dragToRerate && onMoveItem ? 'cursor-grab' : 'cursor-pointer'}
              >
                <circle r={Math.max(15, radius + 6)} fill="transparent" />
                {(isSelected || isHovered) && (
                  <circle
                    r={radius + 4.5 * markerScaleFactor}
                    fill="none"
                    stroke="#a7ff83"
                    strokeWidth={1.8 * markerScaleFactor}
                    strokeOpacity={0.9}
                  />
                )}
                {blip.item.movement === 'new' ? (
                  <rect
                    x={-radius * 0.85}
                    y={-radius * 0.85}
                    width={radius * 1.7}
                    height={radius * 1.7}
                    rx={2.5 * markerScaleFactor}
                    transform="rotate(45)"
                    fill={blip.step.color}
                    stroke={surfaceBg}
                    strokeWidth={1.6 * markerScaleFactor}
                  />
                ) : blip.item.movement === 'up' ? (
                  <polygon
                    points={`0,${-radius * 1.15} ${radius * 1.05},${radius * 0.85} ${-radius * 1.05},${radius * 0.85}`}
                    fill={blip.step.color}
                    stroke={surfaceBg}
                    strokeWidth={1.6 * markerScaleFactor}
                  />
                ) : blip.item.movement === 'down' ? (
                  <polygon
                    points={`0,${radius * 1.15} ${radius * 1.05},${-radius * 0.85} ${-radius * 1.05},${-radius * 0.85}`}
                    fill={blip.step.color}
                    stroke={surfaceBg}
                    strokeWidth={1.6 * markerScaleFactor}
                  />
                ) : (
                  <circle
                    r={radius}
                    fill={blip.step.color}
                    stroke={surfaceBg}
                    strokeWidth={1.6 * markerScaleFactor}
                  />
                )}
                <text
                  y={3 * markerScaleFactor}
                  textAnchor="middle"
                  fill={textOnAccent}
                  fontSize={8.5 * markerScaleFactor}
                  fontWeight={700}
                  className="pointer-events-none select-none"
                >
                  {blip.number}
                </text>
              </g>
            );
          })}
        </svg>

        {/* Screen-space Leader Lines for Nudged Labels */}
        {screenLabels.some((l) => l.nudged) && (
          <svg
            width={stageSize.width}
            height={stageSize.height}
            className="pointer-events-none absolute inset-0"
            aria-hidden="true"
          >
            {screenLabels
              .filter((l) => l.nudged)
              .map((l) => (
                <line
                  key={`leader-${l.itemId}`}
                  x1={l.anchorX}
                  y1={l.anchorY}
                  x2={l.boxX + l.boxWidth / 2}
                  y2={l.boxY + l.boxHeight / 2}
                  stroke={l.color}
                  strokeOpacity={0.55}
                  strokeWidth={1}
                  strokeDasharray="2 2"
                />
              ))}
          </svg>
        )}

        {/* Screen-space HTML Overlay: Guaranteed Readable Text (>= 11px) */}
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          {/* Quadrant Corner Headers (always crisp & clickable) */}
          {layout.sectors.length === 4 && focusedQuadrantIndex === null ? (
            <>
              {(compactStage
                ? [
                    { idx: 0, pos: 'top-2 left-2 text-left' },
                    { idx: 1, pos: 'top-2 right-2 text-right' },
                    { idx: 2, pos: 'bottom-2 left-2 text-left' },
                    { idx: 3, pos: 'bottom-2 right-2 text-right' },
                  ]
                : [
                    { idx: 0, pos: 'top-3 left-3 text-left' },
                    { idx: 1, pos: 'top-3 right-3 text-right' },
                    { idx: 2, pos: 'bottom-3 left-3 text-left' },
                    { idx: 3, pos: 'bottom-3 right-3 text-right' },
                  ]
              ).map(({ idx, pos }) => {
                const sec = layout.sectors[idx];
                if (!sec?.quadrant) return null;
                const count = layout.blips.filter(
                  (b) => b.quadrantIndex === idx && activeStepIds.has(b.step.id),
                ).length;
                return (
                  <button
                    key={sec.quadrant.id}
                    type="button"
                    onClick={() => onFocusQuadrant(idx)}
                    title={`Focus ${sec.quadrant.name}`}
                    className={`pointer-events-auto absolute ${pos} max-w-[44%] rounded-xl bg-[var(--bg-surface)]/92 shadow-sm backdrop-blur-xs transition-colors hover:bg-[var(--bg-hover)] ${
                      compactStage ? 'px-2 py-1' : 'px-3 py-1.5'
                    }`}
                  >
                    <div
                      className={`flex items-center gap-1.5 font-bold text-[var(--text-primary)] ${
                        compactStage ? 'text-[10px]' : 'text-[12px]'
                      }`}
                    >
                      <span className="truncate">{sec.quadrant.name}</span>
                      <span className="rounded bg-[var(--bg-elevated)] px-1.5 py-0.2 text-[10px] font-semibold tabular-nums text-[var(--accent-primary)]">
                        {count}
                      </span>
                    </div>
                    {sec.quadrant.subtitle && (
                      <div className="hidden truncate text-[11px] text-[var(--text-muted)] sm:block">
                        {sec.quadrant.subtitle}
                      </div>
                    )}
                  </button>
                );
              })}
            </>
          ) : focusedQuadrantIndex !== null && layout.sectors[focusedQuadrantIndex]?.quadrant ? (
            <div className="pointer-events-auto absolute top-3 left-3 flex items-center gap-2 rounded-2xl bg-[var(--bg-surface)]/95 px-3 py-1.5 shadow-md backdrop-blur-xs">
              <div>
                <div className="text-xs font-bold text-[var(--accent-primary)]">
                  {layout.sectors[focusedQuadrantIndex].quadrant!.name}
                </div>
                {layout.sectors[focusedQuadrantIndex].quadrant!.subtitle && (
                  <div className="text-[11px] text-[var(--text-muted)]">
                    {layout.sectors[focusedQuadrantIndex].quadrant!.subtitle}
                  </div>
                )}
              </div>
              <button
                type="button"
                onClick={() => onFocusQuadrant(null)}
                className="inline-flex items-center gap-1 rounded-lg bg-[var(--bg-canvas)] px-2 py-0.5 text-[11px] font-medium text-[var(--text-primary)] hover:bg-[var(--bg-hover)]"
              >
                <Maximize2 className="h-3 w-3" />
                <span>Full Radar</span>
              </button>
            </div>
          ) : layout.sectors.length > 1 ? (
            layout.sectors.map((sec) => {
              if (!sec.quadrant) return null;
              const { px, py } = worldToScreen(sec.anchorX, sec.anchorY, proj);
              const clampedX = Math.max(10, Math.min(stageSize.width - 170, px - 60));
              const clampedY = Math.max(10, Math.min(stageSize.height - 44, py - 14));
              return (
                <button
                  key={sec.quadrant.id}
                  type="button"
                  onClick={() => onFocusQuadrant(sec.index)}
                  style={{ left: clampedX, top: clampedY }}
                  className="pointer-events-auto absolute rounded-xl bg-[var(--bg-surface)]/92 px-2.5 py-1 text-[11px] font-bold text-[var(--text-primary)] shadow-sm backdrop-blur-xs hover:bg-[var(--bg-hover)]"
                >
                  {sec.quadrant.name}
                </button>
              );
            })
          ) : null}

          {/* Ring Step Labels */}
          {ringLabelPositions.map(({ band, px, py, visible }) => {
            if (!visible) return null;
            const active = activeStepIds.has(band.step.id);
            return (
              <button
                key={`ring-pill-${band.step.id}`}
                type="button"
                onClick={() => onToggleStepFilter?.(band.step.id)}
                title={band.step.description || band.step.label}
                style={{
                  left: px,
                  top: py,
                  transform: 'translate(-50%, -50%)',
                  color: band.step.color,
                }}
                className={`pointer-events-auto absolute inline-flex items-center gap-1 rounded-full bg-[var(--bg-surface)]/92 px-2.5 py-0.5 text-[10px] font-bold tracking-wider uppercase shadow-sm backdrop-blur-xs transition-opacity ${
                  active ? 'opacity-95' : 'opacity-40'
                }`}
              >
                <span
                  className="h-1.5 w-1.5 rounded-full"
                  style={{ backgroundColor: band.step.color }}
                />
                <span>{band.step.label}</span>
              </button>
            );
          })}

          {/* Screen-Space Item Title Pills (Never Invisible / Never < 11px) */}
          {screenLabels.map((lbl) => {
            const isSelected = selectedItemId === lbl.itemId;
            const isHovered = hoveredItemId === lbl.itemId;
            return (
              <button
                key={`lbl-${lbl.itemId}`}
                type="button"
                data-radar-label={lbl.itemId}
                onPointerEnter={(e) => {
                  if (e.pointerType !== 'touch') onHoverItem(lbl.itemId);
                }}
                onPointerLeave={(e) => {
                  if (e.pointerType !== 'touch') onHoverItem(null);
                }}
                onClick={() => {
                  const found =
                    layout.blips.find((b) => b.item.id === lbl.itemId) ?? null;
                  onSelectItem(found);
                }}
                style={{
                  left: lbl.boxX,
                  top: lbl.boxY,
                  maxWidth: lbl.boxWidth,
                }}
                className={`pointer-events-auto absolute inline-flex h-[22px] items-center gap-1.5 rounded-full px-2.5 text-[11px] leading-none font-medium shadow-sm backdrop-blur-xs transition-colors ${
                  isSelected || isHovered
                    ? 'z-20 bg-[var(--button-primary-bg)] font-bold text-[var(--button-primary-fg)]'
                    : 'z-10 bg-[var(--bg-surface)]/92 text-[var(--text-primary)] hover:bg-[var(--bg-hover)]'
                }`}
              >
                <span
                  className="h-2 w-2 shrink-0 rounded-full"
                  style={{ backgroundColor: lbl.color }}
                />
                <span
                  className={`shrink-0 font-mono text-[10px] ${
                    isSelected || isHovered ? 'opacity-80' : 'text-[var(--text-muted)]'
                  }`}
                >
                  {lbl.blipNumber}
                </span>
                <span className="truncate">{lbl.title}</span>
              </button>
            );
          })}

          {/* Viewport-Clamped Floating Hover Detail Card */}
          {hoveredBlip && hoveredScreenPos && (
            <div
              role="tooltip"
              style={{
                left: hoveredScreenPos.left,
                top: hoveredScreenPos.top,
                width: 248,
              }}
              className="pointer-events-none absolute z-30 rounded-2xl bg-[var(--bg-surface)]/96 p-3.5 text-xs shadow-2xl backdrop-blur-md"
            >
              <div className="flex items-center justify-between gap-2">
                <span
                  className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase"
                  style={{
                    backgroundColor: `${hoveredBlip.step.color}22`,
                    color: hoveredBlip.step.color,
                  }}
                >
                  #{hoveredBlip.number} · {hoveredBlip.step.label}
                </span>
                {hoveredBlip.quadrant && (
                  <span className="truncate text-[10px] text-[var(--text-muted)]">
                    {hoveredBlip.quadrant.name}
                  </span>
                )}
              </div>
              <div className="mt-1.5 text-[13px] font-bold text-[var(--text-primary)]">
                {hoveredBlip.item.title}
              </div>
              {hoveredBlip.item.description && (
                <p className="mt-1 line-clamp-2 text-[11px] leading-snug text-[var(--text-secondary)]">
                  {hoveredBlip.item.description}
                </p>
              )}
              {hoveredBlip.item.tags && hoveredBlip.item.tags.length > 0 && (
                <div className="mt-1.5 flex flex-wrap gap-1">
                  {hoveredBlip.item.tags.slice(0, 4).map((t) => (
                    <span
                      key={t}
                      className="rounded bg-[var(--bg-elevated)] px-1.5 py-0.5 text-[10px] text-[var(--text-muted)]"
                    >
                      #{t}
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Live Drag Re-Rate Status Pill */}
          {draggingBlip && dragTargetStep && (
            <div className="absolute bottom-3 left-1/2 z-30 -translate-x-1/2 rounded-full bg-[var(--bg-surface)]/95 px-3.5 py-1.5 text-xs font-semibold text-[var(--text-primary)] shadow-lg">
              Move <span className="text-[var(--accent-primary)]">{draggingBlip.blip.item.title}</span> →{' '}
              <span style={{ color: dragTargetStep.color }}>{dragTargetStep.label}</span>
              {dragTargetQuad ? ` · ${dragTargetQuad.name}` : ''}
            </div>
          )}

          {exportNotice && (
            <div className="absolute top-3 left-1/2 z-30 -translate-x-1/2 rounded-full bg-[var(--button-primary-bg)] px-3 py-1 text-[11px] font-bold text-[var(--button-primary-fg)] shadow-md">
              {exportNotice}
            </div>
          )}

          {/* Mobile Floating Liquid-Glass Zoom Controls */}
          <div className="liquid-glass pointer-events-auto absolute right-2 bottom-2 z-20 flex items-center gap-0.5 rounded-full p-1 shadow-[var(--pill-shadow)] sm:hidden">
            <button
              type="button"
              onClick={() =>
                setZoom((z) => Math.min(3.5, Number((z + 0.25).toFixed(2))))
              }
              aria-label="Mobile zoom in radar"
              className="flex h-8 w-8 items-center justify-center rounded-full text-[var(--fg-app)] hover:bg-white/10"
            >
              <ZoomIn className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() =>
                setZoom((z) => Math.max(0.65, Number((z - 0.25).toFixed(2))))
              }
              aria-label="Mobile zoom out radar"
              className="flex h-8 w-8 items-center justify-center rounded-full text-[var(--fg-app)] hover:bg-white/10"
            >
              <ZoomOut className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => {
                setZoom(1);
                setPan({ x: 0, y: 0 });
                onFocusQuadrant(null);
              }}
              aria-label="Reset radar zoom"
              className="flex h-8 w-8 items-center justify-center rounded-full text-[var(--fg-app)] hover:bg-white/10"
            >
              <RotateCcw className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Movement Legend Footer */}
      <div className="flex flex-wrap items-center justify-between gap-2 bg-[var(--bg-surface)] px-3 py-1.5 text-[11px] text-[var(--text-muted)] sm:px-3.5 sm:py-2">
        <div className="flex flex-wrap items-center gap-2.5 sm:gap-3">
          <span>● Steady</span>
          <span>◆ New</span>
          <span>▲ Moved In</span>
          <span>▼ Moved Out</span>
        </div>
        <div className="tabular-nums">
          <span>
            {visibleBlips.length}/{layout.blips.length} blips
          </span>
          <span className="hidden sm:inline"> · Click any quadrant to zoom</span>
        </div>
      </div>
    </div>
  );

  if (fullscreen && typeof document !== 'undefined') {
    return createPortal(
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`Fullscreen radar chart: ${doc.title}`}
        data-testid="radar-fullscreen-overlay"
        className="fixed inset-0 z-[60] flex flex-col bg-[var(--bg-canvas)] px-2 pt-[max(0.5rem,env(safe-area-inset-top))] pb-[max(0.5rem,env(safe-area-inset-bottom))] sm:p-3"
      >
        {chartSurface}
      </div>,
      document.body,
    );
  }

  return chartSurface;
}
