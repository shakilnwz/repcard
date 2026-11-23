export type CanvasSide = 'top' | 'right' | 'bottom' | 'left';
export type CanvasEdgeEnd = 'none' | 'arrow';

export interface CanvasStyleAttributes {
  shape?: 'circle' | 'pill' | string;
  border?: 'invisible' | string;
  textAlign?: 'left' | 'center' | 'right';
}

export interface CanvasNode {
  id: string;
  type: 'text' | 'group' | 'file' | 'link';
  x: number;
  y: number;
  width: number;
  height: number;
  text?: string;
  label?: string;
  file?: string;
  subpath?: string;
  url?: string;
  color?: string;
  background?: string;
  styleAttributes?: CanvasStyleAttributes;
}

export interface CanvasEdge {
  id: string;
  fromNode: string;
  fromSide?: CanvasSide;
  fromEnd?: CanvasEdgeEnd;
  toNode: string;
  toSide?: CanvasSide;
  toEnd?: CanvasEdgeEnd;
  toFloating?: boolean;
  color?: string;
  label?: string;
}

export interface CanvasDocument {
  nodes: CanvasNode[];
  edges: CanvasEdge[];
}

export interface CanvasBounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  width: number;
  height: number;
}

export interface ResolvedCanvasColors {
  stroke: string;
  fill: string;
  text: string;
}

const PRESET_COLORS_DARK: Record<string, ResolvedCanvasColors> = {
  '1': { stroke: '#ef4444', fill: 'rgba(239, 68, 68, 0.14)', text: '#fecaca' },
  '2': { stroke: '#f97316', fill: 'rgba(249, 115, 22, 0.14)', text: '#fed7aa' },
  '3': { stroke: '#eab308', fill: 'rgba(234, 179, 8, 0.14)', text: '#fef08a' },
  '4': { stroke: '#22c55e', fill: 'rgba(34, 197, 94, 0.14)', text: '#bbf7d0' },
  '5': { stroke: '#06b6d4', fill: 'rgba(6, 182, 212, 0.14)', text: '#a5f3fc' },
  '6': { stroke: '#a855f7', fill: 'rgba(168, 85, 247, 0.14)', text: '#e9d5ff' },
};

const PRESET_COLORS_LIGHT: Record<string, ResolvedCanvasColors> = {
  '1': { stroke: '#dc2626', fill: 'rgba(220, 38, 38, 0.08)', text: '#7f1d1d' },
  '2': { stroke: '#ea580c', fill: 'rgba(234, 88, 12, 0.08)', text: '#7c2d12' },
  '3': { stroke: '#ca8a04', fill: 'rgba(202, 138, 4, 0.1)', text: '#713f12' },
  '4': { stroke: '#16a34a', fill: 'rgba(22, 163, 74, 0.08)', text: '#14532d' },
  '5': { stroke: '#0284c7', fill: 'rgba(2, 132, 199, 0.08)', text: '#0c4a6e' },
  '6': { stroke: '#7c3aed', fill: 'rgba(124, 58, 237, 0.08)', text: '#4c1d95' },
};

export function resolveCanvasColor(
  color: string | undefined,
  theme: 'dark' | 'light',
): ResolvedCanvasColors {
  const presets = theme === 'dark' ? PRESET_COLORS_DARK : PRESET_COLORS_LIGHT;
  if (color && presets[color]) {
    return presets[color];
  }

  if (color && /^#[0-9a-f]{3,8}$/i.test(color.trim())) {
    const hex = color.trim();
    return {
      stroke: hex,
      fill: theme === 'dark' ? `${hex}22` : `${hex}14`,
      text: theme === 'dark' ? '#ffffff' : '#071a52',
    };
  }

  return theme === 'dark'
    ? { stroke: '#071a52', fill: 'rgba(7, 26, 82, 0.94)', text: '#ffffff' }
    : { stroke: '#75b35c', fill: 'rgba(255, 255, 255, 0.96)', text: '#071a52' };
}

export function resolveEdgeStroke(
  color: string | undefined,
  theme: 'dark' | 'light',
): string {
  if (!color) {
    return theme === 'dark' ? '#75b35c' : '#071a52';
  }
  return resolveCanvasColor(color, theme).stroke;
}

export function parseCanvasDocument(rawJson: string): CanvasDocument {
  const parsed = JSON.parse(rawJson) as {
    nodes?: unknown;
    edges?: unknown;
  };
  const nodes = Array.isArray(parsed?.nodes)
    ? (parsed.nodes as CanvasNode[]).filter(
        (n) =>
          n &&
          typeof n.id === 'string' &&
          typeof n.x === 'number' &&
          typeof n.y === 'number' &&
          typeof n.width === 'number' &&
          typeof n.height === 'number',
      )
    : [];
  const edges = Array.isArray(parsed?.edges)
    ? (parsed.edges as CanvasEdge[]).filter(
        (e) =>
          e &&
          typeof e.id === 'string' &&
          typeof e.fromNode === 'string' &&
          typeof e.toNode === 'string',
      )
    : [];
  return { nodes, edges };
}

export function computeCanvasBounds(nodes: readonly CanvasNode[]): CanvasBounds {
  if (nodes.length === 0) {
    return { minX: 0, minY: 0, maxX: 800, maxY: 600, width: 800, height: 600 };
  }

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const node of nodes) {
    if (node.x < minX) minX = node.x;
    if (node.y < minY) minY = node.y;
    if (node.x + node.width > maxX) maxX = node.x + node.width;
    if (node.y + node.height > maxY) maxY = node.y + node.height;
  }

  return {
    minX,
    minY,
    maxX,
    maxY,
    width: Math.max(1, maxX - minX),
    height: Math.max(1, maxY - minY),
  };
}

export function isDividerNode(node: CanvasNode): boolean {
  return (
    node.type === 'text' &&
    !(node.text ?? '').trim() &&
    (node.width <= 12 || node.height <= 12)
  );
}

export function isDecorativeCircle(node: CanvasNode): boolean {
  return (
    node.styleAttributes?.shape === 'circle' &&
    !(node.text ?? '').trim()
  );
}

export function isNodeInViewport(
  node: CanvasNode,
  viewRect: { minX: number; minY: number; maxX: number; maxY: number },
): boolean {
  return !(
    node.x + node.width < viewRect.minX ||
    node.x > viewRect.maxX ||
    node.y + node.height < viewRect.minY ||
    node.y > viewRect.maxY
  );
}

function getAnchorPoint(
  node: CanvasNode,
  side: CanvasSide,
): { x: number; y: number } {
  switch (side) {
    case 'top':
      return { x: node.x + node.width / 2, y: node.y };
    case 'bottom':
      return { x: node.x + node.width / 2, y: node.y + node.height };
    case 'left':
      return { x: node.x, y: node.y + node.height / 2 };
    case 'right':
      return { x: node.x + node.width, y: node.y + node.height / 2 };
  }
}

function oppositeSide(side: CanvasSide): CanvasSide {
  switch (side) {
    case 'top':
      return 'bottom';
    case 'bottom':
      return 'top';
    case 'left':
      return 'right';
    case 'right':
      return 'left';
  }
}

function inferClosestSides(
  from: CanvasNode,
  to: CanvasNode,
): { fromSide: CanvasSide; toSide: CanvasSide } {
  const fromCx = from.x + from.width / 2;
  const fromCy = from.y + from.height / 2;
  const toCx = to.x + to.width / 2;
  const toCy = to.y + to.height / 2;
  const dx = toCx - fromCx;
  const dy = toCy - fromCy;

  if (Math.abs(dx) >= Math.abs(dy)) {
    return dx >= 0
      ? { fromSide: 'right', toSide: 'left' }
      : { fromSide: 'left', toSide: 'right' };
  }
  return dy >= 0
    ? { fromSide: 'bottom', toSide: 'top' }
    : { fromSide: 'top', toSide: 'bottom' };
}

function controlOffset(
  point: { x: number; y: number },
  side: CanvasSide,
  offset: number,
): { x: number; y: number } {
  switch (side) {
    case 'top':
      return { x: point.x, y: point.y - offset };
    case 'bottom':
      return { x: point.x, y: point.y + offset };
    case 'left':
      return { x: point.x - offset, y: point.y };
    case 'right':
      return { x: point.x + offset, y: point.y };
  }
}

export interface EdgeGeometry {
  pathD: string;
  start: { x: number; y: number };
  end: { x: number; y: number };
  mid: { x: number; y: number };
  hasFromArrow: boolean;
  hasToArrow: boolean;
}

export function computeEdgeGeometry(
  edge: CanvasEdge,
  fromNode: CanvasNode,
  toNode: CanvasNode,
): EdgeGeometry {
  const inferred = inferClosestSides(fromNode, toNode);
  const fromSide: CanvasSide = edge.fromSide ?? inferred.fromSide;
  const toSide: CanvasSide = edge.toFloating
    ? oppositeSide(fromSide)
    : (edge.toSide ?? inferred.toSide);

  const start = getAnchorPoint(fromNode, fromSide);
  const end = getAnchorPoint(toNode, toSide);
  const dist = Math.hypot(end.x - start.x, end.y - start.y);
  const handle = Math.max(40, Math.min(200, dist * 0.42));

  const cp1 = controlOffset(start, fromSide, handle);
  const cp2 = controlOffset(end, toSide, handle);

  // Cubic Bezier midpoint at t = 0.5
  const midX = 0.125 * (start.x + 3 * cp1.x + 3 * cp2.x + end.x);
  const midY = 0.125 * (start.y + 3 * cp1.y + 3 * cp2.y + end.y);

  return {
    pathD: `M ${start.x} ${start.y} C ${cp1.x} ${cp1.y}, ${cp2.x} ${cp2.y}, ${end.x} ${end.y}`,
    start,
    end,
    mid: { x: midX, y: midY },
    hasFromArrow: edge.fromEnd === 'arrow',
    hasToArrow: edge.toEnd !== 'none',
  };
}
