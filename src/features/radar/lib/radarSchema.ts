import {
  RADAR_DOCUMENT_TYPE,
  type RadarDocument,
  type RadarItem,
  type RadarMovement,
  type RadarQuadrant,
  type RadarStep,
} from '@/features/radar/types/radar';

export const DEFAULT_STEP_COLORS = [
  '#39FF88',
  '#38BDF8',
  '#FACC15',
  '#FB7185',
  '#A78BFA',
  '#FB923C',
] as const;

export const DEFAULT_STEP_DESCRIPTIONS: Record<string, string> = {
  adopt: 'Proven; use it by default',
  trial: 'Worth using on real projects where it fits',
  assess: 'Explore and prototype; not yet a default',
  hold: 'Avoid for new work, or proceed with care',
};

const CANONICAL_DEFAULT_ORDER = ['adopt', 'trial', 'assess', 'hold'];

const RESERVED_TOP_KEYS = new Set([
  'type',
  'schemaVersion',
  'title',
  'subtitle',
  'description',
  'quadrants',
  'steps',
  'items',
  'metadata',
  'rings',
]);

const VALID_MOVEMENTS = new Set<RadarMovement>(['new', 'up', 'down', 'same']);

const CANVAS_COLOR_MAP: Record<string, string> = {
  '1': '#FB7185',
  '2': '#FB923C',
  '3': '#FACC15',
  '4': '#39FF88',
  '5': '#38BDF8',
  '6': '#A78BFA',
};

export function slugifyRadarKey(raw: string): string {
  const slug = raw
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return slug || 'item';
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

export function isRadarJsonObject(value: unknown): boolean {
  if (!isPlainObject(value)) return false;
  const rawType = typeof value.type === 'string' ? value.type.trim().toLowerCase() : '';
  return rawType === RADAR_DOCUMENT_TYPE || rawType === 'radar';
}

export function isRadarJsonString(raw: string): boolean {
  if (!raw || !raw.includes('"type"') || !raw.toLowerCase().includes('radar')) {
    return false;
  }
  try {
    const parsed = JSON.parse(raw) as unknown;
    return isRadarJsonObject(parsed);
  } catch {
    return false;
  }
}

function normalizeStepLabel(rawId: string, rawLabel?: unknown): string {
  if (typeof rawLabel === 'string' && rawLabel.trim()) {
    return rawLabel.trim();
  }
  return rawId
    .replace(/[-_]+/g, ' ')
    .trim()
    .toUpperCase();
}

function normalizeMovement(raw: unknown): RadarMovement | undefined {
  if (typeof raw !== 'string') return undefined;
  const lower = raw.trim().toLowerCase() as RadarMovement;
  return VALID_MOVEMENTS.has(lower) ? lower : undefined;
}

function normalizeTags(raw: unknown): string[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const tags = raw
    .map((t) => (typeof t === 'string' ? t.trim() : ''))
    .filter(Boolean);
  return tags.length > 0 ? Array.from(new Set(tags)) : undefined;
}

function makeUniqueId(base: string, seen: Set<string>): string {
  let candidate = slugifyRadarKey(base);
  if (!seen.has(candidate)) {
    seen.add(candidate);
    return candidate;
  }
  let n = 2;
  while (seen.has(`${candidate}-${n}`)) {
    n += 1;
  }
  const unique = `${candidate}-${n}`;
  seen.add(unique);
  return unique;
}

export interface ParseRadarOptions {
  allowUntypedShorthand?: boolean;
}

export type ParseRadarResult =
  | { ok: true; doc: RadarDocument; warnings: string[] }
  | { ok: false; error: string };

export function parseRadarJson(
  input: string | unknown,
  options: ParseRadarOptions = {},
): ParseRadarResult {
  let parsed: unknown = input;
  if (typeof input === 'string') {
    const trimmed = input.trim();
    if (!trimmed) {
      return { ok: false, error: 'JSON input is empty.' };
    }
    try {
      parsed = JSON.parse(trimmed) as unknown;
    } catch (err) {
      return {
        ok: false,
        error: err instanceof Error ? `Invalid JSON: ${err.message}` : 'Invalid JSON.',
      };
    }
  }

  if (!isPlainObject(parsed)) {
    return { ok: false, error: 'Radar JSON must be a JSON object.' };
  }

  const allowUntyped = options.allowUntypedShorthand === true;
  if (!allowUntyped && !isRadarJsonObject(parsed)) {
    return {
      ok: false,
      error: `Missing or unsupported "type" (expected "${RADAR_DOCUMENT_TYPE}").`,
    };
  }

  const warnings: string[] = [];
  const title =
    typeof parsed.title === 'string' && parsed.title.trim()
      ? parsed.title.trim()
      : 'Technology Radar';
  const subtitle =
    typeof parsed.subtitle === 'string' && parsed.subtitle.trim()
      ? parsed.subtitle.trim()
      : undefined;
  const description =
    typeof parsed.description === 'string' && parsed.description.trim()
      ? parsed.description.trim()
      : undefined;

  // Collect raw step arrays from `items` and/or top-level shorthand keys
  const rawStepArrays = new Map<string, unknown[]>();
  const rawStepMeta = new Map<string, Partial<RadarStep>>();

  if (Array.isArray(parsed.steps)) {
    for (const entry of parsed.steps) {
      if (typeof entry === 'string' && entry.trim()) {
        const id = slugifyRadarKey(entry);
        rawStepMeta.set(id, { id, label: entry.trim().toUpperCase() });
      } else if (isPlainObject(entry)) {
        const rawId =
          typeof entry.id === 'string' && entry.id.trim()
            ? entry.id.trim()
            : typeof entry.label === 'string' && entry.label.trim()
              ? entry.label.trim()
              : '';
        if (!rawId) continue;
        const id = slugifyRadarKey(rawId);
        rawStepMeta.set(id, {
          id,
          label: normalizeStepLabel(id, entry.label),
          color: typeof entry.color === 'string' ? entry.color.trim() : undefined,
          description:
            typeof entry.description === 'string' ? entry.description.trim() : undefined,
        });
      }
    }
  }

  if (isPlainObject(parsed.items)) {
    for (const [k, val] of Object.entries(parsed.items)) {
      if (Array.isArray(val)) {
        rawStepArrays.set(slugifyRadarKey(k), val);
      }
    }
  }

  // Also scan top-level arrays (shorthand: `{ adopt: [{ title: 'item1' }], trial: [...] }`)
  for (const [k, val] of Object.entries(parsed)) {
    if (RESERVED_TOP_KEYS.has(k)) continue;
    if (Array.isArray(val)) {
      const id = slugifyRadarKey(k);
      if (!rawStepArrays.has(id)) {
        rawStepArrays.set(id, val);
      }
      if (!rawStepMeta.has(id)) {
        rawStepMeta.set(id, { id, label: normalizeStepLabel(id) });
      }
    }
  }

  if (rawStepArrays.size === 0 && rawStepMeta.size === 0) {
    return {
      ok: false,
      error:
        'No radar steps found. Provide step arrays like "adopt": [{ "title": "Item 1" }] or an "items" map.',
    };
  }

  // Determine ordered step IDs
  const orderedIds: string[] = [];
  const seenStepIds = new Set<string>();
  const addOrderedStep = (id: string) => {
    if (!seenStepIds.has(id)) {
      seenStepIds.add(id);
      orderedIds.push(id);
    }
  };

  if (Array.isArray(parsed.steps) && rawStepMeta.size > 0) {
    for (const id of rawStepMeta.keys()) addOrderedStep(id);
    for (const id of rawStepArrays.keys()) addOrderedStep(id);
  } else {
    const allKeys = Array.from(new Set([...rawStepMeta.keys(), ...rawStepArrays.keys()]));
    const allInCanonical = allKeys.every((k) => CANONICAL_DEFAULT_ORDER.includes(k));
    if (allInCanonical) {
      for (const id of CANONICAL_DEFAULT_ORDER) {
        if (allKeys.includes(id)) addOrderedStep(id);
      }
    } else {
      for (const id of allKeys) addOrderedStep(id);
    }
  }

  const steps: RadarStep[] = orderedIds.map((id, idx) => {
    const meta = rawStepMeta.get(id);
    const fallbackColor = DEFAULT_STEP_COLORS[idx % DEFAULT_STEP_COLORS.length];
    return {
      id,
      label: meta?.label || normalizeStepLabel(id),
      color:
        meta?.color && /^#[0-9a-f]{3,8}$/i.test(meta.color)
          ? meta.color
          : fallbackColor,
      description: meta?.description ?? DEFAULT_STEP_DESCRIPTIONS[id],
    };
  });

  // Normalize explicit quadrants first
  const quadrants: RadarQuadrant[] = [];
  const quadrantLookup = new Map<string, string>();
  const seenQuadIds = new Set<string>();

  if (Array.isArray(parsed.quadrants)) {
    for (const q of parsed.quadrants) {
      if (typeof q === 'string' && q.trim()) {
        const id = makeUniqueId(q, seenQuadIds);
        quadrants.push({ id, name: q.trim() });
        quadrantLookup.set(id.toLowerCase(), id);
        quadrantLookup.set(q.trim().toLowerCase(), id);
      } else if (isPlainObject(q)) {
        const rawName =
          typeof q.name === 'string' && q.name.trim()
            ? q.name.trim()
            : typeof q.id === 'string' && q.id.trim()
              ? q.id.trim()
              : '';
        if (!rawName) continue;
        const id = makeUniqueId(
          typeof q.id === 'string' && q.id.trim() ? q.id : rawName,
          seenQuadIds,
        );
        const subtitleVal =
          typeof q.subtitle === 'string' && q.subtitle.trim()
            ? q.subtitle.trim()
            : undefined;
        quadrants.push({ id, name: rawName, subtitle: subtitleVal });
        quadrantLookup.set(id.toLowerCase(), id);
        quadrantLookup.set(rawName.toLowerCase(), id);
      }
    }
  }

  // First pass: collect distinct item quadrant values if quadrants were omitted
  const discoveredQuadrants = new Map<string, string>();
  if (quadrants.length === 0) {
    for (const stepId of orderedIds) {
      const arr = rawStepArrays.get(stepId) ?? [];
      for (const rawItem of arr) {
        if (isPlainObject(rawItem) && typeof rawItem.quadrant === 'string') {
          const rawQ = rawItem.quadrant.trim();
          if (rawQ) {
            const qId = slugifyRadarKey(rawQ);
            if (!discoveredQuadrants.has(qId)) {
              discoveredQuadrants.set(qId, rawQ);
            }
          }
        }
      }
    }
    if (discoveredQuadrants.size >= 2) {
      for (const [qId, rawLabel] of discoveredQuadrants.entries()) {
        const id = makeUniqueId(qId, seenQuadIds);
        const displayName =
          rawLabel === qId
            ? rawLabel.replace(/[-_]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
            : rawLabel;
        quadrants.push({ id, name: displayName });
        quadrantLookup.set(id.toLowerCase(), id);
        quadrantLookup.set(rawLabel.toLowerCase(), id);
      }
    }
  }

  // Normalize items per step
  const items: Record<string, RadarItem[]> = {};
  const seenItemIds = new Set<string>();

  for (const step of steps) {
    const rawList = rawStepArrays.get(step.id) ?? [];
    const normalizedList: RadarItem[] = [];

    for (let i = 0; i < rawList.length; i += 1) {
      const rawEntry = rawList[i];
      if (typeof rawEntry === 'string') {
        const cleanTitle = rawEntry.trim();
        if (!cleanTitle) continue;
        normalizedList.push({
          id: makeUniqueId(`${step.id}-${cleanTitle}`, seenItemIds),
          title: cleanTitle,
          quadrant: quadrants.length > 0 ? quadrants[0].id : undefined,
        });
        continue;
      }

      if (!isPlainObject(rawEntry)) {
        warnings.push(`Skipped non-object entry in step "${step.id}" at index ${i}.`);
        continue;
      }

      const rawTitle =
        typeof rawEntry.title === 'string'
          ? rawEntry.title.trim()
          : typeof rawEntry.name === 'string'
            ? rawEntry.name.trim()
            : '';
      if (!rawTitle) {
        warnings.push(`Skipped item without a title in step "${step.id}" at index ${i}.`);
        continue;
      }

      const itemId = makeUniqueId(
        typeof rawEntry.id === 'string' && rawEntry.id.trim()
          ? rawEntry.id
          : `${step.id}-${rawTitle}`,
        seenItemIds,
      );

      let resolvedQuadrant: string | undefined;
      if (quadrants.length > 0) {
        const rawQ =
          typeof rawEntry.quadrant === 'string' ? rawEntry.quadrant.trim().toLowerCase() : '';
        resolvedQuadrant =
          (rawQ && (quadrantLookup.get(rawQ) ?? quadrantLookup.get(slugifyRadarKey(rawQ)))) ||
          quadrants[0].id;
      }

      const desc =
        typeof rawEntry.description === 'string' && rawEntry.description.trim()
          ? rawEntry.description.trim()
          : undefined;
      const linkVal =
        typeof rawEntry.link === 'string' && rawEntry.link.trim()
          ? rawEntry.link.trim()
          : typeof rawEntry.url === 'string' && rawEntry.url.trim()
            ? rawEntry.url.trim()
            : undefined;

      normalizedList.push({
        id: itemId,
        title: rawTitle,
        quadrant: resolvedQuadrant,
        description: desc,
        link: linkVal,
        tags: normalizeTags(rawEntry.tags),
        movement: normalizeMovement(rawEntry.movement),
      });
    }

    items[step.id] = normalizedList;
  }

  return {
    ok: true,
    doc: {
      type: RADAR_DOCUMENT_TYPE,
      schemaVersion: 1,
      title,
      subtitle,
      description,
      quadrants,
      steps,
      items,
    },
    warnings,
  };
}

export function serializeRadarJson(doc: RadarDocument): string {
  const orderedItems: Record<string, RadarItem[]> = {};
  for (const step of doc.steps) {
    orderedItems[step.id] = (doc.items[step.id] ?? []).map((item) => {
      const cleaned: RadarItem = {
        id: item.id,
        title: item.title,
      };
      if (item.quadrant) cleaned.quadrant = item.quadrant;
      if (item.description) cleaned.description = item.description;
      if (item.link) cleaned.link = item.link;
      if (item.tags && item.tags.length > 0) cleaned.tags = item.tags;
      if (item.movement && item.movement !== 'same') cleaned.movement = item.movement;
      return cleaned;
    });
  }

  const out: RadarDocument = {
    type: RADAR_DOCUMENT_TYPE,
    schemaVersion: 1,
    title: doc.title,
    ...(doc.subtitle ? { subtitle: doc.subtitle } : {}),
    ...(doc.description ? { description: doc.description } : {}),
    quadrants: doc.quadrants,
    steps: doc.steps,
    items: orderedItems,
  };

  return JSON.stringify(out, null, 2);
}

interface RawCanvasNode {
  id?: string;
  type?: string;
  text?: string;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  color?: string;
  styleAttributes?: {
    shape?: string;
    border?: string;
  };
}

function cleanNodeMarkdown(raw: string): string {
  return raw
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/__(.*?)__/g, '$1')
    .trim();
}

export function convertCanvasToRadar(
  rawCanvasJson: string,
  fallbackTitle = 'Converted Canvas Radar',
): RadarDocument {
  const parsed = JSON.parse(rawCanvasJson) as { nodes?: RawCanvasNode[] };
  const nodes = Array.isArray(parsed?.nodes) ? parsed.nodes : [];

  // 1. Identify concentric circles (innermost -> outermost)
  const circles = nodes
    .filter(
      (n) =>
        n.styleAttributes?.shape === 'circle' &&
        typeof n.width === 'number' &&
        typeof n.x === 'number' &&
        typeof n.y === 'number',
    )
    .sort((a, b) => (a.width ?? 0) - (b.width ?? 0));

  const labelNodes = nodes.filter((n) => (n.id ?? '').startsWith('label-'));

  const steps: RadarStep[] = circles.map((circle, idx) => {
    const rawId = (circle.id ?? `step-${idx + 1}`).replace(/^ring-/, '');
    const id = slugifyRadarKey(rawId);
    const matchingLabelNode = labelNodes.find(
      (ln) => (ln.id ?? '').replace(/^label-/, '') === rawId,
    );
    const labelText = matchingLabelNode?.text
      ? cleanNodeMarkdown(matchingLabelNode.text)
      : normalizeStepLabel(id);
    const color =
      (circle.color && CANVAS_COLOR_MAP[circle.color]) ||
      (circle.color && /^#[0-9a-f]{3,8}$/i.test(circle.color) ? circle.color : undefined) ||
      DEFAULT_STEP_COLORS[idx % DEFAULT_STEP_COLORS.length];

    return {
      id,
      label: labelText,
      color,
      description: DEFAULT_STEP_DESCRIPTIONS[id],
    };
  });

  if (steps.length === 0) {
    steps.push(
      { id: 'adopt', label: 'ADOPT', color: '#39FF88', description: DEFAULT_STEP_DESCRIPTIONS.adopt },
      { id: 'trial', label: 'TRIAL', color: '#38BDF8', description: DEFAULT_STEP_DESCRIPTIONS.trial },
      { id: 'assess', label: 'ASSESS', color: '#FACC15', description: DEFAULT_STEP_DESCRIPTIONS.assess },
      { id: 'hold', label: 'HOLD', color: '#FB7185', description: DEFAULT_STEP_DESCRIPTIONS.hold },
    );
  }

  // 2. Title & Subtitle
  const titleNode = nodes.find((n) => n.id === 'title');
  let title = fallbackTitle;
  let subtitle: string | undefined;
  if (titleNode?.text) {
    const lines = titleNode.text
      .split(/\r?\n/)
      .map(cleanNodeMarkdown)
      .filter(Boolean);
    if (lines[0]) title = lines[0];
    if (lines[1]) subtitle = lines.slice(1).join(' · ');
  }

  // 3. Quadrants mapped by spatial corner (TL, TR, BL, BR)
  const quadrantCandidates = nodes.filter(
    (n) =>
      (n.id ?? '').startsWith('quadrant-') ||
      (n.styleAttributes?.border === 'invisible' &&
        n.id !== 'title' &&
        Boolean(n.text?.trim())),
  );

  const cornerSlots: Array<{ key: string; match: (cx: number, cy: number) => boolean; defaultName: string }> = [
    { key: 'tl', match: (cx, cy) => cx < 0 && cy < 0, defaultName: 'Quadrant 1' },
    { key: 'tr', match: (cx, cy) => cx >= 0 && cy < 0, defaultName: 'Quadrant 2' },
    { key: 'bl', match: (cx, cy) => cx < 0 && cy >= 0, defaultName: 'Quadrant 3' },
    { key: 'br', match: (cx, cy) => cx >= 0 && cy >= 0, defaultName: 'Quadrant 4' },
  ];

  const seenQuadIds = new Set<string>();
  const quadrants: RadarQuadrant[] = cornerSlots.map((slot) => {
    const node = quadrantCandidates.find((q) => {
      const cx = (q.x ?? 0) + (q.width ?? 0) / 2;
      const cy = (q.y ?? 0) + (q.height ?? 0) / 2;
      return slot.match(cx, cy);
    });
    const lines = (node?.text ?? '')
      .split(/\r?\n/)
      .map(cleanNodeMarkdown)
      .filter(Boolean);
    const qName = lines[0] || slot.defaultName;
    const qSub = lines[1];
    const id = makeUniqueId(qName, seenQuadIds);
    return {
      id,
      name: qName,
      ...(qSub ? { subtitle: qSub } : {}),
    };
  });

  // 4. Blip nodes
  const items: Record<string, RadarItem[]> = {};
  for (const s of steps) items[s.id] = [];

  const seenItemIds = new Set<string>();
  for (const n of nodes) {
    const id = n.id ?? '';
    if (
      n.styleAttributes?.shape === 'circle' ||
      n.styleAttributes?.border === 'invisible' ||
      id.startsWith('divider-') ||
      id.startsWith('label-') ||
      id.startsWith('quadrant-') ||
      id === 'title' ||
      id === 'legend' ||
      (n.width ?? 0) <= 12 ||
      (n.height ?? 0) <= 12 ||
      !n.text?.trim()
    ) {
      continue;
    }

    const cx = (n.x ?? 0) + (n.width ?? 0) / 2;
    const cy = (n.y ?? 0) + (n.height ?? 0) / 2;
    const dist = Math.hypot(cx, cy);

    let stepIndex = circles.findIndex((c) => dist <= (c.width ?? 0) / 2);
    if (stepIndex < 0) {
      stepIndex = steps.length - 1;
    }
    const targetStep = steps[Math.min(stepIndex, steps.length - 1)];

    const qIdx = cx < 0 ? (cy < 0 ? 0 : 2) : cy < 0 ? 1 : 3;
    const targetQuadrant = quadrants[qIdx];
    const itemTitle = cleanNodeMarkdown(n.text);

    items[targetStep.id].push({
      id: makeUniqueId(id.replace(/^blip-/, '') || itemTitle, seenItemIds),
      title: itemTitle,
      quadrant: targetQuadrant.id,
    });
  }

  return {
    type: RADAR_DOCUMENT_TYPE,
    schemaVersion: 1,
    title,
    ...(subtitle ? { subtitle } : {}),
    quadrants,
    steps,
    items,
  };
}
