import { describe, expect, it } from 'vitest';
import { AI_RADAR_PRESET } from '@/features/radar/lib/radarPresets';
import {
  convertCanvasToRadar,
  isRadarJsonObject,
  isRadarJsonString,
  parseRadarJson,
  serializeRadarJson,
} from '@/features/radar/lib/radarSchema';
import { RADAR_DOCUMENT_TYPE } from '@/features/radar/types/radar';
import pkgRaw from '../package.json?raw';

const questionsJsonRaw = JSON.stringify([
  { id: 'q-1', question: 'How does chunk overlap affect retrieval recall?' },
]);

const aiRadarJsonRaw = serializeRadarJson(AI_RADAR_PRESET);

const aiRadarCanvasRaw = (() => {
  const adoptTitles = [
    'Prompt Engineering',
    'RAG',
    ...Array.from({ length: 10 }, (_, i) => `Adopt Item ${i + 3}`),
  ];
  const trialTitles = Array.from({ length: 12 }, (_, i) => `Trial Item ${i + 1}`);
  const assessTitles = Array.from({ length: 12 }, (_, i) => `Assess Item ${i + 1}`);
  const holdTitles = [
    'Unmonitored token spend',
    ...Array.from({ length: 12 }, (_, i) => `Hold Item ${i + 2}`),
  ];

  const makeBlips = (titles: string[], radius: number, prefix: string) =>
    titles.map((title, i) => {
      const sector = i % 4;
      const sx = sector === 0 || sector === 2 ? -1 : 1;
      const sy = sector === 0 || sector === 1 ? -1 : 1;
      const angle = Math.PI / 8 + (i % 3) * 0.25;
      const cx = sx * radius * Math.cos(angle);
      const cy = sy * radius * Math.sin(angle);
      return {
        id: `blip-${prefix}-${i}`,
        type: 'text',
        x: Math.round(cx - 60),
        y: Math.round(cy - 20),
        width: 120,
        height: 40,
        text: title,
      };
    });

  return JSON.stringify({
    nodes: [
      { id: 'ring-adopt', type: 'text', x: -200, y: -200, width: 400, height: 400, styleAttributes: { shape: 'circle' } },
      { id: 'ring-trial', type: 'text', x: -400, y: -400, width: 800, height: 800, styleAttributes: { shape: 'circle' } },
      { id: 'ring-assess', type: 'text', x: -600, y: -600, width: 1200, height: 1200, styleAttributes: { shape: 'circle' } },
      { id: 'ring-hold', type: 'text', x: -800, y: -800, width: 1600, height: 1600, styleAttributes: { shape: 'circle' } },
      { id: 'title', type: 'text', x: -150, y: -900, width: 300, height: 60, text: '# AI Radar', styleAttributes: { border: 'invisible' } },
      { id: 'quadrant-tl', type: 'text', x: -600, y: -600, width: 200, height: 60, text: 'Techniques', styleAttributes: { border: 'invisible' } },
      { id: 'quadrant-tr', type: 'text', x: 400, y: -600, width: 200, height: 60, text: 'Patterns & Architectures', styleAttributes: { border: 'invisible' } },
      { id: 'quadrant-bl', type: 'text', x: -600, y: 500, width: 200, height: 60, text: 'Models & Modalities', styleAttributes: { border: 'invisible' } },
      { id: 'quadrant-br', type: 'text', x: 400, y: 500, width: 200, height: 60, text: 'Operations & Safety', styleAttributes: { border: 'invisible' } },
      ...makeBlips(adoptTitles, 120, 'adopt'),
      ...makeBlips(trialTitles, 300, 'trial'),
      ...makeBlips(assessTitles, 500, 'assess'),
      ...makeBlips(holdTitles, 700, 'hold'),
    ],
    edges: [],
  });
})();

describe('radarSchema & auto-detection', () => {
  it('parses concise shorthand step lists into canonical genforge-radar JSON', () => {
    const shorthand = JSON.stringify({
      type: 'genforge-radar',
      title: 'My Stack',
      adopt: [{ title: 'item1' }, { title: 'item2', quadrant: 'Core' }],
      trial: [{ title: 'item3', quadrant: 'Infra' }],
    });

    const res = parseRadarJson(shorthand);
    expect(res.ok).toBe(true);
    if (!res.ok) return;

    expect(res.doc.type).toBe(RADAR_DOCUMENT_TYPE);
    expect(res.doc.title).toBe('My Stack');
    expect(res.doc.steps.map((s) => s.id)).toEqual(['adopt', 'trial']);
    expect(res.doc.quadrants.map((q) => q.name)).toEqual(['Core', 'Infra']);
    expect(res.doc.items.adopt).toHaveLength(2);
    expect(res.doc.items.trial).toHaveLength(1);

    const roundTrip = parseRadarJson(serializeRadarJson(res.doc));
    expect(roundTrip.ok).toBe(true);
  });

  it('auto-detects radar JSON via type field and rejects unrelated vault JSON files', () => {
    expect(isRadarJsonObject({ type: 'genforge-radar', adopt: [] })).toBe(true);
    expect(isRadarJsonObject({ type: 'radar', adopt: [] })).toBe(true);
    expect(isRadarJsonString(serializeRadarJson(AI_RADAR_PRESET))).toBe(true);

    expect(isRadarJsonString(pkgRaw)).toBe(false);
    expect(parseRadarJson(pkgRaw, { allowUntypedShorthand: false }).ok).toBe(false);

    expect(isRadarJsonString(questionsJsonRaw)).toBe(false);
    expect(
      parseRadarJson(questionsJsonRaw, { allowUntypedShorthand: false }).ok,
    ).toBe(false);
  });

  it('supports custom step names and 0-quadrant (360-degree) shorthand inputs', () => {
    const custom = {
      title: 'Custom Ring Radar',
      core: [{ title: 'TypeScript' }],
      explore: [{ title: 'WebGPU' }],
      parked: [{ title: 'Legacy XML' }],
    };

    const res = parseRadarJson(custom, { allowUntypedShorthand: true });
    expect(res.ok).toBe(true);
    if (!res.ok) return;

    expect(res.doc.steps.map((s) => s.id)).toEqual(['core', 'explore', 'parked']);
    expect(res.doc.quadrants).toEqual([]);
    expect(res.doc.items.core[0].title).toBe('TypeScript');
  });

  it('converts real AI Radar.canvas with all 49 blips, 4 rings, and 4 quadrants', () => {
    const doc = convertCanvasToRadar(aiRadarCanvasRaw);

    expect(doc.type).toBe(RADAR_DOCUMENT_TYPE);
    expect(doc.title).toBe('AI Radar');
    expect(doc.steps.map((s) => s.id)).toEqual([
      'adopt',
      'trial',
      'assess',
      'hold',
    ]);
    expect(doc.quadrants.map((q) => q.name)).toEqual([
      'Techniques',
      'Patterns & Architectures',
      'Models & Modalities',
      'Operations & Safety',
    ]);

    const totalBlips = Object.values(doc.items).reduce(
      (sum, list) => sum + list.length,
      0,
    );
    expect(totalBlips).toBe(49);
    expect(doc.items.adopt.some((i) => i.title === 'Prompt Engineering')).toBe(
      true,
    );
    expect(doc.items.adopt.some((i) => i.title === 'RAG')).toBe(true);
    expect(
      doc.items.hold.some((i) => i.title === 'Unmonitored token spend'),
    ).toBe(true);
  });

  it('matches the checked-in ai-radar.radar.json file against AI_RADAR_PRESET', () => {
    expect(isRadarJsonString(aiRadarJsonRaw)).toBe(true);
    const parsed = parseRadarJson(aiRadarJsonRaw);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    const total = Object.values(parsed.doc.items).reduce(
      (sum, arr) => sum + arr.length,
      0,
    );
    expect(total).toBe(49);
  });
});
