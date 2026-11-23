import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Columns2,
  Download,
  Eye,
  HardDrive,
  Network,
  Pencil,
  Pin,
  PinOff,
  Radar,
  Sparkles,
} from '@/shared/ui/MaterialIcons';
import {
  Component,
  lazy,
  Suspense,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ErrorInfo,
  type ReactNode,
} from 'react';
import { toggleCanvasNodeCheckbox, toggleMarkdownCheckboxAtIndex } from '@/features/editor/lib/checklist';
import { AI_RADAR_PRESET } from '@/features/radar/lib/radarPresets';
import { parseRadarJson, serializeRadarJson } from '@/features/radar/lib/radarSchema';
import { VaultHome } from '@/features/vault/components/VaultHome';
import { toArrayBuffer } from '@/features/vault/lib/binaryStore';
import {
  getVaultBacklinks,
  readEntryBinary,
  readEntryText,
  recordRecentFile,
  saveLocalEdit,
  togglePinnedFile,
} from '@/features/vault/lib/vaultService';
import type { VaultFileEntry } from '@/features/vault/types/vault';
import { formatBytes } from '@/shared/lib/format';
import { useAppStore } from '@/shared/store/useAppStore';

const MarkdownEditor = lazy(() =>
  import('@/features/editor/components/MarkdownEditor').then((m) => ({
    default: m.MarkdownEditor,
  })),
);
const GraphView = lazy(() =>
  import('@/features/graph/components/GraphView').then((m) => ({
    default: m.GraphView,
  })),
);
const RadarWorkspace = lazy(() =>
  import('@/features/radar/components/RadarWorkspace').then((m) => ({
    default: m.RadarWorkspace,
  })),
);

const MarkdownViewer = lazy(() =>
  import('@/features/renderers/components/MarkdownViewer').then((m) => ({
    default: m.MarkdownViewer,
  })),
);
const CanvasViewer = lazy(() =>
  import('@/features/renderers/components/CanvasViewer').then((m) => ({
    default: m.CanvasViewer,
  })),
);
const PdfViewer = lazy(() =>
  import('@/features/renderers/components/PdfViewer').then((m) => ({
    default: m.PdfViewer,
  })),
);
const ImageViewer = lazy(() =>
  import('@/features/renderers/components/ImageViewer').then((m) => ({
    default: m.ImageViewer,
  })),
);
const CodeViewer = lazy(() =>
  import('@/features/renderers/components/CodeViewer').then((m) => ({
    default: m.CodeViewer,
  })),
);

interface RendererErrorBoundaryProps {
  resetKey: string;
  children: ReactNode;
}

interface RendererErrorBoundaryState {
  hasError: boolean;
  message: string;
}

class RendererErrorBoundary extends Component<
  RendererErrorBoundaryProps,
  RendererErrorBoundaryState
> {
  state: RendererErrorBoundaryState = { hasError: false, message: '' };

  static getDerivedStateFromError(error: Error): RendererErrorBoundaryState {
    return { hasError: true, message: error.message || 'Renderer error' };
  }

  componentDidUpdate(prevProps: RendererErrorBoundaryProps) {
    if (prevProps.resetKey !== this.props.resetKey && this.state.hasError) {
      this.setState({ hasError: false, message: '' });
    }
  }

  componentDidCatch(_error: Error, _info: ErrorInfo) {
    // Error captured cleanly by boundary UI
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="rounded-2xl bg-rose-500/15 p-4 text-xs text-rose-300 shadow-xs">
          <div className="flex items-center gap-2 font-semibold">
            <AlertTriangle className="h-4 w-4" />
            <span>Unable to render document</span>
          </div>
          <p className="mt-1">{this.state.message}</p>
        </div>
      );
    }
    return this.props.children;
  }
}

interface DocumentStageProps {
  entries: VaultFileEntry[];
}

function phaseNoticeForKind(kind: VaultFileEntry['kind']): string {
  switch (kind) {
    case 'markdown':
      return 'Connect a GitHub repo or Local Folder to render live frontmatter properties, Obsidian callouts, wikilinks, Shiki code blocks, and Mermaid flowcharts offline.';
    case 'canvas':
      return 'Connect your vault to open this JSON Canvas inside the pan/zoom DOM/SVG Hybrid Canvas Engine.';
    case 'pdf':
      return 'Connect your vault to lazy-fetch PDFs on demand and read them offline via pdfjs-dist.';
    case 'image':
      return 'Connect your vault to lazy-cache images offline in OPFS / IndexedDB and open the zoom lightbox.';
    case 'code':
      return 'Connect your vault to view source files with Shiki syntax highlighting offline.';
    default:
      return 'File metadata indexed in the workspace.';
  }
}

export function DocumentStage({ entries }: DocumentStageProps) {
  const activePath = useAppStore((s) => s.activePath);
  const authSession = useAppStore((s) => s.authSession);
  const vaultSource = useAppStore((s) => s.vaultSource);
  const lastSyncedAt = useAppStore((s) => s.lastSyncedAt);
  const navHistory = useAppStore((s) => s.navHistory);
  const navIndex = useAppStore((s) => s.navIndex);
  const editorMode = useAppStore((s) => s.editorMode);
  const stageView = useAppStore((s) => s.stageView);
  const vimMode = useAppStore((s) => s.vimMode);
  const outboxEdits = useAppStore((s) => s.outboxEdits);
  const pinnedFiles = useAppStore((s) => s.pinnedFiles);

  const setActivePath = useAppStore((s) => s.setActivePath);
  const navigateToPath = useAppStore((s) => s.navigateToPath);
  const navigateBack = useAppStore((s) => s.navigateBack);
  const navigateForward = useAppStore((s) => s.navigateForward);
  const setActiveHeadings = useAppStore((s) => s.setActiveHeadings);
  const setActiveBacklinks = useAppStore((s) => s.setActiveBacklinks);
  const setOnboardingOpen = useAppStore((s) => s.setOnboardingOpen);
  const setEditorMode = useAppStore((s) => s.setEditorMode);
  const setStageView = useAppStore((s) => s.setStageView);
  const setVimMode = useAppStore((s) => s.setVimMode);
  const setConflictModalOpen = useAppStore((s) => s.setConflictModalOpen);

  const [textContent, setTextContent] = useState<string | null>(null);
  const [draftContent, setDraftContent] = useState<string | null>(null);
  const [savingEdit, setSavingEdit] = useState(false);
  const prevLoadedPathRef = useRef<string | null>(null);
  const [binaryState, setBinaryState] = useState<{
    bytes: Uint8Array;
    url: string;
    mimeType: string;
    byteLength: number;
    fromCache: boolean;
  } | null>(null);
  const [contentLoading, setContentLoading] = useState(false);
  const [contentError, setContentError] = useState<string | null>(null);
  const [jsonViewerTab, setJsonViewerTab] = useState<'radar' | 'raw'>('radar');

  const allPaths = useMemo(() => entries.map((e) => e.path), [entries]);

  const selectedEntry = useMemo(
    () => entries.find((e) => e.path === activePath) ?? null,
    [entries, activePath],
  );

  const detectedRadar = useMemo(() => {
    if (!selectedEntry || selectedEntry.ext !== 'json' || textContent === null) {
      return null;
    }
    const parsed = parseRadarJson(textContent, { allowUntypedShorthand: false });
    return parsed.ok ? parsed.doc : null;
  }, [selectedEntry, textContent]);

  const isPreviewRadar =
    vaultSource === 'preview' &&
    selectedEntry?.path === 'ai_enginnering/ai-radar.radar.json';

  const canGoBack = navIndex > 0;
  const canGoForward = navIndex < navHistory.length - 1;

  const activeOutbox = useMemo(
    () =>
      selectedEntry
        ? outboxEdits.find((e) => e.path === selectedEntry.path) ?? null
        : null,
    [outboxEdits, selectedEntry],
  );
  const isPinned = Boolean(selectedEntry && pinnedFiles.includes(selectedEntry.path));

  // Record recently opened files in persisted history
  useEffect(() => {
    if (!selectedEntry || vaultSource === 'preview') return;
    void recordRecentFile(selectedEntry.path);
  }, [selectedEntry?.path, vaultSource]);

  // Revoke object URL when switching files or unmounting
  useEffect(() => {
    const currentUrl = binaryState?.url;
    return () => {
      if (currentUrl && typeof URL.revokeObjectURL === 'function') {
        URL.revokeObjectURL(currentUrl);
      }
    };
  }, [binaryState?.url]);

  // Load content & backlinks on file selection
  useEffect(() => {
    let cancelled = false;
    const nextPath = selectedEntry?.path ?? null;
    const pathChanged = prevLoadedPathRef.current !== nextPath;
    prevLoadedPathRef.current = nextPath;

    if (pathChanged) {
      setTextContent(null);
      setDraftContent(null);
      setBinaryState(null);
      setJsonViewerTab('radar');
    }
    setContentError(null);

    if (!selectedEntry || vaultSource === 'preview') {
      setActiveHeadings([]);
      setActiveBacklinks([]);
      return;
    }

    if (selectedEntry.kind !== 'markdown') {
      setActiveHeadings([]);
    }

    void getVaultBacklinks(selectedEntry.path).then((links) => {
      if (!cancelled) setActiveBacklinks(links);
    });

    if (!selectedEntry.isBinary) {
      if (pathChanged) setContentLoading(true);
      void readEntryText(selectedEntry.path)
        .then((content) => {
          if (!cancelled) {
            setTextContent(content);
            setDraftContent(content);
          }
        })
        .catch((err) => {
          if (!cancelled) {
            setContentError(
              err instanceof Error ? err.message : 'Unable to read file content.',
            );
          }
        })
        .finally(() => {
          if (!cancelled) setContentLoading(false);
        });
    } else if (selectedEntry.isCached && pathChanged) {
      setContentLoading(true);
      void readEntryBinary(selectedEntry.path)
        .then((res) => {
          if (cancelled) return;
          const blob = new Blob([toArrayBuffer(res.bytes)], {
            type: res.mimeType,
          });
          const url = URL.createObjectURL(blob);
          setBinaryState({
            bytes: res.bytes,
            url,
            mimeType: res.mimeType,
            byteLength: res.bytes.byteLength,
            fromCache: res.fromCache,
          });
        })
        .catch((err) => {
          if (!cancelled) {
            setContentError(
              err instanceof Error ? err.message : 'Unable to load binary cache.',
            );
          }
        })
        .finally(() => {
          if (!cancelled) setContentLoading(false);
        });
    }

    return () => {
      cancelled = true;
    };
  }, [
    selectedEntry?.path,
    selectedEntry?.blobSha,
    selectedEntry?.isCached,
    selectedEntry?.kind,
    activeOutbox?.status,
    lastSyncedAt,
    vaultSource,
    setActiveHeadings,
    setActiveBacklinks,
  ]);

  const handleLoadBinaryOnDemand = async () => {
    if (!selectedEntry) return;
    setContentLoading(true);
    setContentError(null);
    try {
      const res = await readEntryBinary(selectedEntry.path);
      const blob = new Blob([toArrayBuffer(res.bytes)], { type: res.mimeType });
      const url = URL.createObjectURL(blob);
      setBinaryState({
        bytes: res.bytes,
        url,
        mimeType: res.mimeType,
        byteLength: res.bytes.byteLength,
        fromCache: res.fromCache,
      });
    } catch (err) {
      setContentError(
        err instanceof Error ? err.message : 'Failed to download binary asset.',
      );
    } finally {
      setContentLoading(false);
    }
  };

  const handleSaveEditorContent = async (nextContent: string) => {
    if (!selectedEntry || vaultSource === 'preview') return;
    setSavingEdit(true);
    setContentError(null);
    try {
      await saveLocalEdit(selectedEntry.path, nextContent);
      setTextContent(nextContent);
      setDraftContent(nextContent);
    } catch (err) {
      setContentError(
        err instanceof Error ? err.message : 'Failed to persist local edit.',
      );
    } finally {
      setSavingEdit(false);
    }
  };

  const handleToggleMarkdownTask = async (taskIndex: number) => {
    if (!selectedEntry || vaultSource === 'preview') return;
    const source = draftContent ?? textContent;
    if (source === null) return;
    const toggled = toggleMarkdownCheckboxAtIndex(source, taskIndex);
    if (!toggled.changed) return;
    setTextContent(toggled.content);
    setDraftContent(toggled.content);
    try {
      await saveLocalEdit(selectedEntry.path, toggled.content);
    } catch (err) {
      setContentError(
        err instanceof Error ? err.message : 'Failed to update checklist item.',
      );
    }
  };

  const handleToggleCanvasTask = async (nodeId: string, taskIndex: number) => {
    if (!selectedEntry || vaultSource === 'preview' || textContent === null) return;
    const toggled = toggleCanvasNodeCheckbox(textContent, nodeId, taskIndex);
    if (!toggled.changed) return;
    setTextContent(toggled.content);
    try {
      await saveLocalEdit(selectedEntry.path, toggled.content);
    } catch (err) {
      setContentError(
        err instanceof Error ? err.message : 'Failed to update canvas checklist.',
      );
    }
  };

  if (stageView === 'graph') {
    return (
      <div className="flex h-full flex-col gap-3 p-3 sm:p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setStageView('document')}
              className="inline-flex items-center gap-1.5 rounded-xl bg-[var(--bg-surface)] px-3 py-1.5 text-xs font-medium text-[var(--text-secondary)] shadow-xs hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              <span>{selectedEntry ? 'Back to Document' : 'Workspace Overview'}</span>
            </button>
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-[var(--text-primary)]">
              <Network className="h-4 w-4 text-[var(--accent-primary)]" />
              <span>Interactive Knowledge Graph</span>
            </span>
          </div>
        </div>
        <div className="min-h-[420px] flex-1">
          <RendererErrorBoundary resetKey="global-graph">
            <Suspense
              fallback={
                <div className="flex h-full items-center justify-center rounded-2xl bg-[var(--bg-surface)] text-xs text-[var(--text-muted)] shadow-sm">
                  Building vault force graph...
                </div>
              }
            >
              <GraphView mode="global" centerPath={activePath} />
            </Suspense>
          </RendererErrorBoundary>
        </div>
      </div>
    );
  }

  if (stageView === 'radar') {
    return (
      <div className="flex h-full flex-col gap-3 p-3 sm:p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setStageView('document')}
              className="inline-flex items-center gap-1.5 rounded-xl bg-[var(--bg-surface)] px-3 py-1.5 text-xs font-medium text-[var(--text-secondary)] shadow-xs hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              <span>{selectedEntry ? 'Back to Document' : 'Workspace Overview'}</span>
            </button>
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-[var(--text-primary)]">
              <Radar className="h-4 w-4 text-[var(--accent-primary)]" />
              <span>Interactive Radar & Studio</span>
            </span>
          </div>
        </div>
        <div className="min-h-[460px] flex-1">
          <RendererErrorBoundary resetKey="radar-workspace">
            <Suspense
              fallback={
                <div className="flex h-full items-center justify-center rounded-2xl bg-[var(--bg-surface)] text-xs text-[var(--text-muted)] shadow-sm">
                  Loading Interactive Radar Engine...
                </div>
              }
            >
              <RadarWorkspace entries={entries} />
            </Suspense>
          </RendererErrorBoundary>
        </div>
      </div>
    );
  }

  if (!selectedEntry) {
    return <VaultHome entries={entries} />;
  }

  const isCanvasLive =
    vaultSource !== 'preview' && selectedEntry.kind === 'canvas';
  const isRadarLive = Boolean(
    isPreviewRadar || (detectedRadar && jsonViewerTab === 'radar'),
  );
  const isSplitLive =
    vaultSource !== 'preview' &&
    selectedEntry.kind === 'markdown' &&
    editorMode === 'split';

  return (
    <div
      className={
        isCanvasLive || isRadarLive
          ? 'flex h-full flex-col gap-3 p-3 sm:p-4'
          : isSplitLive
            ? 'mx-auto max-w-6xl p-4 sm:p-6 lg:p-8'
            : 'mx-auto max-w-4xl p-4 sm:p-6 lg:p-8'
      }
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={navigateBack}
            disabled={!canGoBack}
            aria-label="Navigate back"
            title="Back ([)"
            className="rounded-xl bg-[var(--bg-surface)] p-1.5 text-[var(--text-secondary)] shadow-xs hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)] disabled:opacity-40"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={navigateForward}
            disabled={!canGoForward}
            aria-label="Navigate forward"
            title="Forward (])"
            className="rounded-xl bg-[var(--bg-surface)] p-1.5 text-[var(--text-secondary)] shadow-xs hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)] disabled:opacity-40"
          >
            <ArrowRight className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={() => setActivePath(null)}
            className="inline-flex items-center gap-1.5 rounded-xl bg-[var(--bg-surface)] px-3 py-1.5 text-xs font-medium text-[var(--text-secondary)] shadow-xs hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]"
          >
            <span>Workspace Overview</span>
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full bg-[var(--accent-primary)]/15 px-2.5 py-0.5 text-[11px] font-semibold tracking-wide text-[var(--accent-primary)] uppercase">
            {selectedEntry.kind}
          </span>
          <span className="rounded-full bg-[var(--bg-elevated)] px-2.5 py-0.5 text-[11px] tabular-nums text-[var(--text-secondary)]">
            {formatBytes(selectedEntry.size)}
          </span>
          {typeof selectedEntry.taskTotal === 'number' &&
            selectedEntry.taskTotal > 0 && (
              <span className="rounded-full bg-[var(--bg-hover)] px-2.5 py-0.5 text-[11px] font-medium tabular-nums text-[var(--accent-highlight)]">
                {selectedEntry.taskDone ?? 0} / {selectedEntry.taskTotal} tasks
              </span>
            )}
          {vaultSource !== 'preview' && (
            <span
              className={`rounded-full px-2.5 py-0.5 text-[11px] font-medium ${
                selectedEntry.isCached || textContent !== null
                  ? 'bg-[var(--bg-hover)] text-[var(--accent-primary)]'
                  : 'bg-amber-500/15 text-amber-300'
              }`}
            >
              {selectedEntry.isCached || textContent !== null
                ? 'Cached Offline'
                : 'On-Demand (Not Cached)'}
            </span>
          )}
          {activeOutbox && (
            <button
              type="button"
              onClick={() => {
                if (activeOutbox.status === 'conflict') {
                  setConflictModalOpen(true);
                }
              }}
              className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
                activeOutbox.status === 'conflict'
                  ? 'bg-rose-500/20 text-rose-300 underline'
                  : 'bg-amber-500/20 text-amber-300'
              }`}
            >
              {activeOutbox.status === 'conflict' ? 'Sync Conflict — Resolve' : 'Unsynced Edit'}
            </button>
          )}
          {detectedRadar && (
            <div
              role="group"
              aria-label="Radar JSON view mode"
              className="inline-flex rounded-xl bg-[var(--bg-surface)] p-0.5 text-[11px] shadow-xs"
            >
              <button
                type="button"
                onClick={() => setJsonViewerTab('radar')}
                className={`rounded-lg px-2.5 py-0.5 font-bold ${
                  jsonViewerTab === 'radar'
                    ? 'bg-[var(--button-primary-bg)] text-[var(--button-primary-fg)]'
                    : 'text-[var(--text-secondary)]'
                }`}
              >
                Interactive Radar
              </button>
              <button
                type="button"
                onClick={() => setJsonViewerTab('raw')}
                className={`rounded-lg px-2.5 py-0.5 font-medium ${
                  jsonViewerTab === 'raw'
                    ? 'bg-[var(--button-primary-bg)] font-bold text-[var(--button-primary-fg)]'
                    : 'text-[var(--text-secondary)]'
                }`}
              >
                Raw JSON
              </button>
            </div>
          )}
        </div>
      </div>

      {isCanvasLive ? (
        <div className="min-h-0 flex-1">
          {contentLoading ? (
            <div className="flex h-full items-center justify-center rounded-2xl bg-[var(--bg-surface)] text-xs text-[var(--text-secondary)] shadow-sm">
              Loading canvas board...
            </div>
          ) : contentError ? (
            <div className="rounded-2xl bg-rose-500/15 p-4 text-xs text-rose-300 shadow-xs">
              {contentError}
            </div>
          ) : textContent !== null ? (
            <RendererErrorBoundary resetKey={selectedEntry.path}>
              <Suspense
                fallback={
                  <div className="flex h-full items-center justify-center rounded-2xl bg-[var(--bg-surface)] text-xs text-[var(--text-muted)] shadow-sm">
                    Initializing interactive Canvas Engine...
                  </div>
                }
              >
                <CanvasViewer
                  rawJson={textContent}
                  filePath={selectedEntry.path}
                  allPaths={allPaths}
                  onNavigate={navigateToPath}
                  onToggleCardTask={(nodeId, taskIdx) =>
                    void handleToggleCanvasTask(nodeId, taskIdx)
                  }
                />
              </Suspense>
            </RendererErrorBoundary>
          ) : null}
        </div>
      ) : isRadarLive ? (
        <div className="min-h-0 flex-1">
          <RendererErrorBoundary resetKey={`radar-${selectedEntry.path}`}>
            <Suspense
              fallback={
                <div className="flex h-full items-center justify-center rounded-2xl bg-[var(--bg-surface)] text-xs text-[var(--text-muted)] shadow-sm">
                  Initializing Interactive Radar Engine...
                </div>
              }
            >
              <RadarWorkspace
                embedded
                entries={entries}
                initialDocument={isPreviewRadar ? AI_RADAR_PRESET : detectedRadar}
                initialFilePath={selectedEntry.path}
                onSaveVaultFile={
                  vaultSource !== 'preview'
                    ? async (nextDoc) => {
                        await handleSaveEditorContent(serializeRadarJson(nextDoc));
                      }
                    : undefined
                }
              />
            </Suspense>
          </RendererErrorBoundary>
        </div>
      ) : (
        <div className="mt-4 rounded-3xl bg-[var(--bg-surface)] p-5 shadow-md sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-3 pb-4">
            <div className="min-w-0">
              <h1 className="break-all text-xl font-bold text-[var(--text-primary)] sm:text-2xl">
                {selectedEntry.name}
              </h1>
              <p className="mt-1 break-all font-mono text-xs text-[var(--text-muted)]">
                {selectedEntry.path}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {vaultSource !== 'preview' && (
                <button
                  type="button"
                  onClick={() => void togglePinnedFile(selectedEntry.path)}
                  aria-pressed={isPinned}
                  title={isPinned ? 'Unpin note' : 'Pin note to Dashboard'}
                  className={`inline-flex items-center gap-1 rounded-xl px-2.5 py-1.5 text-xs font-medium shadow-xs transition-colors ${
                    isPinned
                      ? 'bg-amber-500/20 text-amber-300'
                      : 'bg-[var(--bg-canvas)] text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]'
                  }`}
                >
                  {isPinned ? (
                    <PinOff className="h-3.5 w-3.5" />
                  ) : (
                    <Pin className="h-3.5 w-3.5" />
                  )}
                  <span>{isPinned ? 'Pinned' : 'Pin'}</span>
                </button>
              )}

              {vaultSource !== 'preview' && selectedEntry.kind === 'markdown' && (
                <div
                  role="group"
                  aria-label="Editor view mode"
                  className="inline-flex rounded-xl bg-[var(--bg-canvas)] p-0.5 text-xs shadow-xs"
                >
                  <button
                    type="button"
                    onClick={() => setEditorMode('read')}
                    aria-pressed={editorMode === 'read'}
                    className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1 font-medium transition-colors ${
                      editorMode === 'read'
                        ? 'bg-[var(--button-primary-bg)] font-bold text-[var(--button-primary-fg)]'
                        : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                    }`}
                  >
                    <Eye className="h-3 w-3" />
                    <span>Read</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditorMode('edit')}
                    aria-pressed={editorMode === 'edit'}
                    className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1 font-medium transition-colors ${
                      editorMode === 'edit'
                        ? 'bg-[var(--button-primary-bg)] font-bold text-[var(--button-primary-fg)]'
                        : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                    }`}
                  >
                    <Pencil className="h-3 w-3" />
                    <span>Edit</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditorMode('split')}
                    aria-pressed={editorMode === 'split'}
                    className={`hidden sm:inline-flex items-center gap-1 rounded-lg px-2.5 py-1 font-medium transition-colors ${
                      editorMode === 'split'
                        ? 'bg-[var(--button-primary-bg)] font-bold text-[var(--button-primary-fg)]'
                        : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                    }`}
                  >
                    <Columns2 className="h-3 w-3" />
                    <span>Split</span>
                  </button>
                </div>
              )}

              <button
                type="button"
                onClick={() => setOnboardingOpen(true)}
                className="key-depth rounded-xl bg-[var(--button-primary-bg)] px-3.5 py-1.5 text-xs font-bold text-[var(--button-primary-fg)] hover:opacity-90"
              >
                {vaultSource === 'local-fs'
                  ? 'Local Folder Settings'
                  : authSession
                    ? 'Manage Git Sync'
                    : 'Connect to Sync Live Content'}
              </button>
            </div>
          </div>

          {vaultSource === 'preview' ? (
            <div className="mt-5 rounded-2xl bg-[var(--bg-canvas)] p-4 shadow-xs">
              <div className="flex items-center gap-2 text-xs font-semibold tracking-wide text-[var(--accent-secondary)] uppercase">
                <Sparkles className="h-4 w-4" />
                <span>Sample Vault Preview</span>
              </div>
              <p className="mt-2 text-sm leading-relaxed text-[var(--text-secondary)]">
                {phaseNoticeForKind(selectedEntry.kind)}
              </p>
            </div>
          ) : selectedEntry.isBinary ? (
            <div className="mt-5 space-y-4">
              {contentLoading && (
                <div className="rounded-2xl bg-[var(--bg-canvas)] p-4 text-xs text-[var(--text-secondary)] shadow-xs">
                  Loading binary asset...
                </div>
              )}

              {contentError && (
                <div className="rounded-2xl bg-rose-500/15 p-4 text-xs text-rose-300 shadow-xs">
                  {contentError}
                </div>
              )}

              {!binaryState && !contentLoading && (
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-[var(--bg-canvas)] p-4 shadow-xs">
                  <div className="text-xs text-[var(--text-secondary)]">
                    <p className="font-semibold text-[var(--text-primary)]">
                      Lazy On-Demand Binary Asset
                    </p>
                    <p className="mt-1 text-[var(--text-muted)]">
                      Skipped during text sync to save bandwidth (
                      {formatBytes(selectedEntry.size)}). Fetch once to persist offline in OPFS / IndexedDB.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => void handleLoadBinaryOnDemand()}
                    className="key-depth inline-flex items-center gap-1.5 rounded-xl bg-[var(--button-primary-bg)] px-3.5 py-2 text-xs font-bold text-[var(--button-primary-fg)] hover:opacity-90"
                  >
                    <Download className="h-3.5 w-3.5" />
                    <span>Fetch & Cache Offline</span>
                  </button>
                </div>
              )}

              {binaryState && (
                <RendererErrorBoundary resetKey={selectedEntry.path}>
                  <Suspense
                    fallback={
                      <div className="rounded-2xl bg-[var(--bg-canvas)] p-4 text-xs text-[var(--text-muted)] shadow-xs">
                        Initializing viewer...
                      </div>
                    }
                  >
                    {selectedEntry.kind === 'pdf' ? (
                      <PdfViewer
                        filePath={selectedEntry.path}
                        fileName={selectedEntry.name}
                        bytes={binaryState.bytes}
                        url={binaryState.url}
                        fromCache={binaryState.fromCache}
                      />
                    ) : selectedEntry.kind === 'image' ? (
                      <ImageViewer
                        url={binaryState.url}
                        fileName={selectedEntry.name}
                        byteLength={binaryState.byteLength}
                        fromCache={binaryState.fromCache}
                      />
                    ) : (
                      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-[var(--bg-canvas)] p-4 text-xs shadow-xs">
                        <span className="inline-flex items-center gap-1.5 font-semibold text-[var(--accent-primary)]">
                          <HardDrive className="h-3.5 w-3.5" />
                          <span>
                            Persisted Offline ({formatBytes(binaryState.byteLength)} ·{' '}
                            {binaryState.fromCache
                              ? 'Served from Local Cache'
                              : 'Freshly Cached'}
                            )
                          </span>
                        </span>
                        <a
                          href={binaryState.url}
                          download={selectedEntry.name}
                          className="inline-flex items-center gap-1 rounded-xl bg-[var(--button-primary-bg)] px-3 py-1 font-bold text-[var(--button-primary-fg)]"
                        >
                          <Download className="h-3 w-3" />
                          <span>Download</span>
                        </a>
                      </div>
                    )}
                  </Suspense>
                </RendererErrorBoundary>
              )}
            </div>
          ) : (
            <div className="mt-5 space-y-2">
              {contentLoading && (
                <div className="rounded-2xl bg-[var(--bg-canvas)] p-4 text-xs text-[var(--text-secondary)] shadow-xs">
                  Loading document...
                </div>
              )}

              {contentError && (
                <div className="rounded-2xl bg-rose-500/15 p-4 text-xs text-rose-300 shadow-xs">
                  {contentError}
                </div>
              )}

              {textContent !== null && (
                <RendererErrorBoundary resetKey={selectedEntry.path}>
                  <Suspense
                    fallback={
                      <div className="rounded-2xl bg-[var(--bg-canvas)] p-4 text-xs text-[var(--text-muted)] shadow-xs">
                        Initializing rich renderer...
                      </div>
                    }
                  >
                    {selectedEntry.kind === 'markdown' ? (
                      editorMode === 'edit' ? (
                        <MarkdownEditor
                          filePath={selectedEntry.path}
                          initialContent={textContent}
                          vimMode={vimMode}
                          onToggleVim={setVimMode}
                          onChange={setDraftContent}
                          onSave={handleSaveEditorContent}
                          saving={savingEdit}
                        />
                      ) : editorMode === 'split' ? (
                        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                          <MarkdownEditor
                            filePath={selectedEntry.path}
                            initialContent={textContent}
                            vimMode={vimMode}
                            onToggleVim={setVimMode}
                            onChange={setDraftContent}
                            onSave={handleSaveEditorContent}
                            saving={savingEdit}
                          />
                          <div className="max-h-[70vh] overflow-y-auto rounded-2xl bg-[var(--bg-canvas)] p-4 shadow-sm">
                            <MarkdownViewer
                              markdown={draftContent ?? textContent}
                              filePath={selectedEntry.path}
                              allPaths={allPaths}
                              onNavigate={navigateToPath}
                              onHeadingsChange={setActiveHeadings}
                              onToggleTask={(idx) => void handleToggleMarkdownTask(idx)}
                            />
                          </div>
                        </div>
                      ) : (
                        <MarkdownViewer
                          markdown={textContent}
                          filePath={selectedEntry.path}
                          allPaths={allPaths}
                          onNavigate={navigateToPath}
                          onHeadingsChange={setActiveHeadings}
                          onToggleTask={(idx) => void handleToggleMarkdownTask(idx)}
                        />
                      )
                    ) : (
                      <CodeViewer
                        code={textContent}
                        filePath={selectedEntry.path}
                        size={selectedEntry.size}
                      />
                    )}
                  </Suspense>
                </RendererErrorBoundary>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
