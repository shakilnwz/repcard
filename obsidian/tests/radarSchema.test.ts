import { describe, expect, it } from 'vitest';
import { AI_RADAR_PRESET } from '@/lib/radarPresets';
import {
  convertCanvasToRadar,
  isRadarJsonObject,
  isRadarJsonString,
  parseRadarJson,
  serializeRadarJson,
} from '@/lib/radarSchema';
import { RADAR_DOCUMENT_TYPE } from '@/types/radar';
import pkgRaw from '../package.json?raw';
import aiRadarCanvasRaw from '../../ai_enginnering/AI Radar.canvas?raw';
import aiRadarJsonRaw from '../../ai_enginnering/ai-radar.radar.json?raw';
import questionsJsonRaw from '../../ai_enginnering/rag/eval/questions.json?raw';

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
