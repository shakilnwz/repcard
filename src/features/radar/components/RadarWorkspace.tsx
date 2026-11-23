import {
  ExternalLink,
  FileJson,
  FolderInput,
  Pencil,
  Plus,
  RadarIcon,
  Search,
  Sparkles,
  Trash2,
  Upload,
  X,
} from '@/shared/ui/MaterialIcons';
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type DragEvent,
} from 'react';
import { RadarChart } from '@/features/radar/components/RadarChart';
import { RadarCreator } from '@/features/radar/components/RadarCreator';
import { computeRadarLayout, type PlacedBlip } from '@/features/radar/lib/radarLayout';
import { AI_RADAR_PRESET, STARTER_RADAR_TEMPLATE } from '@/features/radar/lib/radarPresets';
import {
  convertCanvasToRadar,
  parseRadarJson,
  slugifyRadarKey,
} from '@/features/radar/lib/radarSchema';
import {
  deleteLocalCustomRadar,
  getLocalCustomRadars,
  listVaultRadarFiles,
  readEntryText,
  saveLocalCustomRadar,
  saveLocalEdit,
  saveRadarFileToVault,
} from '@/features/vault/lib/vaultService';
import { useAppStore } from '@/shared/store/useAppStore';
import type {
  RadarDocument,
  RadarLabelMode,
  SavedCustomRadar,
} from '@/features/radar/types/radar';
import type { VaultFileEntry } from '@/features/vault/types/vault';

interface RadarWorkspaceProps {
  entries: VaultFileEntry[];
  initialDocument?: RadarDocument | null;
  initialFilePath?: string | null;
  onSaveVaultFile?: (doc: RadarDocument) => Promise<void>;
  embedded?: boolean;
}

const BUILTIN_RADAR: SavedCustomRadar = {
  id: 'builtin-ai-radar',
  path: 'ai_enginnering/ai-radar.radar.json',
  source: 'builtin',
  updatedAt: 0,
  doc: AI_RADAR_PRESET,
};

const MOVEMENT_LABEL: Record<string, string> = {
  new: '◆ New',
  up: '▲ Moved In',
  down: '▼ Moved Out',
  same: '● Steady',
};

export function RadarWorkspace({
  entries,
  initialDocument = null,
  initialFilePath = null,
  onSaveVaultFile,
  embedded = false,
}: RadarWorkspaceProps) {
  const vaultSource = useAppStore((s) => s.vaultSource);
  const syncedEntries = useAppStore((s) => s.syncedEntries);
  const navigateToPath = useAppStore((s) => s.navigateToPath);
  const setStageView = useAppStore((s) => s.setStageView);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [vaultRadars, setVaultRadars] = useState<SavedCustomRadar[]>([]);
  const [localRadars, setLocalRadars] = useState<SavedCustomRadar[]>([]);
  const [uploadedRadars, setUploadedRadars] = useState<SavedCustomRadar[]>([]);
  const [activeId, setActiveId] = useState<string>(
    initialDocument ? '__embedded__' : BUILTIN_RADAR.id,
  );
  const [embeddedDoc, setEmbeddedDoc] = useState<RadarDocument | null>(
    initialDocument,
  );

  // Studio / Creator state
  const [creatorDoc, setCreatorDoc] = useState<RadarDocument | null>(null);
  const [creatorPath, setCreatorPath] = useState<string | undefined>(undefined);
  const [creatorEditingId, setCreatorEditingId] = useState<string | null>(null);

  // Interactive filter & selection state
  const [searchQuery, setSearchQuery] = useState('');
  const [activeStepIds, setActiveStepIds] = useState<Set<string> | null>(null);
  const [activeTag, setActiveTag] = useState<string | null>(null);
  const [focusedQuadrantIndex, setFocusedQuadrantIndex] = useState<number | null>(
    null,
  );
  const [labelMode, setLabelMode] = useState<RadarLabelMode>('auto');
  const [dragToRerate, setDragToRerate] = useState(false);
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [hoveredItemId, setHoveredItemId] = useState<string | null>(null);
  const [groupBy, setGroupBy] = useState<'step' | 'quadrant'>('step');
  const [notice, setNotice] = useState<string | null>(null);
  const [errorBanner, setErrorBanner] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);

  useEffect(() => {
    setEmbeddedDoc(initialDocument ?? null);
    if (initialDocument) {
      setActiveId('__embedded__');
    }
  }, [initialDocument, initialFilePath]);

  const refreshRadars = useCallback(async () => {
    const [vaultFound, localFound] = await Promise.all([
      listVaultRadarFiles(),
      getLocalCustomRadars(),
    ]);

    const mappedVault: SavedCustomRadar[] = vaultFound.map((v) => ({
      id: `vault:${v.path}`,
      path: v.path,
      source: 'vault',
      updatedAt: v.updatedAt,
      doc: v.doc,
    }));

    setVaultRadars(mappedVault);
    setLocalRadars(localFound);

    if (!initialDocument) {
      setActiveId((prev) => {
        if (prev === BUILTIN_RADAR.id && mappedVault.length > 0) {
          const matching = mappedVault.find(
            (r) => r.path === 'ai_enginnering/ai-radar.radar.json',
          );
          return matching ? matching.id : mappedVault[0].id;
        }
        return prev;
      });
    }
  }, [initialDocument]);

  useEffect(() => {
    if (embedded) return;
    void refreshRadars();
  }, [embedded, vaultSource, syncedEntries, refreshRadars]);

  const allSources = useMemo(() => {
    const hasVaultBuiltinCopy = vaultRadars.some(
      (v) => v.path === BUILTIN_RADAR.path,
    );
    return [
      ...vaultRadars,
      ...(hasVaultBuiltinCopy ? [] : [BUILTIN_RADAR]),
      ...localRadars,
      ...uploadedRadars,
    ];
  }, [vaultRadars, localRadars, uploadedRadars]);

  const activeSource = useMemo(() => {
    if (embedded && embeddedDoc) {
      return {
        id: '__embedded__',
        path: initialFilePath ?? undefined,
        source: 'vault' as const,
        updatedAt: Date.now(),
        doc: embeddedDoc,
      };
    }
    return allSources.find((s) => s.id === activeId) ?? BUILTIN_RADAR;
  }, [embedded, embeddedDoc, initialFilePath, allSources, activeId]);

  const activeDoc = activeSource.doc;
  const layout = useMemo(() => computeRadarLayout(activeDoc), [activeDoc]);

  const effectiveActiveSteps = useMemo(() => {
    if (activeStepIds === null) {
      return new Set(activeDoc.steps.map((s) => s.id));
    }
    const valid = new Set(
      activeDoc.steps
        .map((s) => s.id)
        .filter((id) => activeStepIds.has(id)),
    );
    return valid.size > 0
      ? valid
      : new Set(activeDoc.steps.map((s) => s.id));
  }, [activeStepIds, activeDoc.steps]);

  const matchedItemIds = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q && !activeTag) return null;
    const set = new Set<string>();
    for (const blip of layout.blips) {
      const matchesTag =
        !activeTag || Boolean(blip.item.tags?.includes(activeTag));
      const matchesQuery =
        !q ||
        blip.item.title.toLowerCase().includes(q) ||
        (blip.item.description ?? '').toLowerCase().includes(q) ||
        (blip.item.tags ?? []).some((t) => t.toLowerCase().includes(q)) ||
        (blip.quadrant?.name ?? '').toLowerCase().includes(q);
      if (matchesTag && matchesQuery) {
        set.add(blip.item.id);
      }
    }
    return set;
  }, [layout.blips, searchQuery, activeTag]);

  const directoryBlips = useMemo(() => {
    return layout.blips.filter((b) => {
      if (!effectiveActiveSteps.has(b.step.id)) return false;
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
  }, [
    layout.blips,
    layout.sectors.length,
    effectiveActiveSteps,
    focusedQuadrantIndex,
    matchedItemIds,
  ]);

  const selectedBlip = useMemo(
    () =>
      selectedItemId
        ? layout.blips.find((b) => b.item.id === selectedItemId) ?? null
        : null,
    [selectedItemId, layout.blips],
  );

  // Reset filters when switching documents
  useEffect(() => {
    setActiveStepIds(null);
    setActiveTag(null);
    setSearchQuery('');
    setFocusedQuadrantIndex(null);
    setSelectedItemId(null);
    setHoveredItemId(null);
  }, [activeSource.id]);

  const canvasOptions = useMemo(
    () => entries.filter((e) => e.kind === 'canvas' && !e.isHidden),
    [entries],
  );

  const handleToggleStepPill = (stepId: string) => {
    setActiveStepIds((prev) => {
      const allIds = activeDoc.steps.map((s) => s.id);
      if (prev === null) {
        return new Set([stepId]);
      }
      const next = new Set(prev);
      if (next.has(stepId)) {
        next.delete(stepId);
        if (next.size === 0) return null;
      } else {
        next.add(stepId);
      }
      return next.size === allIds.length ? null : next;
    });
  };

  const loadRawFileContent = async (fileName: string, rawText: string) => {
    setErrorBanner(null);
    setNotice(null);

    if (fileName.toLowerCase().endsWith('.canvas')) {
      try {
        const converted = convertCanvasToRadar(
          rawText,
          fileName.replace(/\.canvas$/i, ''),
        );
        const id = `uploaded-${Date.now().toString(36)}`;
        setUploadedRadars((prev) => [
          {
            id,
            path: fileName,
            source: 'uploaded',
            updatedAt: Date.now(),
            doc: converted,
          },
          ...prev,
        ]);
        setActiveId(id);
        setNotice(`Converted Canvas "${fileName}" into interactive radar.`);
      } catch (err) {
        setErrorBanner(
          err instanceof Error
            ? `Unable to convert canvas: ${err.message}`
            : 'Unable to convert canvas file.',
        );
      }
      return;
    }

    // Check explicit type first, then allow shorthand JSON when explicitly picked/dropped
    const strict = parseRadarJson(rawText, { allowUntypedShorthand: false });
    const parsed = strict.ok
      ? strict
      : parseRadarJson(rawText, { allowUntypedShorthand: true });

    if (!parsed.ok) {
      setErrorBanner(`"${fileName}": ${parsed.error}`);
      return;
    }

    const id = `uploaded-${Date.now().toString(36)}`;
    setUploadedRadars((prev) => [
      {
        id,
        path: fileName,
        source: 'uploaded',
        updatedAt: Date.now(),
        doc: parsed.doc,
      },
      ...prev,
    ]);
    setActiveId(id);
    setNotice(
      strict.ok
        ? `Auto-detected "${parsed.doc.type}" JSON (${fileName}).`
        : `Loaded shorthand radar JSON (${fileName}).`,
    );
  };

  const handleFileInput = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const text = await file.text();
    await loadRawFileContent(file.name, text);
  };

  const handleDrop = async (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (!file) return;
    const text = await file.text();
    await loadRawFileContent(file.name, text);
  };

  const handleImportCanvas = async (canvasPath: string) => {
    if (vaultSource === 'preview') {
      setActiveId(BUILTIN_RADAR.id);
      setNotice('Loaded built-in AI Radar preset from AI Radar.canvas.');
      return;
    }
    try {
      const raw = await readEntryText(canvasPath);
      if (!raw) {
        setErrorBanner(`Unable to read ${canvasPath}.`);
        return;
      }
      const converted = convertCanvasToRadar(
        raw,
        canvasPath.split('/').pop()?.replace(/\.canvas$/i, '') || 'Canvas Radar',
      );
      const id = `uploaded-${Date.now().toString(36)}`;
      setUploadedRadars((prev) => [
        {
          id,
          path: canvasPath,
          source: 'uploaded',
          updatedAt: Date.now(),
          doc: converted,
        },
        ...prev,
      ]);
      setActiveId(id);
      setNotice(`Imported ${canvasPath} into interactive radar.`);
    } catch (err) {
      setErrorBanner(
        err instanceof Error ? err.message : 'Unable to import canvas file.',
      );
    }
  };

  const handleMoveActiveItem = async (
    itemId: string,
    fromStepId: string,
    toStepId: string,
    toQuadrantId?: string,
  ) => {
    const fromList = activeDoc.items[fromStepId] ?? [];
    const found = fromList.find((it) => it.id === itemId);
    if (!found) return;

    const updatedItem = {
      ...found,
      ...(toQuadrantId !== undefined ? { quadrant: toQuadrantId } : {}),
    };

    const nextItems = { ...activeDoc.items };
    if (fromStepId === toStepId) {
      nextItems[fromStepId] = fromList.map((it) =>
        it.id === itemId ? updatedItem : it,
      );
    } else {
      nextItems[fromStepId] = fromList.filter((it) => it.id !== itemId);
      nextItems[toStepId] = [...(nextItems[toStepId] ?? []), updatedItem];
    }

    const nextDoc: RadarDocument = {
      ...activeDoc,
      items: nextItems,
    };

    if (embedded && onSaveVaultFile) {
      setEmbeddedDoc(nextDoc);
      await onSaveVaultFile(nextDoc);
      setNotice(`Updated "${found.title}" in ${initialFilePath ?? 'file'}.`);
      return;
    }

    if (activeSource.source === 'vault' && activeSource.path) {
      await saveLocalEdit(activeSource.path, JSON.stringify(nextDoc, null, 2));
      await refreshRadars();
      setNotice(`Updated "${found.title}" in ${activeSource.path}.`);
    } else if (activeSource.source === 'local') {
      const nextList = await saveLocalCustomRadar({
        ...activeSource,
        updatedAt: Date.now(),
        doc: nextDoc,
      });
      setLocalRadars(nextList);
      setNotice(`Updated "${found.title}".`);
    } else if (activeSource.source === 'uploaded') {
      setUploadedRadars((prev) =>
        prev.map((r) => (r.id === activeSource.id ? { ...r, doc: nextDoc } : r)),
      );
    }
  };

  const handleOpenLink = (link: string) => {
    if (/^https?:\/\//i.test(link)) {
      window.open(link, '_blank', 'noopener,noreferrer');
      return;
    }
    setStageView('document');
    navigateToPath(link);
  };

  const canDirectRerate =
    embedded ||
    activeSource.source === 'vault' ||
    activeSource.source === 'local' ||
    activeSource.source === 'uploaded';

  if (creatorDoc) {
    return (
      <RadarCreator
        initialDoc={creatorDoc}
        initialPath={creatorPath}
        canSaveToVault={vaultSource !== 'preview'}
        onSaveToVault={async (savePath, nextDoc) => {
          if (embedded && onSaveVaultFile && savePath === initialFilePath) {
            await onSaveVaultFile(nextDoc);
            setEmbeddedDoc(nextDoc);
            setCreatorDoc(null);
            return;
          }
          const createdPath = await saveRadarFileToVault(savePath, nextDoc);
          await refreshRadars();
          if (embedded && onSaveVaultFile) {
            setEmbeddedDoc(nextDoc);
          } else {
            setActiveId(`vault:${createdPath}`);
          }
          setCreatorDoc(null);
          setNotice(`Saved "${createdPath}" to vault.`);
        }}
        onSaveLocal={async (nextDoc) => {
          const id =
            creatorEditingId ||
            `local-${slugifyRadarKey(nextDoc.title)}-${Date.now().toString(36)}`;
          const saved: SavedCustomRadar = {
            id,
            source: 'local',
            updatedAt: Date.now(),
            doc: nextDoc,
          };
          const nextList = await saveLocalCustomRadar(saved);
          setLocalRadars(nextList);
          if (!embedded) {
            setActiveId(id);
          } else {
            setEmbeddedDoc(nextDoc);
          }
          setCreatorDoc(null);
          setNotice(`Saved "${nextDoc.title}" locally.`);
        }}
        onCancel={() => setCreatorDoc(null)}
      />
    );
  }

  return (
    <div
      data-testid="radar-workspace"
      onDragOver={(e) => {
        if (embedded) return;
        e.preventDefault();
        setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => {
        if (!embedded) void handleDrop(e);
      }}
      className={`flex h-full min-h-0 flex-col gap-3 ${
        dragOver ? 'ring-2 ring-[var(--accent-primary)] rounded-2xl' : ''
      }`}
    >
      {/* Top Picker & Studio Action Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-[var(--bg-surface)] px-3.5 py-2.5 text-xs shadow-sm">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <div className="flex items-center gap-1.5 font-bold text-[var(--text-primary)]">
            <RadarIcon className="h-4 w-4 shrink-0 text-[var(--accent-primary)]" />
            <span className="truncate">{activeDoc.title}</span>
          </div>

          {activeDoc.subtitle && (
            <span className="hidden text-[11px] text-[var(--text-muted)] md:inline">
              · {activeDoc.subtitle}
            </span>
          )}

          {!embedded && (
            <div className="flex items-center gap-1.5">
              <select
                aria-label="Select radar JSON dataset"
                value={activeSource.id}
                onChange={(e) => setActiveId(e.target.value)}
                className="max-w-[230px] rounded-xl bg-[var(--bg-canvas)] px-2.5 py-1.5 text-xs font-medium text-[var(--text-primary)] shadow-xs focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)]"
              >
                {allSources.map((src) => (
                  <option key={src.id} value={src.id}>
                    {src.doc.title} (
                    {src.source === 'vault'
                      ? 'Vault'
                      : src.source === 'builtin'
                        ? 'Preset'
                        : src.source === 'local'
                          ? 'Local'
                          : 'Picked'}
                    )
                  </option>
                ))}
              </select>

              {activeSource.source === 'local' && (
                <button
                  type="button"
                  onClick={() => {
                    void deleteLocalCustomRadar(activeSource.id).then((next) => {
                      setLocalRadars(next);
                      setActiveId(BUILTIN_RADAR.id);
                    });
                  }}
                  title="Delete saved local radar"
                  aria-label="Delete saved local radar"
                  className="rounded-lg p-1.5 text-[var(--text-muted)] hover:text-rose-400"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          {!embedded && (
            <>
              <input
                ref={fileInputRef}
                type="file"
                accept=".json,.canvas,application/json"
                onChange={(e) => void handleFileInput(e)}
                className="hidden"
                aria-label="Pick radar JSON file"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="inline-flex items-center gap-1 rounded-xl bg-[var(--bg-canvas)] px-3 py-1.5 font-medium text-[var(--text-secondary)] shadow-xs hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]"
              >
                <Upload className="h-3.5 w-3.5 text-[var(--accent-primary)]" />
                <span>Pick .json</span>
              </button>

              {canvasOptions.length > 0 && vaultSource !== 'preview' && (
                <button
                  type="button"
                  onClick={() => {
                    const preferred =
                      canvasOptions.find((c) =>
                        c.path.toLowerCase().includes('radar'),
                      ) ?? canvasOptions[0];
                    void handleImportCanvas(preferred.path);
                  }}
                  className="inline-flex items-center gap-1 rounded-xl bg-[var(--bg-canvas)] px-3 py-1.5 font-medium text-[var(--text-secondary)] shadow-xs hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]"
                >
                  <FolderInput className="h-3.5 w-3.5 text-[var(--accent-primary)]" />
                  <span className="hidden sm:inline">Import .canvas</span>
                </button>
              )}

              <button
                type="button"
                onClick={() => {
                  setCreatorDoc(STARTER_RADAR_TEMPLATE);
                  setCreatorPath(undefined);
                  setCreatorEditingId(null);
                }}
                className="inline-flex items-center gap-1 rounded-xl bg-[var(--bg-canvas)] px-3 py-1.5 font-medium text-[var(--text-secondary)] shadow-xs hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]"
              >
                <Plus className="h-3.5 w-3.5 text-[var(--accent-primary)]" />
                <span>Create New</span>
              </button>
            </>
          )}

          <button
            type="button"
            onClick={() => {
              setCreatorDoc(activeDoc);
              setCreatorPath(activeSource.path);
              setCreatorEditingId(
                activeSource.source === 'local' ? activeSource.id : null,
              );
            }}
            className="key-depth inline-flex items-center gap-1 rounded-xl bg-[var(--button-primary-bg)] px-3.5 py-1.5 font-bold text-[var(--button-primary-fg)] hover:opacity-90"
          >
            <Pencil className="h-3.5 w-3.5" />
            <span>Edit in Studio</span>
          </button>
        </div>
      </div>

      {notice && (
        <div className="flex items-center justify-between rounded-2xl bg-[var(--bg-hover)] px-3.5 py-2 text-xs text-[var(--accent-primary)] shadow-xs">
          <span className="flex items-center gap-1.5">
            <FileJson className="h-3.5 w-3.5" />
            {notice}
          </span>
          <button
            type="button"
            onClick={() => setNotice(null)}
            aria-label="Dismiss notice"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {errorBanner && (
        <div
          role="alert"
          className="flex items-center justify-between rounded-2xl bg-rose-500/15 px-3.5 py-2 text-xs text-rose-300 shadow-xs"
        >
          <span>{errorBanner}</span>
          <button
            type="button"
            onClick={() => setErrorBanner(null)}
            aria-label="Dismiss error"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* Search & Step Filter Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-[var(--bg-surface)] px-3.5 py-2.5 text-xs shadow-sm">
        <div className="relative min-w-[190px] flex-1 max-w-sm">
          <Search className="pointer-events-none absolute top-1/2 left-3 h-3.5 w-3.5 -translate-y-1/2 text-[var(--text-muted)]" />
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Filter blips, tags, descriptions..."
            aria-label="Filter radar blips"
            className="w-full rounded-xl bg-[var(--bg-canvas)] py-1.5 pr-7 pl-8 text-xs text-[var(--text-primary)] placeholder:text-[var(--text-muted)] shadow-xs focus:outline-none focus:ring-2 focus:ring-[var(--accent-primary)]"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              aria-label="Clear radar filter"
              className="absolute top-1/2 right-2.5 -translate-y-1/2 text-[var(--text-muted)] hover:text-[var(--text-primary)]"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          {activeDoc.steps.map((step) => {
            const count = (activeDoc.items[step.id] ?? []).length;
            const active = effectiveActiveSteps.has(step.id);
            return (
              <button
                key={step.id}
                type="button"
                onClick={() => handleToggleStepPill(step.id)}
                title={step.description || step.label}
                style={{
                  color: active ? step.color : 'var(--text-muted)',
                  backgroundColor: active ? `${step.color}22` : 'var(--bg-canvas)',
                }}
                className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-bold tracking-wide uppercase shadow-xs transition-all"
              >
                <span
                  className="h-2 w-2 rounded-full"
                  style={{ backgroundColor: step.color }}
                />
                <span>{step.label}</span>
                <span className="tabular-nums opacity-80">{count}</span>
              </button>
            );
          })}

          {activeTag && (
            <button
              type="button"
              onClick={() => setActiveTag(null)}
              className="inline-flex items-center gap-1 rounded-full bg-[var(--bg-hover)] px-2.5 py-0.5 text-[11px] font-medium text-[var(--accent-primary)]"
            >
              <span>#{activeTag}</span>
              <X className="h-3 w-3" />
            </button>
          )}

          {(activeStepIds !== null || activeTag || searchQuery.trim()) && (
            <button
              type="button"
              onClick={() => {
                setActiveStepIds(null);
                setActiveTag(null);
                setSearchQuery('');
              }}
              className="text-[11px] font-medium text-[var(--text-muted)] hover:text-[var(--text-primary)]"
            >
              Reset
            </button>
          )}
        </div>
      </div>

      {/* Main Chart + Synchronized Directory & Detail Inspector */}
      <div className="grid min-h-0 flex-1 grid-cols-1 gap-3 lg:grid-cols-12">
        <div className="min-h-[460px] lg:col-span-8">
          <RadarChart
            doc={activeDoc}
            layout={layout}
            selectedItemId={selectedItemId}
            hoveredItemId={hoveredItemId}
            activeStepIds={effectiveActiveSteps}
            matchedItemIds={matchedItemIds}
            focusedQuadrantIndex={focusedQuadrantIndex}
            labelMode={labelMode}
            dragToRerate={dragToRerate}
            onChangeLabelMode={setLabelMode}
            onToggleDragToRerate={canDirectRerate ? setDragToRerate : undefined}
            onSelectItem={(b: PlacedBlip | null) =>
              setSelectedItemId(b?.item.id ?? null)
            }
            onHoverItem={setHoveredItemId}
            onFocusQuadrant={setFocusedQuadrantIndex}
            onToggleStepFilter={handleToggleStepPill}
            onMoveItem={
              canDirectRerate
                ? (id, from, to, quad) => void handleMoveActiveItem(id, from, to, quad)
                : undefined
            }
          />
        </div>

        {/* Synchronized Directory & Item Detail Panel */}
        <aside className="flex min-h-[340px] flex-col overflow-hidden rounded-2xl bg-[var(--bg-surface)] shadow-md lg:col-span-4">
          <div
            style={{ boxShadow: 'var(--header-shadow)' }}
            className="relative z-10 flex items-center justify-between bg-[var(--bg-surface)] px-3.5 py-2.5 text-xs"
          >
            <span className="font-semibold text-[var(--text-primary)]">
              Directory ({directoryBlips.length})
            </span>

            {activeDoc.quadrants.length > 0 && (
              <div className="inline-flex rounded-xl bg-[var(--bg-canvas)] p-0.5 text-[11px] shadow-xs">
                <button
                  type="button"
                  onClick={() => setGroupBy('step')}
                  className={`rounded-lg px-2.5 py-0.5 font-medium ${
                    groupBy === 'step'
                      ? 'bg-[var(--button-primary-bg)] font-bold text-[var(--button-primary-fg)]'
                      : 'text-[var(--text-secondary)]'
                  }`}
                >
                  By Step
                </button>
                <button
                  type="button"
                  onClick={() => setGroupBy('quadrant')}
                  className={`rounded-lg px-2.5 py-0.5 font-medium ${
                    groupBy === 'quadrant'
                      ? 'bg-[var(--button-primary-bg)] font-bold text-[var(--button-primary-fg)]'
                      : 'text-[var(--text-secondary)]'
                  }`}
                >
                  By Quadrant
                </button>
              </div>
            )}
          </div>

          <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-3 text-xs">
            {directoryBlips.length === 0 ? (
              <p className="py-6 text-center text-[var(--text-muted)]">
                No radar blips match the active filters.
              </p>
            ) : groupBy === 'step' || activeDoc.quadrants.length === 0 ? (
              activeDoc.steps.map((step) => {
                const group = directoryBlips.filter((b) => b.step.id === step.id);
                if (group.length === 0) return null;
                return (
                  <div key={step.id} className="space-y-1">
                    <div
                      className="flex items-center justify-between text-[11px] font-bold tracking-wide uppercase"
                      style={{ color: step.color }}
                    >
                      <span>{step.label}</span>
                      <span className="tabular-nums opacity-75">{group.length}</span>
                    </div>
                    <ul className="space-y-1">
                      {group.map((blip) => {
                        const active =
                          selectedItemId === blip.item.id ||
                          hoveredItemId === blip.item.id;
                        return (
                          <li key={blip.item.id}>
                            <button
                              type="button"
                              onMouseEnter={() => setHoveredItemId(blip.item.id)}
                              onMouseLeave={() => setHoveredItemId(null)}
                              onClick={() => setSelectedItemId(blip.item.id)}
                              className={`flex w-full items-center justify-between gap-2 rounded-xl px-2.5 py-1.5 text-left transition-colors ${
                                active
                                  ? 'bg-[var(--bg-elevated)] font-semibold text-[var(--accent-primary)] shadow-xs'
                                  : 'text-[var(--text-primary)] hover:bg-[var(--bg-hover)]'
                              }`}
                            >
                              <span className="flex min-w-0 items-center gap-2">
                                <span
                                  className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold"
                                  style={{
                                    backgroundColor: `${blip.step.color}24`,
                                    color: blip.step.color,
                                  }}
                                >
                                  {blip.number}
                                </span>
                                <span className="truncate">{blip.item.title}</span>
                              </span>
                              {blip.quadrant && (
                                <span className="shrink-0 text-[10px] text-[var(--text-muted)]">
                                  {blip.quadrant.name.split(' ')[0]}
                                </span>
                              )}
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                );
              })
            ) : (
              activeDoc.quadrants.map((quad) => {
                const group = directoryBlips.filter(
                  (b) => b.quadrant?.id === quad.id,
                );
                if (group.length === 0) return null;
                return (
                  <div key={quad.id} className="space-y-1">
                    <div className="flex items-center justify-between text-[11px] font-bold tracking-wide text-[var(--text-secondary)] uppercase">
                      <span>{quad.name}</span>
                      <span className="tabular-nums text-[var(--text-muted)]">
                        {group.length}
                      </span>
                    </div>
                    <ul className="space-y-1">
                      {group.map((blip) => {
                        const active =
                          selectedItemId === blip.item.id ||
                          hoveredItemId === blip.item.id;
                        return (
                          <li key={blip.item.id}>
                            <button
                              type="button"
                              onMouseEnter={() => setHoveredItemId(blip.item.id)}
                              onMouseLeave={() => setHoveredItemId(null)}
                              onClick={() => setSelectedItemId(blip.item.id)}
                              className={`flex w-full items-center justify-between gap-2 rounded-xl px-2.5 py-1.5 text-left transition-colors ${
                                active
                                  ? 'bg-[var(--bg-elevated)] font-semibold text-[var(--accent-primary)] shadow-xs'
                                  : 'text-[var(--text-primary)] hover:bg-[var(--bg-hover)]'
                              }`}
                            >
                              <span className="flex min-w-0 items-center gap-2">
                                <span
                                  className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold"
                                  style={{
                                    backgroundColor: `${blip.step.color}24`,
                                    color: blip.step.color,
                                  }}
                                >
                                  {blip.number}
                                </span>
                                <span className="truncate">{blip.item.title}</span>
                              </span>
                              <span
                                className="shrink-0 text-[10px] font-semibold uppercase"
                                style={{ color: blip.step.color }}
                              >
                                {blip.step.label}
                              </span>
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                );
              })
            )}
          </div>

          {/* Selected Item Detail Card */}
          {selectedBlip ? (
            <div
              data-testid="radar-detail-card"
              className="space-y-2 bg-[var(--bg-canvas)] p-3.5 text-xs shadow-sm"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span
                      className="rounded-full px-2 py-0.5 text-[10px] font-bold uppercase"
                      style={{
                        backgroundColor: `${selectedBlip.step.color}22`,
                        color: selectedBlip.step.color,
                      }}
                    >
                      #{selectedBlip.number} · {selectedBlip.step.label}
                    </span>
                    {selectedBlip.quadrant && (
                      <span className="rounded-full bg-[var(--bg-elevated)] px-2 py-0.5 text-[10px] text-[var(--text-secondary)]">
                        {selectedBlip.quadrant.name}
                      </span>
                    )}
                    {selectedBlip.item.movement &&
                      selectedBlip.item.movement !== 'same' && (
                        <span className="rounded-full bg-[var(--bg-elevated)] px-2 py-0.5 text-[10px] text-[var(--accent-primary)]">
                          {MOVEMENT_LABEL[selectedBlip.item.movement]}
                        </span>
                      )}
                  </div>
                  <h3 className="mt-1.5 text-sm font-bold text-[var(--text-primary)]">
                    {selectedBlip.item.title}
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedItemId(null)}
                  aria-label="Close item detail"
                  className="rounded p-1 text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>

              {selectedBlip.item.description && (
                <p className="leading-relaxed text-[var(--text-secondary)]">
                  {selectedBlip.item.description}
                </p>
              )}

              {canDirectRerate && (
                <div className="flex items-center gap-2">
                  <span className="text-[11px] text-[var(--text-muted)]">
                    Re-rate ring:
                  </span>
                  <select
                    value={selectedBlip.step.id}
                    aria-label="Re-rate selected item step"
                    onChange={(e) =>
                      void handleMoveActiveItem(
                        selectedBlip.item.id,
                        selectedBlip.step.id,
                        e.target.value,
                      )
                    }
                    className="rounded-lg bg-[var(--bg-surface)] px-2.5 py-1 text-[11px] font-semibold text-[var(--text-primary)] shadow-xs focus:outline-none"
                  >
                    {activeDoc.steps.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.label}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {selectedBlip.item.tags && selectedBlip.item.tags.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {selectedBlip.item.tags.map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setActiveTag(t === activeTag ? null : t)}
                      className="rounded-lg bg-[var(--bg-surface)] px-2 py-0.5 text-[10px] text-[var(--text-secondary)] shadow-xs hover:bg-[var(--bg-hover)] hover:text-[var(--accent-primary)]"
                    >
                      #{t}
                    </button>
                  ))}
                </div>
              )}

              {selectedBlip.item.link && (
                <button
                  type="button"
                  onClick={() => handleOpenLink(selectedBlip.item.link!)}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-[var(--bg-hover)] px-3 py-1.5 text-[11px] font-semibold text-[var(--accent-primary)] hover:opacity-90"
                >
                  <ExternalLink className="h-3 w-3" />
                  <span>Open {selectedBlip.item.link}</span>
                </button>
              )}
            </div>
          ) : (
            <div className="bg-[var(--bg-canvas)] px-3.5 py-2.5 text-[11px] text-[var(--text-muted)]">
              <span className="inline-flex items-center gap-1">
                <Sparkles className="h-3 w-3 text-[var(--accent-primary)]" />
                <span>
                  Click any blip or list item to inspect notes, tags, and linked roadmaps.
                </span>
              </span>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
