import type {
  RadarDocument,
  RadarItem,
  RadarLabelMode,
  RadarQuadrant,
  RadarStep,
} from '@/types/radar';

export const RADAR_OUTER_RADIUS = 400;
export const RADAR_VIEW_PADDING = 68;

export interface RingBand {
  step: RadarStep;
  index: number;
  innerRadius: number;
  outerRadius: number;
}

export interface QuadrantSector {
  quadrant: RadarQuadrant | null;
  index: number;
  startAngle: number;
  endAngle: number;
  midAngle: number;
  anchorX: number;
  anchorY: number;
  align: 'left' | 'right' | 'center';
  vAlign: 'top' | 'bottom';
}

export interface PlacedBlip {
  number: number;
  item: RadarItem;
  step: RadarStep;
  stepIndex: number;
  quadrant: RadarQuadrant | null;
  quadrantIndex: number;
  x: number;
  y: number;
  radius: number;
  angle: number;
}

export interface RadarLayout {
  rings: RingBand[];
  sectors: QuadrantSector[];
  blips: PlacedBlip[];
  outerRadius: number;
}

export interface RadarViewBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface PlacedScreenLabel {
  blipNumber: number;
  itemId: string;
  title: string;
  color: string;
  anchorX: number;
  anchorY: number;
  boxX: number;
  boxY: number;
  boxWidth: number;
  boxHeight: number;
  nudged: boolean;
}

function hashString(str: string): number {
  let h = 2166136261;
  for (let i = 0; i < str.length; i += 1) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function clamp(val: number, min: number, max: number): number {
  if (min > max) return (min + max) / 2;
  return Math.max(min, Math.min(max, val));
}

export function normalizeAngle(rad: number): number {
  const twoPi = Math.PI * 2;
  return ((rad % twoPi) + twoPi) % twoPi;
}

export function computeRingBands(steps: RadarStep[]): RingBand[] {
  const n = Math.max(1, steps.length);
  const bands: RingBand[] = [];
  let prev = 0;

  for (let i = 0; i < n; i += 1) {
    let outer = RADAR_OUTER_RADIUS * Math.pow((i + 1) / n, 0.78);
    if (i === 0 && n <= 5) {
      outer = Math.max(outer, 138);
    }
    if (i === n - 1) {
      outer = RADAR_OUTER_RADIUS;
    } else {
      outer = Math.max(outer, prev + 48);
      const remainingSteps = n - 1 - i;
      outer = Math.min(outer, RADAR_OUTER_RADIUS - remainingSteps * 46);
    }

    bands.push({
      step: steps[i],
      index: i,
      innerRadius: prev,
      outerRadius: outer,
    });
    prev = outer;
  }

  return bands;
}

export function computeQuadrantSectors(
  quadrants: RadarQuadrant[],
): QuadrantSector[] {
  if (quadrants.length === 0) {
    return [
      {
        quadrant: null,
        index: 0,
        startAngle: 0,
        endAngle: Math.PI * 2,
        midAngle: Math.PI * 1.25,
        anchorX: -RADAR_OUTER_RADIUS - 16,
        anchorY: -RADAR_OUTER_RADIUS - 16,
        align: 'left',
        vAlign: 'top',
      },
    ];
  }

  if (quadrants.length === 4) {
    // SVG +Y is down: match AI Radar.canvas TL, TR, BL, BR corner ordering
    return [
      {
        quadrant: quadrants[0],
        index: 0,
        startAngle: Math.PI,
        endAngle: Math.PI * 1.5,
        midAngle: Math.PI * 1.25,
        anchorX: -RADAR_OUTER_RADIUS - 18,
        anchorY: -RADAR_OUTER_RADIUS - 14,
        align: 'left',
        vAlign: 'top',
      },
      {
        quadrant: quadrants[1],
        index: 1,
        startAngle: Math.PI * 1.5,
        endAngle: Math.PI * 2,
        midAngle: Math.PI * 1.75,
        anchorX: RADAR_OUTER_RADIUS + 18,
        anchorY: -RADAR_OUTER_RADIUS - 14,
        align: 'right',
        vAlign: 'top',
      },
      {
        quadrant: quadrants[2],
        index: 2,
        startAngle: Math.PI * 0.5,
        endAngle: Math.PI,
        midAngle: Math.PI * 0.75,
        anchorX: -RADAR_OUTER_RADIUS - 18,
        anchorY: RADAR_OUTER_RADIUS + 14,
        align: 'left',
        vAlign: 'bottom',
      },
      {
        quadrant: quadrants[3],
        index: 3,
        startAngle: 0,
        endAngle: Math.PI * 0.5,
        midAngle: Math.PI * 0.25,
        anchorX: RADAR_OUTER_RADIUS + 18,
        anchorY: RADAR_OUTER_RADIUS + 14,
        align: 'right',
        vAlign: 'bottom',
      },
    ];
  }

  const count = quadrants.length;
  const span = (Math.PI * 2) / count;
  return quadrants.map((q, idx) => {
    const startAngle = -Math.PI / 2 + idx * span;
    const endAngle = startAngle + span;
    const midAngle = (startAngle + endAngle) / 2;
    const anchorR = RADAR_OUTER_RADIUS + 26;
    const ax = Math.cos(midAngle) * anchorR;
    const ay = Math.sin(midAngle) * anchorR;
    return {
      quadrant: q,
      index: idx,
      startAngle,
      endAngle,
      midAngle,
      anchorX: ax,
      anchorY: ay,
      align: ax < -40 ? 'left' : ax > 40 ? 'right' : 'center',
      vAlign: ay < 0 ? 'top' : 'bottom',
    };
  });
}

export function computeRadarLayout(doc: RadarDocument): RadarLayout {
  const rings = computeRingBands(doc.steps);
  const sectors = computeQuadrantSectors(doc.quadrants);

  const quadrantIndexMap = new Map<string, number>();
  sectors.forEach((s, idx) => {
    if (s.quadrant) {
      quadrantIndexMap.set(s.quadrant.id, idx);
    }
  });

  // Collect and number blips deterministically: quadrant -> step -> title
  interface PendingEntry {
    item: RadarItem;
    step: RadarStep;
    stepIndex: number;
    quadrant: RadarQuadrant | null;
    quadrantIndex: number;
  }

  const entries: PendingEntry[] = [];
  for (let sIdx = 0; sIdx < doc.steps.length; sIdx += 1) {
    const step = doc.steps[sIdx];
    const list = doc.items[step.id] ?? [];
    for (const item of list) {
      const qIdx =
        sectors.length > 1 && item.quadrant && quadrantIndexMap.has(item.quadrant)
          ? (quadrantIndexMap.get(item.quadrant) ?? 0)
          : 0;
      entries.push({
        item,
        step,
        stepIndex: sIdx,
        quadrant: sectors[qIdx]?.quadrant ?? null,
        quadrantIndex: qIdx,
      });
    }
  }

  entries.sort((a, b) => {
    if (a.quadrantIndex !== b.quadrantIndex) return a.quadrantIndex - b.quadrantIndex;
    if (a.stepIndex !== b.stepIndex) return a.stepIndex - b.stepIndex;
    return a.item.title.localeCompare(b.item.title);
  });

  const cellMap = new Map<string, Array<{ entry: PendingEntry; number: number }>>();
  entries.forEach((entry, idx) => {
    const key = `${entry.stepIndex}:${entry.quadrantIndex}`;
    const arr = cellMap.get(key) ?? [];
    arr.push({ entry, number: idx + 1 });
    cellMap.set(key, arr);
  });

  const blips: PlacedBlip[] = [];

  for (const group of cellMap.values()) {
    const { stepIndex, quadrantIndex } = group[0].entry;
    const ring = rings[stepIndex];
    const sector = sectors[quadrantIndex];

    const rMin = Math.max(24, ring.innerRadius + 18);
    const rMax = Math.max(rMin + 4, ring.outerRadius - 18);
    const midR = (rMin + rMax) / 2;

    const fullCircle = sectors.length === 1 && sector.quadrant === null;
    const angularPad = fullCircle
      ? 0
      : Math.min(0.24, Math.asin(Math.min(0.42, 22 / Math.max(36, midR))));
    const aMin = sector.startAngle + angularPad;
    const aMax = Math.max(aMin + 0.08, sector.endAngle - angularPad);

    const k = group.length;
    const tracks = k <= 3 ? 1 : k <= 8 ? 2 : 3;

    const cellBlips: Array<PlacedBlip & { rMin: number; rMax: number; aMin: number; aMax: number }> =
      group.map(({ entry, number }, idx) => {
        const track = idx % tracks;
        const posInTrack = Math.floor(idx / tracks);
        const countInTrack = Math.ceil((k - track) / tracks);

        const h = hashString(`${entry.item.id}:${entry.item.title}`);
        const rJitter = ((h % 100) / 100 - 0.5) * 8;
        const aJitter = (((h >> 8) % 100) / 100 - 0.5) * 0.04;

        const rFrac = tracks === 1 ? 0.5 : (track + 0.5) / tracks;
        const r = clamp(rMin + (rMax - rMin) * rFrac + rJitter, rMin, rMax);

        const aFrac =
          countInTrack <= 1 ? 0.5 : (posInTrack + 0.5) / countInTrack;
        const angle = fullCircle
          ? sector.startAngle + ((idx + 0.5) / k) * (Math.PI * 2)
          : clamp(aMin + (aMax - aMin) * aFrac + aJitter, aMin, aMax);

        return {
          number,
          item: entry.item,
          step: entry.step,
          stepIndex,
          quadrant: entry.quadrant,
          quadrantIndex,
          radius: r,
          angle,
          x: Math.cos(angle) * r,
          y: Math.sin(angle) * r,
          rMin,
          rMax,
          aMin,
          aMax,
        };
      });

    // Collision relaxation within this ring/sector cell
    const minDist = 28;
    for (let iter = 0; iter < 40; iter += 1) {
      let moved = false;
      for (let i = 0; i < cellBlips.length; i += 1) {
        for (let j = i + 1; j < cellBlips.length; j += 1) {
          const a = cellBlips[i];
          const b = cellBlips[j];
          const dx = b.x - a.x;
          const dy = b.y - a.y;
          const d = Math.hypot(dx, dy);
          if (d < minDist) {
            moved = true;
            const push = (minDist - Math.max(0.1, d)) * 0.45;
            const ux = d > 0.01 ? dx / d : Math.cos(a.angle + 0.4);
            const uy = d > 0.01 ? dy / d : Math.sin(a.angle + 0.4);

            for (const [node, sign] of [
              [a, -1],
              [b, 1],
            ] as const) {
              const nx = node.x + ux * push * sign;
              const ny = node.y + uy * push * sign;
              const nr = clamp(Math.hypot(nx, ny), node.rMin, node.rMax);
              let na = Math.atan2(ny, nx);
              if (!fullCircle) {
                // Unwrap na relative to sector center so clamping works across 0/2π boundary
                const mid = (node.aMin + node.aMax) / 2;
                while (na - mid > Math.PI) na -= Math.PI * 2;
                while (na - mid < -Math.PI) na += Math.PI * 2;
                na = clamp(na, node.aMin, node.aMax);
              }
              node.radius = nr;
              node.angle = na;
              node.x = Math.cos(na) * nr;
              node.y = Math.sin(na) * nr;
            }
          }
        }
      }
      if (!moved) break;
    }

    for (const cb of cellBlips) {
      blips.push({
        number: cb.number,
        item: cb.item,
        step: cb.step,
        stepIndex: cb.stepIndex,
        quadrant: cb.quadrant,
        quadrantIndex: cb.quadrantIndex,
        x: cb.x,
        y: cb.y,
        radius: cb.radius,
        angle: cb.angle,
      });
    }
  }

  blips.sort((a, b) => a.number - b.number);

  return {
    rings,
    sectors,
    blips,
    outerRadius: RADAR_OUTER_RADIUS,
  };
}

export function getFocusViewBox(
  focusedQuadrantIndex: number | null,
  sectors: QuadrantSector[],
): RadarViewBox {
  const fullSize = (RADAR_OUTER_RADIUS + RADAR_VIEW_PADDING) * 2;
  if (
    focusedQuadrantIndex === null ||
    focusedQuadrantIndex < 0 ||
    focusedQuadrantIndex >= sectors.length ||
    (sectors.length === 1 && sectors[0].quadrant === null)
  ) {
    return {
      x: -(RADAR_OUTER_RADIUS + RADAR_VIEW_PADDING),
      y: -(RADAR_OUTER_RADIUS + RADAR_VIEW_PADDING),
      width: fullSize,
      height: fullSize,
    };
  }

  const sector = sectors[focusedQuadrantIndex];
  const samples = [0, 0.25, 0.5, 0.75, 1];
  let minX = 0;
  let maxX = 0;
  let minY = 0;
  let maxY = 0;

  for (const t of samples) {
    const a = sector.startAngle + (sector.endAngle - sector.startAngle) * t;
    const x = Math.cos(a) * RADAR_OUTER_RADIUS;
    const y = Math.sin(a) * RADAR_OUTER_RADIUS;
    minX = Math.min(minX, x);
    maxX = Math.max(maxX, x);
    minY = Math.min(minY, y);
    maxY = Math.max(maxY, y);
  }

  const pad = 54;
  const w = maxX - minX + pad * 2;
  const h = maxY - minY + pad * 2;
  const side = Math.max(w, h);
  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;

  return {
    x: cx - side / 2,
    y: cy - side / 2,
    width: side,
    height: side,
  };
}

export function pointToStepAndQuadrant(
  x: number,
  y: number,
  layout: RadarLayout,
): { stepId: string; quadrantId?: string } {
  const r = Math.hypot(x, y);
  let targetRing = layout.rings[layout.rings.length - 1];
  for (const band of layout.rings) {
    if (r <= band.outerRadius) {
      targetRing = band;
      break;
    }
  }

  if (layout.sectors.length === 1 && layout.sectors[0].quadrant === null) {
    return { stepId: targetRing.step.id };
  }

  const angle = normalizeAngle(Math.atan2(y, x));
  let matchedSector = layout.sectors[0];
  for (const sec of layout.sectors) {
    const start = normalizeAngle(sec.startAngle);
    const end = normalizeAngle(sec.endAngle);
    const inArc =
      start < end
        ? angle >= start && angle <= end
        : angle >= start || angle <= end;
    if (inArc) {
      matchedSector = sec;
      break;
    }
  }

  return {
    stepId: targetRing.step.id,
    quadrantId: matchedSector?.quadrant?.id,
  };
}

export interface ScreenProjection {
  scale: number;
  offsetX: number;
  offsetY: number;
}

/**
 * Matches SVG `preserveAspectRatio="xMidYMid meet"` mapping from viewBox coordinates
 * into container CSS pixels, including user pan/zoom around the container center.
 */
export function computeScreenProjection(
  viewBox: RadarViewBox,
  containerWidth: number,
  containerHeight: number,
  zoom = 1,
  panX = 0,
  panY = 0,
): ScreenProjection {
  const baseScale = Math.min(
    containerWidth / viewBox.width,
    containerHeight / viewBox.height,
  );
  const effectiveScale = baseScale * zoom;
  const vbCenterX = viewBox.x + viewBox.width / 2;
  const vbCenterY = viewBox.y + viewBox.height / 2;
  return {
    scale: effectiveScale,
    offsetX: containerWidth / 2 - vbCenterX * effectiveScale + panX,
    offsetY: containerHeight / 2 - vbCenterY * effectiveScale + panY,
  };
}

export function worldToScreen(
  wx: number,
  wy: number,
  proj: ScreenProjection,
): { px: number; py: number } {
  return {
    px: wx * proj.scale + proj.offsetX,
    py: wy * proj.scale + proj.offsetY,
  };
}

export function screenToWorld(
  px: number,
  py: number,
  proj: ScreenProjection,
): { x: number; y: number } {
  return {
    x: (px - proj.offsetX) / proj.scale,
    y: (py - proj.offsetY) / proj.scale,
  };
}

interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

function overlaps(a: Rect, b: Rect, pad = 4): boolean {
  return !(
    a.x + a.w + pad <= b.x ||
    b.x + b.w + pad <= a.x ||
    a.y + a.h + pad <= b.y ||
    b.y + b.h + pad <= a.y
  );
}

export function solveScreenSpaceLabels(params: {
  blips: PlacedBlip[];
  viewBox: RadarViewBox;
  containerWidth: number;
  containerHeight: number;
  zoom: number;
  panX: number;
  panY: number;
  labelMode: RadarLabelMode;
  prioritizedIds: Set<string>;
}): PlacedScreenLabel[] {
  const {
    blips,
    viewBox,
    containerWidth,
    containerHeight,
    zoom,
    panX,
    panY,
    labelMode,
    prioritizedIds,
  } = params;

  if (containerWidth <= 0 || containerHeight <= 0 || blips.length === 0) {
    return [];
  }

  const proj = computeScreenProjection(
    viewBox,
    containerWidth,
    containerHeight,
    zoom,
    panX,
    panY,
  );

  // Order so hovered / selected / search-matched blips get placed first
  const ordered = [...blips].sort((a, b) => {
    const ap = prioritizedIds.has(a.item.id) ? 0 : 1;
    const bp = prioritizedIds.has(b.item.id) ? 0 : 1;
    if (ap !== bp) return ap - bp;
    return a.number - b.number;
  });

  const placedRects: Rect[] = [];
  const results: PlacedScreenLabel[] = [];
  const margin = 8;

  for (const blip of ordered) {
    const isPriority = prioritizedIds.has(blip.item.id);
    if (labelMode === 'numbers' && !isPriority) {
      continue;
    }

    const { px, py } = worldToScreen(blip.x, blip.y, proj);
    if (
      px < -20 ||
      px > containerWidth + 20 ||
      py < -20 ||
      py > containerHeight + 20
    ) {
      continue;
    }

    const displayTitle =
      blip.item.title.length > 30
        ? `${blip.item.title.slice(0, 28)}…`
        : blip.item.title;
    const boxWidth = clamp(Math.round(displayTitle.length * 7.2 + 64), 92, 236);
    const boxHeight = 22;

    const candidates: Array<{ x: number; y: number; nudged: boolean }> = [
      { x: px + 14, y: py - boxHeight / 2, nudged: false },
      { x: px - boxWidth - 14, y: py - boxHeight / 2, nudged: false },
      { x: px - boxWidth / 2, y: py - boxHeight - 14, nudged: false },
      { x: px - boxWidth / 2, y: py + 14, nudged: false },
      { x: px + 16, y: py - boxHeight - 12, nudged: true },
      { x: px - boxWidth - 16, y: py - boxHeight - 12, nudged: true },
      { x: px + 16, y: py + 12, nudged: true },
      { x: px - boxWidth - 16, y: py + 12, nudged: true },
    ];

    let chosen: Rect | null = null;
    let nudged = false;

    for (const c of candidates) {
      const rect: Rect = {
        x: clamp(c.x, margin, containerWidth - boxWidth - margin),
        y: clamp(c.y, margin, containerHeight - boxHeight - margin),
        w: boxWidth,
        h: boxHeight,
      };
      if (!placedRects.some((r) => overlaps(r, rect))) {
        chosen = rect;
        nudged = c.nudged;
        break;
      }
    }

    if (!chosen && labelMode === 'labels') {
      // Spiral search outward so every label stays legible in 'labels' mode
      for (let step = 1; step <= 10 && !chosen; step += 1) {
        const dist = 28 + step * 18;
        for (let a = 0; a < 8; a += 1) {
          const theta = (a * Math.PI) / 4;
          const rect: Rect = {
            x: clamp(
              px + Math.cos(theta) * dist - boxWidth / 2,
              margin,
              containerWidth - boxWidth - margin,
            ),
            y: clamp(
              py + Math.sin(theta) * dist - boxHeight / 2,
              margin,
              containerHeight - boxHeight - margin,
            ),
            w: boxWidth,
            h: boxHeight,
          };
          if (!placedRects.some((r) => overlaps(r, rect, 2))) {
            chosen = rect;
            nudged = true;
            break;
          }
        }
      }
      if (!chosen) {
        chosen = {
          x: clamp(px + 12, margin, containerWidth - boxWidth - margin),
          y: clamp(py - boxHeight / 2, margin, containerHeight - boxHeight - margin),
          w: boxWidth,
          h: boxHeight,
        };
        nudged = true;
      }
    }

    if (!chosen && isPriority) {
      chosen = {
        x: clamp(px + 14, margin, containerWidth - boxWidth - margin),
        y: clamp(py - boxHeight / 2, margin, containerHeight - boxHeight - margin),
        w: boxWidth,
        h: boxHeight,
      };
    }

    if (chosen) {
      placedRects.push(chosen);
      results.push({
        blipNumber: blip.number,
        itemId: blip.item.id,
        title: displayTitle,
        color: blip.step.color,
        anchorX: px,
        anchorY: py,
        boxX: chosen.x,
        boxY: chosen.y,
        boxWidth: chosen.w,
        boxHeight: chosen.h,
        nudged,
      });
    }
  }

  return results;
}
