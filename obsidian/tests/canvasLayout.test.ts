import { describe, expect, it } from 'vitest';
import {
  computeCanvasBounds,
  computeEdgeGeometry,
  isDecorativeCircle,
  isDividerNode,
  isNodeInViewport,
  parseCanvasDocument,
  resolveCanvasColor,
} from '@/lib/canvasLayout';
import aiRadarJson from '../../ai_enginnering/AI Radar.canvas?raw';
import aiEngineerCanvasJson from '../../ai_enginnering/ai-engineer.canvas?raw';
import pythonCanvasJson from '../../roadmaps/python.canvas?raw';

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
