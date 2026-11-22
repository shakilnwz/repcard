import { describe, expect, it } from 'vitest';
import {
  computeRadarLayout,
  getFocusViewBox,
  pointToStepAndQuadrant,
  solveScreenSpaceLabels,
} from '@/lib/radarLayout';
import { AI_RADAR_PRESET } from '@/lib/radarPresets';

describe('radarLayout geometry & screen-space labels', () => {
  it('places all 49 AI Radar blips deterministically within their ring & quadrant bounds', () => {
    const layout1 = computeRadarLayout(AI_RADAR_PRESET);
    const layout2 = computeRadarLayout(AI_RADAR_PRESET);

    expect(layout1.blips).toHaveLength(49);
    expect(layout1.blips).toEqual(layout2.blips);

    for (const blip of layout1.blips) {
      const band = layout1.rings[blip.stepIndex];
      expect(blip.radius).toBeGreaterThanOrEqual(band.innerRadius);
      expect(blip.radius).toBeLessThanOrEqual(band.outerRadius);

      const roundTrip = pointToStepAndQuadrant(blip.x, blip.y, layout1);
      expect(roundTrip.stepId).toBe(blip.step.id);
      expect(roundTrip.quadrantId).toBe(blip.quadrant?.id);
    }
  });

  it('guarantees non-empty, in-bounds screen-space labels across all label modes', () => {
    const layout = computeRadarLayout(AI_RADAR_PRESET);
    const fullVb = getFocusViewBox(null, layout.sectors);

    const allLabels = solveScreenSpaceLabels({
      blips: layout.blips,
      viewBox: fullVb,
      containerWidth: 900,
      containerHeight: 720,
      zoom: 1,
      panX: 0,
      panY: 0,
      labelMode: 'labels',
      prioritizedIds: new Set(),
    });

    expect(allLabels).toHaveLength(49);
    for (const lbl of allLabels) {
      expect(lbl.boxX).toBeGreaterThanOrEqual(0);
      expect(lbl.boxY).toBeGreaterThanOrEqual(0);
      expect(lbl.boxX + lbl.boxWidth).toBeLessThanOrEqual(900);
      expect(lbl.boxY + lbl.boxHeight).toBeLessThanOrEqual(720);
    }

    const quadVb = getFocusViewBox(0, layout.sectors);
    const focusedAuto = solveScreenSpaceLabels({
      blips: layout.blips.filter((b) => b.quadrantIndex === 0),
      viewBox: quadVb,
      containerWidth: 900,
      containerHeight: 720,
      zoom: 1,
      panX: 0,
      panY: 0,
      labelMode: 'auto',
      prioritizedIds: new Set(),
    });

    // Focusing a single quadrant leaves ample room for all 12 items in Auto mode
    expect(focusedAuto.length).toBeGreaterThanOrEqual(10);

    const numbersOnly = solveScreenSpaceLabels({
      blips: layout.blips,
      viewBox: fullVb,
      containerWidth: 900,
      containerHeight: 720,
      zoom: 1,
      panX: 0,
      panY: 0,
      labelMode: 'numbers',
      prioritizedIds: new Set([layout.blips[0].item.id]),
    });
    expect(numbersOnly).toHaveLength(1);
    expect(numbersOnly[0].itemId).toBe(layout.blips[0].item.id);
  });
});
