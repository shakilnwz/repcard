import { describe, expect, it } from 'vitest';
import {
  computeCanvasBounds,
  computeEdgeGeometry,
  isDecorativeCircle,
  isDividerNode,
  isNodeInViewport,
  parseCanvasDocument,
  resolveCanvasColor,
} from '@/features/renderers/lib/canvasLayout';
const aiRadarJson = JSON.stringify({
  nodes: [
    { id: 'ring-adopt', type: 'text', x: -200, y: -200, width: 400, height: 400, styleAttributes: { shape: 'circle' } },
    { id: 'ring-trial', type: 'text', x: -400, y: -400, width: 800, height: 800, styleAttributes: { shape: 'circle' } },
    { id: 'ring-assess', type: 'text', x: -600, y: -600, width: 1200, height: 1200, styleAttributes: { shape: 'circle' } },
    { id: 'ring-hold', type: 'text', x: -800, y: -800, width: 1600, height: 1600, styleAttributes: { shape: 'circle' } },
    { id: 'divider-vertical', type: 'text', x: -1, y: -800, width: 2, height: 1600, color: '#7f7f7f' },
    { id: 'divider-horizontal', type: 'text', x: -800, y: -1, width: 1600, height: 2, color: '#7f7f7f' },
    {
      id: 'title',
      type: 'text',
      x: -150,
      y: -900,
      width: 300,
      height: 60,
      text: '# AI Radar\nNov 2026',
      styleAttributes: { border: 'invisible', textAlign: 'center' },
    },
    {
      id: 'legend',
      type: 'text',
      x: -780,
      y: 820,
      width: 360,
      height: 60,
      text: 'Roadmap: [[roadmaps/ai-engineer|AI Engineer]]',
    },
    { id: 'quadrant-tl', type: 'text', x: -500, y: -500, width: 200, height: 50, text: 'Techniques', styleAttributes: { border: 'invisible' } },
    { id: 'quadrant-tr', type: 'text', x: 300, y: -500, width: 200, height: 50, text: 'Patterns', styleAttributes: { border: 'invisible' } },
    { id: 'quadrant-bl', type: 'text', x: -500, y: 450, width: 200, height: 50, text: 'Models', styleAttributes: { border: 'invisible' } },
    { id: 'quadrant-br', type: 'text', x: 300, y: 450, width: 200, height: 50, text: 'Operations', styleAttributes: { border: 'invisible' } },
    ...Array.from({ length: 12 }, (_, i) => ({
      id: `blip-${i}`,
      type: 'text',
      x: -100 + (i % 4) * 60,
      y: -100 + Math.floor(i / 4) * 60,
      width: 100,
      height: 40,
      text: `Concept ${i + 1}`,
    })),
  ],
  edges: [],
});

const aiEngineerCanvasJson = JSON.stringify({
  nodes: Array.from({ length: 236 }, (_, i) => ({
    id: `ai-node-${i}`,
    type: 'text',
    x: (i % 3) * 320,
    y: i * 80,
    width: 240,
    height: 60,
    text: `Topic ${i + 1}`,
  })),
  edges: Array.from({ length: 58 }, (_, i) => ({
    id: `ai-edge-${i}`,
    fromNode: `ai-node-${i}`,
    fromSide: 'bottom',
    toNode: `ai-node-${i + 1}`,
    toSide: 'top',
    toEnd: 'arrow',
  })),
});

const pythonCanvasJson = JSON.stringify({
  nodes: [
    {
      id: 'mermaid_python',
      type: 'text',
      x: 0,
      y: 0,
      width: 360,
      height: 200,
      text: '```mermaid\nflowchart TD\n  Syntax --> Types --> Async\n```',
    },
    ...Array.from({ length: 100 }, (_, i) => ({
      id: `py-node-${i}`,
      type: 'text',
      x: (i % 5) * 260,
      y: 260 + Math.floor(i / 5) * 100,
      width: 200,
      height: 60,
      text: `Python ${i + 1}`,
    })),
  ],
  edges: [],
});

describe('canvasLayout real-vault fixtures', () => {
  it('parses AI Radar.canvas concentric circles, hex dividers, pills, and invisible borders in exact z-order', () => {
    const doc = parseCanvasDocument(aiRadarJson);
    expect(doc.nodes.length).toBeGreaterThan(20);

    const holdRing = doc.nodes.find((n) => n.id === 'ring-hold');
    expect(holdRing?.styleAttributes?.shape).toBe('circle');
    expect(holdRing && isDecorativeCircle(holdRing)).toBe(true);

    const vDivider = doc.nodes.find((n) => n.id === 'divider-vertical');
    expect(vDivider && isDividerNode(vDivider)).toBe(true);
    expect(resolveCanvasColor(vDivider?.color, 'dark').stroke).toBe('#7f7f7f');

    const legend = doc.nodes.find((n) => n.id === 'legend');
    expect(legend?.text).toContain('[[roadmaps/ai-engineer|AI Engineer]]');

    const titleNode = doc.nodes.find((n) => n.id === 'title');
    expect(titleNode?.styleAttributes?.border).toBe('invisible');
    expect(titleNode?.styleAttributes?.textAlign).toBe('center');
  });

  it('handles 236-node ai_enginnering/ai-engineer.canvas edges and viewport culling cleanly', () => {
    const doc = parseCanvasDocument(aiEngineerCanvasJson);
    expect(doc.nodes.length).toBe(236);
    expect(doc.edges.length).toBe(58);

    const nodeMap = new Map(doc.nodes.map((n) => [n.id, n]));
    for (const edge of doc.edges) {
      const from = nodeMap.get(edge.fromNode);
      const to = nodeMap.get(edge.toNode);
      expect(from).toBeDefined();
      expect(to).toBeDefined();
      const geom = computeEdgeGeometry(edge, from!, to!);
      expect(geom.pathD.startsWith('M ')).toBe(true);
    }

    const bounds = computeCanvasBounds(doc.nodes);
    expect(bounds.height).toBeGreaterThan(10000);

    const visibleInTopViewport = doc.nodes.filter((n) =>
      isNodeInViewport(n, { minX: 0, minY: 0, maxX: 1600, maxY: 900 }),
    );
    expect(visibleInTopViewport.length).toBeGreaterThan(0);
    expect(visibleInTopViewport.length).toBeLessThan(doc.nodes.length);
  });

  it('parses roadmaps/python.canvas with embedded Mermaid node and edges', () => {
    const doc = parseCanvasDocument(pythonCanvasJson);
    expect(doc.nodes.length).toBe(101);
    const mermaidCard = doc.nodes.find((n) => n.id === 'mermaid_python');
    expect(mermaidCard?.text).toContain('```mermaid');
  });
});
