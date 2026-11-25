import {
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  Check,
  Code2,
  Copy,
  Download,
  FileJson,
  ListPlus,
  Plus,
  Save,
  Sparkles,
  Trash2,
  Wand2,
} from '@/shared/ui/MaterialIcons';
import { useMemo, useState } from 'react';
import { RadarChart } from '@/features/radar/components/RadarChart';
import { computeRadarLayout } from '@/features/radar/lib/radarLayout';
import { SHORTHAND_EXAMPLE_JSON } from '@/features/radar/lib/radarPresets';
import {
  DEFAULT_STEP_COLORS,
  parseRadarJson,
  serializeRadarJson,
  slugifyRadarKey,
} from '@/features/radar/lib/radarSchema';
import type {
  RadarDocument,
  RadarItem,
  RadarLabelMode,
  RadarMovement,
} from '@/features/radar/types/radar';

interface RadarCreatorProps {
  initialDoc: RadarDocument;
  initialPath?: string;
  canSaveToVault: boolean;
  onSaveToVault?: (path: string, doc: RadarDocument) => Promise<void>;
  onSaveLocal?: (doc: RadarDocument) => Promise<void>;
  onCancel: () => void;
}

export function RadarCreator({
  initialDoc,
  initialPath,
  canSaveToVault,
  onSaveToVault,
  onSaveLocal,
  onCancel,
}: RadarCreatorProps) {
  const [doc, setDoc] = useState<RadarDocument>(() => initialDoc);
  const [tab, setTab] = useState<'visual' | 'json'>('visual');
  const [jsonText, setJsonText] = useState<string>(() =>
    serializeRadarJson(initialDoc),
  );
  const [jsonError, setJsonError] = useState<string | null>(null);
  const [jsonNotice, setJsonNotice] = useState<string | null>(null);
  const [activeStepId, setActiveStepId] = useState<string>(
    () => initialDoc.steps[0]?.id ?? 'adopt',
  );
  const [targetPath, setTargetPath] = useState<string>(
    () =>
      initialPath ||
      `ai_enginnering/${slugifyRadarKey(initialDoc.title)}.radar.json`,
  );

  // Add item form state
  const [newTitle, setNewTitle] = useState('');
  const [newQuadrant, setNewQuadrant] = useState(
    initialDoc.quadrants[0]?.id ?? '',
  );
  const [newDescription, setNewDescription] = useState('');
  const [newLink, setNewLink] = useState('');
  const [newTags, setNewTags] = useState('');
  const [newMovement, setNewMovement] = useState<RadarMovement>('same');
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkText, setBulkText] = useState('');
  const [editingItemId, setEditingItemId] = useState<string | null>(null);

  // Live preview chart state
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [hoveredItemId, setHoveredItemId] = useState<string | null>(null);
  const [focusedQuadrantIndex, setFocusedQuadrantIndex] = useState<number | null>(
    null,
  );
  const [labelMode, setLabelMode] = useState<RadarLabelMode>('auto');
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [mobilePane, setMobilePane] = useState<'editor' | 'preview'>('editor');

  const layout = useMemo(() => computeRadarLayout(doc), [doc]);
  const allStepIds = useMemo(
    () => new Set(doc.steps.map((s) => s.id)),
    [doc.steps],
  );

  const resolvedStepId = doc.steps.some((s) => s.id === activeStepId)
    ? activeStepId
    : (doc.steps[0]?.id ?? '');

  const commitDoc = (updater: (prev: RadarDocument) => RadarDocument) => {
    setDoc((prev) => {
      const next = updater(prev);
      setJsonText(serializeRadarJson(next));
      setJsonError(null);
      return next;
    });
  };

  const handleJsonChange = (raw: string) => {
    setJsonText(raw);
    setJsonNotice(null);
    const parsed = parseRadarJson(raw, { allowUntypedShorthand: true });
    if (parsed.ok) {
      setDoc(parsed.doc);
      setJsonError(null);
      if (
        parsed.doc.steps.length > 0 &&
        !parsed.doc.steps.some((s) => s.id === activeStepId)
      ) {
        setActiveStepId(parsed.doc.steps[0].id);
      }
      if (parsed.doc.quadrants.length > 0) {
        setNewQuadrant(parsed.doc.quadrants[0].id);
      }
    } else {
      setJsonError(parsed.error);
    }
  };

  const handleFormatCanonical = () => {
    const parsed = parseRadarJson(jsonText, { allowUntypedShorthand: true });
    if (!parsed.ok) {
      setJsonError(parsed.error);
      return;
    }
    const formatted = serializeRadarJson(parsed.doc);
    setDoc(parsed.doc);
    setJsonText(formatted);
    setJsonError(null);
    setJsonNotice('Normalized to canonical "genforge-radar" JSON.');
  };

  const handleLoadShorthandExample = () => {
    setTab('json');
    handleJsonChange(SHORTHAND_EXAMPLE_JSON);
    setJsonNotice('Loaded shorthand example — edit steps or paste your own!');
  };

  const handleAddItem = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = newTitle.trim();
    if (!clean || !resolvedStepId) return;

    const tagsArr = newTags
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);

    const item: RadarItem = {
      id: `${resolvedStepId}-${slugifyRadarKey(clean)}-${Date.now().toString(36).slice(-4)}`,
      title: clean,
      quadrant: doc.quadrants.length > 0 ? newQuadrant || doc.quadrants[0].id : undefined,
      description: newDescription.trim() || undefined,
      link: newLink.trim() || undefined,
      tags: tagsArr.length > 0 ? tagsArr : undefined,
      movement: newMovement !== 'same' ? newMovement : undefined,
    };

    commitDoc((prev) => ({
      ...prev,
      items: {
        ...prev.items,
        [resolvedStepId]: [...(prev.items[resolvedStepId] ?? []), item],
      },
    }));

    setNewTitle('');
    setNewDescription('');
    setNewLink('');
    setNewTags('');
    setNewMovement('same');
  };

  const handleBulkAdd = () => {
    const lines = bulkText
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean);
    if (lines.length === 0 || !resolvedStepId) return;

    const nowTag = Date.now().toString(36).slice(-3);
    const additions: RadarItem[] = lines.map((title, idx) => ({
      id: `${resolvedStepId}-${slugifyRadarKey(title)}-${nowTag}${idx}`,
      title,
      quadrant: doc.quadrants.length > 0 ? newQuadrant || doc.quadrants[0].id : undefined,
    }));

    commitDoc((prev) => ({
      ...prev,
      items: {
        ...prev.items,
        [resolvedStepId]: [...(prev.items[resolvedStepId] ?? []), ...additions],
      },
    }));

    setBulkText('');
    setBulkOpen(false);
  };

  const handleUpdateItem = (
    stepId: string,
    itemId: string,
    patch: Partial<RadarItem>,
  ) => {
    commitDoc((prev) => ({
      ...prev,
      items: {
        ...prev.items,
        [stepId]: (prev.items[stepId] ?? []).map((it) =>
          it.id === itemId ? { ...it, ...patch } : it,
        ),
      },
    }));
  };

  const handleDeleteItem = (stepId: string, itemId: string) => {
    commitDoc((prev) => ({
      ...prev,
      items: {
        ...prev.items,
        [stepId]: (prev.items[stepId] ?? []).filter((it) => it.id !== itemId),
      },
    }));
    if (selectedItemId === itemId) setSelectedItemId(null);
  };

  const handleMoveItem = (
    itemId: string,
    fromStepId: string,
    toStepId: string,
    toQuadrantId?: string,
  ) => {
    commitDoc((prev) => {
      const fromList = prev.items[fromStepId] ?? [];
      const found = fromList.find((it) => it.id === itemId);
      if (!found) return prev;

      const updated: RadarItem = {
        ...found,
        ...(toQuadrantId !== undefined ? { quadrant: toQuadrantId } : {}),
      };

      if (fromStepId === toStepId) {
        return {
          ...prev,
          items: {
            ...prev.items,
            [fromStepId]: fromList.map((it) => (it.id === itemId ? updated : it)),
          },
        };
      }

      return {
        ...prev,
        items: {
          ...prev.items,
          [fromStepId]: fromList.filter((it) => it.id !== itemId),
          [toStepId]: [...(prev.items[toStepId] ?? []), updated],
        },
      };
    });
  };

  const handleAddStep = () => {
    const idx = doc.steps.length;
    const baseId = `ring-${idx + 1}`;
    const color = DEFAULT_STEP_COLORS[idx % DEFAULT_STEP_COLORS.length];
    commitDoc((prev) => ({
      ...prev,
      steps: [
        ...prev.steps,
        { id: baseId, label: `STEP ${idx + 1}`, color },
      ],
      items: {
        ...prev.items,
        [baseId]: [],
      },
    }));
    setActiveStepId(baseId);
  };

  const handleReorderStep = (idx: number, dir: -1 | 1) => {
    const nextIdx = idx + dir;
    if (nextIdx < 0 || nextIdx >= doc.steps.length) return;
    commitDoc((prev) => {
      const copy = [...prev.steps];
      const [moved] = copy.splice(idx, 1);
      copy.splice(nextIdx, 0, moved);
      return { ...prev, steps: copy };
    });
  };

  const handleDeleteStep = (stepId: string) => {
    if (doc.steps.length <= 1) return;
    commitDoc((prev) => {
      const nextSteps = prev.steps.filter((s) => s.id !== stepId);
      const nextItems = { ...prev.items };
      delete nextItems[stepId];
      return { ...prev, steps: nextSteps, items: nextItems };
    });
  };

  const handleToggleQuadrants = (enabled: boolean) => {
    if (!enabled) {
      commitDoc((prev) => ({ ...prev, quadrants: [] }));
      setFocusedQuadrantIndex(null);
    } else {
      const defaults = [
        { id: 'q1', name: 'Techniques' },
        { id: 'q2', name: 'Platforms' },
        { id: 'q3', name: 'Tools' },
        { id: 'q4', name: 'Languages' },
      ];
      commitDoc((prev) => ({
        ...prev,
        quadrants: defaults,
      }));
      setNewQuadrant(defaults[0].id);
    }
  };

  const handleAddQuadrant = () => {
    const idx = doc.quadrants.length + 1;
    const id = `q-${idx}-${Date.now().toString(36).slice(-3)}`;
    commitDoc((prev) => ({
      ...prev,
      quadrants: [...prev.quadrants, { id, name: `Quadrant ${idx}` }],
    }));
  };

  const handleCopyJson = async () => {
    try {
      await navigator.clipboard.writeText(serializeRadarJson(doc));
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      // Ignore clipboard failures
    }
  };

  const handleDownloadJson = () => {
    const json = serializeRadarJson(doc);
    const blob = new Blob([json], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${slugifyRadarKey(doc.title)}.radar.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const handleSaveVault = async () => {
    if (!onSaveToVault) return;
    setSaving(true);
    setSaveMessage(null);
    try {
      await onSaveToVault(targetPath.trim(), doc);
      setSaveMessage(`Saved to vault (${targetPath.trim()})`);
    } catch (err) {
      setSaveMessage(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveLocalClick = async () => {
    if (!onSaveLocal) return;
    setSaving(true);
    setSaveMessage(null);
    try {
      await onSaveLocal(doc);
      setSaveMessage('Saved locally to browser storage');
    } catch (err) {
      setSaveMessage(err instanceof Error ? err.message : 'Local save failed');
    } finally {
      setSaving(false);
    }
  };

  const totalItems = layout.blips.length;

  return (
    <div
      data-testid="radar-creator"
      className="flex h-full min-h-0 flex-col gap-3"
    >
      {/* Studio Top Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-[var(--bg-surface)] px-3.5 py-2.5 text-xs shadow-sm">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="inline-flex items-center gap-1 rounded-xl bg-[var(--bg-canvas)] px-3 py-1.5 font-medium text-[var(--text-secondary)] shadow-xs hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span>Back to Viewer</span>
          </button>

          <span className="inline-flex items-center gap-1.5 font-bold text-[var(--accent-primary)]">
            <Sparkles className="h-4 w-4" />
            <span>Radar Studio</span>
          </span>

          <span className="rounded-full bg-[var(--bg-elevated)] px-2.5 py-0.5 text-[11px] text-[var(--text-muted)] tabular-nums">
            {doc.steps.length} steps · {totalItems} items
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={() => void handleCopyJson()}
            className="inline-flex items-center gap-1 rounded-xl bg-[var(--bg-canvas)] px-3 py-1.5 font-medium text-[var(--text-secondary)] shadow-xs hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]"
          >
            {copied ? (
              <>
                <Check className="h-3.5 w-3.5 text-[var(--accent-primary)]" />
                <span className="text-[var(--accent-primary)]">Copied</span>
              </>
            ) : (
              <>
                <Copy className="h-3.5 w-3.5" />
                <span>Copy JSON</span>
              </>
            )}
          </button>

          <button
            type="button"
            onClick={handleDownloadJson}
            className="inline-flex items-center gap-1 rounded-xl bg-[var(--bg-canvas)] px-3 py-1.5 font-medium text-[var(--text-secondary)] shadow-xs hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]"
          >
            <Download className="h-3.5 w-3.5" />
            <span>Download .json</span>
          </button>

          {onSaveLocal && (
            <button
              type="button"
              disabled={saving || Boolean(jsonError)}
              onClick={() => void handleSaveLocalClick()}
              className="inline-flex items-center gap-1 rounded-xl bg-[var(--bg-hover)] px-3.5 py-1.5 font-bold text-[var(--accent-primary)] shadow-xs hover:opacity-90 disabled:opacity-50"
            >
              <Save className="h-3.5 w-3.5" />
              <span>Save Locally</span>
            </button>
          )}

          {canSaveToVault && onSaveToVault && (
            <div className="flex min-w-0 flex-1 items-center gap-1.5 sm:flex-initial">
              <input
                type="text"
                value={targetPath}
                onChange={(e) => setTargetPath(e.target.value)}
                aria-label="Vault radar JSON path"
                className="min-w-0 flex-1 rounded-xl bg-[var(--bg-canvas)] px-2.5 py-1.5 font-mono text-base sm:w-48 sm:flex-initial sm:text-[11px] text-[var(--text-primary)] shadow-xs focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)]"
              />
              <button
                type="button"
                disabled={saving || Boolean(jsonError)}
                onClick={() => void handleSaveVault()}
                className="key-depth inline-flex shrink-0 items-center gap-1 rounded-xl bg-[var(--button-primary-bg)] px-3.5 py-1.5 font-bold text-[var(--button-primary-fg)] hover:opacity-90 disabled:opacity-50"
              >
                <Save className="h-3.5 w-3.5" />
                <span>{saving ? 'Saving...' : 'Save to Vault'}</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {saveMessage && (
        <div className="rounded-2xl bg-[var(--bg-hover)] px-3.5 py-2 text-xs font-medium text-[var(--accent-primary)] shadow-xs">
          {saveMessage}
        </div>
      )}

      {/* Mobile Studio Mode Switcher */}
      <div
        role="group"
        aria-label="Radar studio mobile pane"
        className="grid grid-cols-2 rounded-2xl bg-[var(--bg-card)] p-1 text-xs text-[var(--fg-card)] shadow-sm lg:hidden"
      >
        <button
          type="button"
          onClick={() => setMobilePane('editor')}
          aria-pressed={mobilePane === 'editor'}
          className={`rounded-xl py-1.5 px-3 font-bold transition-all ${
            mobilePane === 'editor'
              ? 'bg-[var(--fg-card)] text-[var(--bg-card)] shadow-xs'
              : 'text-[var(--fg-card)] opacity-80 hover:opacity-100'
          }`}
        >
          Editor
        </button>
        <button
          type="button"
          onClick={() => setMobilePane('preview')}
          aria-pressed={mobilePane === 'preview'}
          className={`rounded-xl py-1.5 px-3 font-bold transition-all ${
            mobilePane === 'preview'
              ? 'bg-[var(--fg-card)] text-[var(--bg-card)] shadow-xs'
              : 'text-[var(--fg-card)] opacity-80 hover:opacity-100'
          }`}
        >
          Live Preview
        </button>
      </div>

      {/* Split-Screen Authoring + Live Preview */}
      <div className="grid min-h-0 flex-1 grid-cols-1 gap-3 lg:grid-cols-12">
        {/* Left Pane: Visual Builder / JSON Input */}
        <div
          className={`min-h-0 flex-1 flex-col overflow-hidden rounded-2xl bg-[var(--bg-surface)] shadow-md lg:col-span-5 lg:min-h-[440px] ${
            mobilePane === 'editor' ? 'flex' : 'hidden lg:flex'
          }`}
        >
          <div
            style={{ boxShadow: 'var(--header-shadow)' }}
            className="relative z-10 flex items-center justify-between bg-[var(--bg-surface)] px-3.5 py-2.5 text-xs"
          >
            <div className="inline-flex rounded-xl bg-[var(--bg-canvas)] p-0.5 shadow-xs">
              <button
                type="button"
                onClick={() => {
                  setTab('visual');
                  setJsonText(serializeRadarJson(doc));
                }}
                className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1 font-bold transition-colors ${
                  tab === 'visual'
                    ? 'bg-[var(--button-primary-bg)] text-[var(--button-primary-fg)]'
                    : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                }`}
              >
                <Wand2 className="h-3 w-3" />
                <span>Visual Builder</span>
              </button>
              <button
                type="button"
                onClick={() => setTab('json')}
                className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1 font-bold transition-colors ${
                  tab === 'json'
                    ? 'bg-[var(--button-primary-bg)] text-[var(--button-primary-fg)]'
                    : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                }`}
              >
                <Code2 className="h-3 w-3" />
                <span>JSON Input</span>
              </button>
            </div>

            <button
              type="button"
              onClick={handleLoadShorthandExample}
              className="text-[11px] font-medium text-[var(--accent-primary)] hover:underline"
            >
              Load Shorthand Example
            </button>
          </div>

          {tab === 'json' ? (
            <div className="flex min-h-0 flex-1 flex-col gap-2 p-3 text-xs">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-[11px] text-[var(--text-muted)]">
                  Paste shorthand (<code className="text-[var(--accent-primary)]">{`{ "adopt": [{ "title": "item1" }] }`}</code>) or canonical <code className="text-[var(--accent-primary)]">genforge-radar</code> JSON.
                </p>
                <button
                  type="button"
                  onClick={handleFormatCanonical}
                  className="inline-flex items-center gap-1 rounded-xl bg-[var(--bg-canvas)] px-2.5 py-1 text-[11px] font-medium text-[var(--text-secondary)] shadow-xs hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]"
                >
                  <FileJson className="h-3 w-3" />
                  <span>Format Canonical JSON</span>
                </button>
              </div>

              {jsonError ? (
                <div
                  role="alert"
                  className="rounded-xl bg-rose-500/15 px-3 py-2 text-[11px] text-rose-300 shadow-xs"
                >
                  {jsonError}
                </div>
              ) : (
                <div className="rounded-xl bg-[var(--bg-hover)] px-3 py-1.5 text-[11px] font-medium text-[var(--accent-primary)] shadow-xs">
                  Detected: genforge-radar · {doc.steps.length} steps · {totalItems} items
                  {jsonNotice ? ` — ${jsonNotice}` : ''}
                </div>
              )}

              <textarea
                aria-label="Radar JSON editor"
                value={jsonText}
                onChange={(e) => handleJsonChange(e.target.value)}
                spellCheck={false}
                className="min-h-[240px] flex-1 resize-none rounded-2xl bg-[var(--bg-canvas)] p-3.5 font-mono text-base sm:min-h-[300px] sm:text-[12px] leading-relaxed text-[var(--text-primary)] shadow-xs focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)]"
              />
            </div>
          ) : (
            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-3 text-xs">
              {/* Metadata */}
              <div className="space-y-2 rounded-2xl bg-[var(--bg-canvas)] p-3.5 shadow-xs">
                <div className="grid gap-2 sm:grid-cols-2">
                  <label className="block">
                    <span className="mb-1 block text-[11px] text-[var(--text-muted)]">
                      Radar Title
                    </span>
                    <input
                      type="text"
                      value={doc.title}
                      onChange={(e) =>
                        commitDoc((p) => ({ ...p, title: e.target.value }))
                      }
                      className="w-full rounded-xl bg-[var(--bg-surface)] px-2.5 py-1.5 text-base sm:text-xs text-[var(--text-primary)] shadow-xs focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)]"
                    />
                  </label>
                  <label className="block">
                    <span className="mb-1 block text-[11px] text-[var(--text-muted)]">
                      Subtitle
                    </span>
                    <input
                      type="text"
                      value={doc.subtitle ?? ''}
                      onChange={(e) =>
                        commitDoc((p) => ({
                          ...p,
                          subtitle: e.target.value || undefined,
                        }))
                      }
                      placeholder="Optional edition or date"
                      className="w-full rounded-xl bg-[var(--bg-surface)] px-2.5 py-1.5 text-base sm:text-xs text-[var(--text-primary)] shadow-xs focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)]"
                    />
                  </label>
                </div>
              </div>

              {/* Steps / Rings */}
              <div className="space-y-2 rounded-2xl bg-[var(--bg-canvas)] p-3.5 shadow-xs">
                <div className="flex items-center justify-between">
                  <span className="font-semibold tracking-wide text-[var(--text-muted)] uppercase">
                    Steps / Rings (Inner → Outer)
                  </span>
                  <button
                    type="button"
                    onClick={handleAddStep}
                    className="inline-flex items-center gap-1 rounded-lg bg-[var(--bg-surface)] px-2.5 py-1 text-[11px] font-medium text-[var(--accent-primary)] shadow-xs hover:bg-[var(--bg-hover)]"
                  >
                    <Plus className="h-3 w-3" />
                    <span>Add Step</span>
                  </button>
                </div>

                <div className="space-y-1.5">
                  {doc.steps.map((step, idx) => (
                    <div
                      key={step.id}
                      className="flex items-center gap-1.5 rounded-xl bg-[var(--bg-surface)] p-2 shadow-xs"
                    >
                      <input
                        type="color"
                        value={step.color}
                        aria-label={`Color for ${step.label}`}
                        onChange={(e) =>
                          commitDoc((p) => ({
                            ...p,
                            steps: p.steps.map((s) =>
                              s.id === step.id
                                ? { ...s, color: e.target.value }
                                : s,
                            ),
                          }))
                        }
                        className="h-6 w-7 shrink-0 cursor-pointer rounded border-0 bg-transparent p-0"
                      />
                      <input
                        type="text"
                        value={step.label}
                        onChange={(e) =>
                          commitDoc((p) => ({
                            ...p,
                            steps: p.steps.map((s) =>
                              s.id === step.id
                                ? { ...s, label: e.target.value }
                                : s,
                            ),
                          }))
                        }
                        className="min-w-0 flex-1 rounded-lg bg-[var(--bg-canvas)] px-2 py-1 text-xs font-semibold text-[var(--text-primary)]"
                      />
                      <button
                        type="button"
                        disabled={idx === 0}
                        onClick={() => handleReorderStep(idx, -1)}
                        aria-label="Move step inward"
                        className="rounded p-1 text-[var(--text-muted)] hover:text-[var(--text-primary)] disabled:opacity-30"
                      >
                        <ArrowUp className="h-3 w-3" />
                      </button>
                      <button
                        type="button"
                        disabled={idx === doc.steps.length - 1}
                        onClick={() => handleReorderStep(idx, 1)}
                        aria-label="Move step outward"
                        className="rounded p-1 text-[var(--text-muted)] hover:text-[var(--text-primary)] disabled:opacity-30"
                      >
                        <ArrowDown className="h-3 w-3" />
                      </button>
                      <button
                        type="button"
                        disabled={doc.steps.length <= 1}
                        onClick={() => handleDeleteStep(step.id)}
                        aria-label={`Remove step ${step.label}`}
                        className="rounded p-1 text-[var(--text-muted)] hover:text-rose-400 disabled:opacity-30"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Quadrants */}
              <div className="space-y-2 rounded-2xl bg-[var(--bg-canvas)] p-3.5 shadow-xs">
                <div className="flex items-center justify-between">
                  <label className="flex items-center gap-2 font-semibold tracking-wide text-[var(--text-muted)] uppercase">
                    <input
                      type="checkbox"
                      checked={doc.quadrants.length > 0}
                      onChange={(e) => handleToggleQuadrants(e.target.checked)}
                    />
                    <span>Quadrants ({doc.quadrants.length})</span>
                  </label>
                  {doc.quadrants.length > 0 && (
                    <button
                      type="button"
                      onClick={handleAddQuadrant}
                      className="inline-flex items-center gap-1 rounded-lg bg-[var(--bg-surface)] px-2.5 py-1 text-[11px] font-medium text-[var(--accent-primary)] shadow-xs hover:bg-[var(--bg-hover)]"
                    >
                      <Plus className="h-3 w-3" />
                      <span>Add Quadrant</span>
                    </button>
                  )}
                </div>

                {doc.quadrants.length > 0 && (
                  <div className="grid gap-1.5 sm:grid-cols-2">
                    {doc.quadrants.map((q) => (
                      <div
                        key={q.id}
                        className="flex items-center gap-1 rounded-xl bg-[var(--bg-surface)] p-1.5 shadow-xs"
                      >
                        <input
                          type="text"
                          value={q.name}
                          onChange={(e) =>
                            commitDoc((p) => ({
                              ...p,
                              quadrants: p.quadrants.map((item) =>
                                item.id === q.id
                                  ? { ...item, name: e.target.value }
                                  : item,
                              ),
                            }))
                          }
                          className="min-w-0 flex-1 rounded-lg bg-[var(--bg-canvas)] px-2 py-1 text-xs text-[var(--text-primary)]"
                        />
                        <button
                          type="button"
                          onClick={() =>
                            commitDoc((p) => ({
                              ...p,
                              quadrants: p.quadrants.filter((item) => item.id !== q.id),
                            }))
                          }
                          aria-label={`Remove quadrant ${q.name}`}
                          className="rounded p-1 text-[var(--text-muted)] hover:text-rose-400"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Items per Step */}
              <div className="space-y-3 rounded-2xl bg-[var(--bg-canvas)] p-3.5 shadow-xs">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-semibold tracking-wide text-[var(--text-muted)] uppercase">
                    Step Items
                  </span>
                  <button
                    type="button"
                    onClick={() => setBulkOpen((b) => !b)}
                    className="inline-flex items-center gap-1 rounded-lg bg-[var(--bg-surface)] px-2.5 py-1 text-[11px] font-medium text-[var(--accent-primary)] shadow-xs hover:bg-[var(--bg-hover)]"
                  >
                    <ListPlus className="h-3 w-3" />
                    <span>Bulk Paste</span>
                  </button>
                </div>

                <div className="flex flex-wrap gap-1.5">
                  {doc.steps.map((s) => {
                    const count = (doc.items[s.id] ?? []).length;
                    const active = s.id === resolvedStepId;
                    return (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => setActiveStepId(s.id)}
                        style={
                          active
                            ? { backgroundColor: `${s.color}24`, color: s.color }
                            : undefined
                        }
                        className={`rounded-xl px-2.5 py-1 text-[11px] font-bold shadow-xs transition-colors ${
                          active
                            ? ''
                            : 'bg-[var(--bg-surface)] text-[var(--text-muted)] hover:text-[var(--text-primary)]'
                        }`}
                      >
                        {s.label} ({count})
                      </button>
                    );
                  })}
                </div>

                {bulkOpen && (
                  <div className="space-y-1.5 rounded-xl bg-[var(--bg-surface)] p-2.5 shadow-xs">
                    <textarea
                      rows={4}
                      value={bulkText}
                      onChange={(e) => setBulkText(e.target.value)}
                      placeholder="Paste one item title per line..."
                      className="w-full rounded-xl bg-[var(--bg-canvas)] p-2.5 text-xs text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)]"
                    />
                    <div className="flex justify-end gap-1.5">
                      <button
                        type="button"
                        onClick={() => setBulkOpen(false)}
                        className="rounded-lg px-2.5 py-1 text-[11px] text-[var(--text-secondary)]"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={handleBulkAdd}
                        className="rounded-lg bg-[var(--button-primary-bg)] px-2.5 py-1 text-[11px] font-bold text-[var(--button-primary-fg)]"
                      >
                        Add Lines
                      </button>
                    </div>
                  </div>
                )}

                <form
                  onSubmit={handleAddItem}
                  className="space-y-2 rounded-xl bg-[var(--bg-surface)] p-3 shadow-xs"
                >
                  <div className="flex flex-col gap-1.5 sm:flex-row">
                    <input
                      type="text"
                      value={newTitle}
                      onChange={(e) => setNewTitle(e.target.value)}
                      placeholder="New item title..."
                      aria-label="New item title"
                      className="min-w-0 flex-1 rounded-xl bg-[var(--bg-canvas)] px-2.5 py-1.5 text-base sm:text-xs text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)]"
                    />
                    <div className="flex gap-1.5">
                      {doc.quadrants.length > 0 && (
                        <select
                          value={newQuadrant}
                          onChange={(e) => setNewQuadrant(e.target.value)}
                          aria-label="New item quadrant"
                          className="min-w-0 flex-1 rounded-xl bg-[var(--bg-canvas)] px-2 py-1.5 text-xs text-[var(--text-primary)] sm:flex-initial"
                        >
                          {doc.quadrants.map((q) => (
                            <option key={q.id} value={q.id}>
                              {q.name}
                            </option>
                          ))}
                        </select>
                      )}
                      <button
                        type="submit"
                        disabled={!newTitle.trim()}
                        className="inline-flex shrink-0 items-center justify-center gap-1 rounded-xl bg-[var(--button-primary-bg)] px-3 py-1.5 text-xs font-bold text-[var(--button-primary-fg)] disabled:opacity-50"
                      >
                        <Plus className="h-3.5 w-3.5" />
                        <span>Add</span>
                      </button>
                    </div>
                  </div>

                  <div className="grid gap-1.5 sm:grid-cols-3">
                    <input
                      type="text"
                      value={newDescription}
                      onChange={(e) => setNewDescription(e.target.value)}
                      placeholder="Short note (optional)"
                      className="rounded-lg bg-[var(--bg-canvas)] px-2 py-1 text-[11px] text-[var(--text-primary)]"
                    />
                    <input
                      type="text"
                      value={newLink}
                      onChange={(e) => setNewLink(e.target.value)}
                      placeholder="Vault path or URL"
                      className="rounded-lg bg-[var(--bg-canvas)] px-2 py-1 text-[11px] text-[var(--text-primary)]"
                    />
                    <div className="flex gap-1">
                      <input
                        type="text"
                        value={newTags}
                        onChange={(e) => setNewTags(e.target.value)}
                        placeholder="tags, comma"
                        className="min-w-0 flex-1 rounded-lg bg-[var(--bg-canvas)] px-2 py-1 text-[11px] text-[var(--text-primary)]"
                      />
                      <select
                        value={newMovement}
                        onChange={(e) =>
                          setNewMovement(e.target.value as RadarMovement)
                        }
                        aria-label="Movement badge"
                        className="rounded-lg bg-[var(--bg-canvas)] px-1.5 py-1 text-[11px] text-[var(--text-primary)]"
                      >
                        <option value="same">● Steady</option>
                        <option value="new">◆ New</option>
                        <option value="up">▲ Moved In</option>
                        <option value="down">▼ Moved Out</option>
                      </select>
                    </div>
                  </div>
                </form>

                <ul className="max-h-64 space-y-1.5 overflow-y-auto">
                  {(doc.items[resolvedStepId] ?? []).map((item) => {
                    const isEditing = editingItemId === item.id;
                    return (
                      <li
                        key={item.id}
                        className="rounded-xl bg-[var(--bg-surface)] p-2.5 shadow-xs"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <button
                            type="button"
                            onClick={() =>
                              setEditingItemId(isEditing ? null : item.id)
                            }
                            className="min-w-0 flex-1 truncate text-left font-medium text-[var(--text-primary)] hover:text-[var(--accent-primary)]"
                          >
                            {item.title}
                          </button>

                          <select
                            value={resolvedStepId}
                            onChange={(e) =>
                              handleMoveItem(
                                item.id,
                                resolvedStepId,
                                e.target.value,
                              )
                            }
                            aria-label={`Move ${item.title} to step`}
                            className="rounded-lg bg-[var(--bg-canvas)] px-2 py-0.5 text-[10px] text-[var(--text-secondary)]"
                          >
                            {doc.steps.map((s) => (
                              <option key={s.id} value={s.id}>
                                {s.label}
                              </option>
                            ))}
                          </select>

                          <button
                            type="button"
                            onClick={() =>
                              handleDeleteItem(resolvedStepId, item.id)
                            }
                            aria-label={`Delete ${item.title}`}
                            className="rounded p-1 text-[var(--text-muted)] hover:text-rose-400"
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>
                        </div>

                        {isEditing && (
                          <div className="mt-2 space-y-1.5 pt-2">
                            <input
                              type="text"
                              value={item.title}
                              onChange={(e) =>
                                handleUpdateItem(resolvedStepId, item.id, {
                                  title: e.target.value,
                                })
                              }
                              className="w-full rounded-lg bg-[var(--bg-canvas)] px-2 py-1 text-xs text-[var(--text-primary)]"
                            />
                            <input
                              type="text"
                              value={item.description ?? ''}
                              onChange={(e) =>
                                handleUpdateItem(resolvedStepId, item.id, {
                                  description: e.target.value || undefined,
                                })
                              }
                              placeholder="Description..."
                              className="w-full rounded-lg bg-[var(--bg-canvas)] px-2 py-1 text-[11px] text-[var(--text-primary)]"
                            />
                            {doc.quadrants.length > 0 && (
                              <select
                                value={item.quadrant ?? doc.quadrants[0]?.id}
                                onChange={(e) =>
                                  handleUpdateItem(resolvedStepId, item.id, {
                                    quadrant: e.target.value,
                                  })
                                }
                                className="w-full rounded-lg bg-[var(--bg-canvas)] px-2 py-1 text-[11px] text-[var(--text-primary)]"
                              >
                                {doc.quadrants.map((q) => (
                                  <option key={q.id} value={q.id}>
                                    {q.name}
                                  </option>
                                ))}
                              </select>
                            )}
                          </div>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </div>
            </div>
          )}
        </div>

        {/* Right Pane: Live Interactive Preview */}
        <div
          className={`min-h-[280px] flex-1 flex-col lg:col-span-7 lg:min-h-[440px] ${
            mobilePane === 'preview' ? 'flex' : 'hidden lg:flex'
          }`}
        >
          <RadarChart
            doc={doc}
            layout={layout}
            selectedItemId={selectedItemId}
            hoveredItemId={hoveredItemId}
            activeStepIds={allStepIds}
            matchedItemIds={null}
            focusedQuadrantIndex={focusedQuadrantIndex}
            labelMode={labelMode}
            dragToRerate
            onChangeLabelMode={setLabelMode}
            onSelectItem={(b) => setSelectedItemId(b?.item.id ?? null)}
            onHoverItem={setHoveredItemId}
            onFocusQuadrant={setFocusedQuadrantIndex}
            onMoveItem={handleMoveItem}
          />
        </div>
      </div>
    </div>
  );
}
