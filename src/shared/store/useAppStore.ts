import { create } from 'zustand';
import { createJSONStorage, persist, type StateStorage } from 'zustand/middleware';
import type { OutboxEditRecord } from '@/shared/db/vaultDb';
import { DEFAULT_IGNORE_PATTERNS } from '@/features/vault/lib/ignore';
import type { HeadingItem } from '@/features/editor/lib/markdownPipeline';
import { COLOR_MODES, type ColorPaletteMode } from '@/features/repcard/lib/colorModes';
import { readInitialColorMode } from '@/shared/lib/theme';
import type { BacklinkItem } from '@/shared/lib/wikilinks';
import type {
  AuthMode,
  AuthSession,
  RateLimitInfo,
  RepoConfig,
  SyncProgress,
  SyncState,
  VaultFileEntry,
  VaultSource,
} from '@/features/vault/types/vault';

export type EditorMode = 'read' | 'edit' | 'split';
export type StageView = 'cards' | 'document' | 'graph' | 'radar';

const fallbackMemoryStorage = new Map<string, string>();

const safeStorage: StateStorage = {
  getItem: (name) => {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        return window.localStorage.getItem(name);
      }
    } catch {
      // ignore storage errors
    }
    return fallbackMemoryStorage.get(name) ?? null;
  },
  setItem: (name, value) => {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem(name, value);
        return;
      }
    } catch {
      // ignore storage errors
    }
    fallbackMemoryStorage.set(name, value);
  },
  removeItem: (name) => {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.removeItem(name);
        return;
      }
    } catch {
      // ignore storage errors
    }
    fallbackMemoryStorage.delete(name);
  },
};

function sanitizeAuthSession(
  session: AuthSession | null | undefined,
): AuthSession | null {
  if (!session || typeof session.user !== 'string') return null;
  return {
    user: session.user,
    avatarUrl: session.avatarUrl,
  };
}

function withExpandedParents(
  expandedFolders: string[],
  targetPath: string | null,
): string[] {
  if (!targetPath || !targetPath.includes('/')) return expandedFolders;
  const parts = targetPath.split('/').slice(0, -1);
  const next = new Set(expandedFolders);
  let acc = '';
  for (const part of parts) {
    acc = acc ? `${acc}/${part}` : part;
    next.add(acc);
  }
  return Array.from(next);
}

function pushNavEntry(
  history: Array<string | null>,
  navIndex: number,
  targetPath: string | null,
): { navHistory: Array<string | null>; navIndex: number } {
  if (history[navIndex] === targetPath) {
    return { navHistory: history, navIndex };
  }
  const truncated = history.slice(0, navIndex + 1);
  truncated.push(targetPath);
  if (truncated.length > 50) {
    truncated.shift();
  }
  return {
    navHistory: truncated,
    navIndex: truncated.length - 1,
  };
}

export interface AppState {
  // Persisted UI preferences & non-secret metadata
  colorMode: ColorPaletteMode;
  vimMode: boolean;
  sidebarOpen: boolean;
  inspectorOpen: boolean;
  showHiddenFiles: boolean;
  ignorePatterns: string[];
  repoConfig: RepoConfig;
  authMode: AuthMode;
  authSession: AuthSession | null;
  authError: string | null;
  activePath: string | null;
  expandedFolders: string[];
  treeFilter: string;
  onboardingOpen: boolean;
  settingsOpen: boolean;
  dismissedIosInstall: boolean;

  // Phase 2 runtime & offline sync state (never persisted to localStorage)
  dbHydrated: boolean;
  vaultSource: VaultSource;
  syncedEntries: VaultFileEntry[];
  runtimeToken: string | null;
  vaultLocked: boolean;
  hasPassphraseLock: boolean;
  localFolderName: string | null;
  isOnline: boolean;
  syncState: SyncState;
  syncProgress: SyncProgress | null;
  syncMessage: string | null;
  syncError: string | null;
  lastSyncedAt: number | null;
  lastSyncedCommitSha: string | null;
  rateLimit: RateLimitInfo | null;

  // Phase 3 navigation & document inspector state (runtime only)
  navHistory: Array<string | null>;
  navIndex: number;
  pendingHeadingSlug: string | null;
  activeHeadings: HeadingItem[];
  activeBacklinks: BacklinkItem[];

  // Phase 4 editing, search, graph & dashboard state (runtime only)
  outboxEdits: OutboxEditRecord[];
  editorMode: EditorMode;
  stageView: StageView;
  commandPaletteOpen: boolean;
  conflictModalOpen: boolean;
  pendingCanvasNodeId: string | null;
  recentFiles: string[];
  pinnedFiles: string[];

  // Actions
  setColorMode: (colorMode: ColorPaletteMode) => void;
  cycleColorMode: () => void;
  setVimMode: (enabled: boolean) => void;
  setSidebarOpen: (open: boolean) => void;
  toggleSidebar: () => void;
  setInspectorOpen: (open: boolean) => void;
  toggleInspector: () => void;
  setShowHiddenFiles: (show: boolean) => void;
  setIgnorePatterns: (patterns: string[]) => void;
  setRepoConfig: (config: RepoConfig) => void;
  setAuthMode: (mode: AuthMode) => void;
  setAuthSession: (session: AuthSession | null) => void;
  setAuthError: (error: string | null) => void;
  clearAuthSession: () => void;
  setActivePath: (path: string | null) => void;
  navigateToPath: (path: string | null, headingSlug?: string) => void;
  navigateBack: () => void;
  navigateForward: () => void;
  setPendingHeadingSlug: (slug: string | null) => void;
  setActiveHeadings: (headings: HeadingItem[]) => void;
  setActiveBacklinks: (backlinks: BacklinkItem[]) => void;
  setOutboxEdits: (edits: OutboxEditRecord[]) => void;
  setEditorMode: (mode: EditorMode) => void;
  setStageView: (view: StageView) => void;
  setCommandPaletteOpen: (open: boolean) => void;
  setConflictModalOpen: (open: boolean) => void;
  setPendingCanvasNodeId: (nodeId: string | null) => void;
  setRecentFiles: (paths: string[]) => void;
  setPinnedFiles: (paths: string[]) => void;
  toggleFolder: (folderPath: string) => void;
  expandFolder: (folderPath: string) => void;
  setTreeFilter: (query: string) => void;
  setOnboardingOpen: (open: boolean) => void;
  setSettingsOpen: (open: boolean) => void;
  dismissIosInstallPrompt: () => void;

  setDbHydrated: (hydrated: boolean) => void;
  setVaultSource: (source: VaultSource) => void;
  setSyncedEntries: (entries: VaultFileEntry[]) => void;
  setRuntimeToken: (token: string | null) => void;
  setVaultLocked: (locked: boolean) => void;
  setHasPassphraseLock: (hasLock: boolean) => void;
  setLocalFolderName: (name: string | null) => void;
  setIsOnline: (online: boolean) => void;
  setSyncState: (state: SyncState) => void;
  setSyncProgress: (progress: SyncProgress | null) => void;
  setSyncMessage: (message: string | null) => void;
  setSyncError: (error: string | null) => void;
  setLastSyncedAt: (timestamp: number | null) => void;
  setLastSyncedCommitSha: (sha: string | null) => void;
  setRateLimit: (rateLimit: RateLimitInfo | null) => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      colorMode: readInitialColorMode(),
      vimMode: true,
      sidebarOpen: true,
      inspectorOpen: true,
      showHiddenFiles: false,
      ignorePatterns: DEFAULT_IGNORE_PATTERNS,
      repoConfig: {
        owner: 'shakilnwz',
        repo: 'genforge-lab-knowledgebase',
        branch: 'main',
      },
      authMode: 'github-oauth',
      authSession: null,
      authError: null,
      activePath: null,
      expandedFolders: ['roadmaps', 'ai_enginnering'],
      treeFilter: '',
      onboardingOpen: false,
      settingsOpen: false,
      dismissedIosInstall: false,

      dbHydrated: false,
      vaultSource: 'preview',
      syncedEntries: [],
      runtimeToken: null,
      vaultLocked: false,
      hasPassphraseLock: false,
      localFolderName: null,
      isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,
      syncState: 'idle',
      syncProgress: null,
      syncMessage: null,
      syncError: null,
      lastSyncedAt: null,
      lastSyncedCommitSha: null,
      rateLimit: null,

      navHistory: [null],
      navIndex: 0,
      pendingHeadingSlug: null,
      activeHeadings: [],
      activeBacklinks: [],

      outboxEdits: [],
      editorMode: 'read',
      stageView: 'cards',
      commandPaletteOpen: false,
      conflictModalOpen: false,
      pendingCanvasNodeId: null,
      recentFiles: [],
      pinnedFiles: [],

      setColorMode: (colorMode) => set({ colorMode }),
      cycleColorMode: () =>
        set((s) => ({
          colorMode:
            COLOR_MODES[(COLOR_MODES.indexOf(s.colorMode) + 1) % COLOR_MODES.length],
        })),
      setVimMode: (vimMode) => set({ vimMode }),
      setSidebarOpen: (sidebarOpen) => set({ sidebarOpen }),
      toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
      setInspectorOpen: (inspectorOpen) => set({ inspectorOpen }),
      toggleInspector: () => set((s) => ({ inspectorOpen: !s.inspectorOpen })),
      setShowHiddenFiles: (showHiddenFiles) => set({ showHiddenFiles }),
      setIgnorePatterns: (ignorePatterns) => set({ ignorePatterns }),
      setRepoConfig: (repoConfig) => set({ repoConfig }),
      setAuthMode: (authMode) => set({ authMode }),
      setAuthSession: (authSession) =>
        set({ authSession: sanitizeAuthSession(authSession), authError: null }),
      setAuthError: (authError) => set({ authError }),
      clearAuthSession: () =>
        set({
          authSession: null,
          runtimeToken: null,
          vaultLocked: false,
          hasPassphraseLock: false,
        }),
      setActivePath: (activePath) =>
        set((s) => ({
          activePath,
          stageView: 'document',
          editorMode: 'read',
          expandedFolders: withExpandedParents(s.expandedFolders, activePath),
          pendingHeadingSlug: null,
          ...pushNavEntry(s.navHistory, s.navIndex, activePath),
        })),
      navigateToPath: (targetPath, headingSlug) =>
        set((s) => ({
          activePath: targetPath,
          stageView: 'document',
          editorMode: 'read',
          expandedFolders: withExpandedParents(s.expandedFolders, targetPath),
          pendingHeadingSlug: headingSlug ?? null,
          ...pushNavEntry(s.navHistory, s.navIndex, targetPath),
        })),
      navigateBack: () =>
        set((s) => {
          if (s.navIndex <= 0) return s;
          const nextIdx = s.navIndex - 1;
          const nextPath = s.navHistory[nextIdx] ?? null;
          return {
            navIndex: nextIdx,
            activePath: nextPath,
            stageView: 'document',
            editorMode: 'read',
            expandedFolders: withExpandedParents(s.expandedFolders, nextPath),
            pendingHeadingSlug: null,
          };
        }),
      navigateForward: () =>
        set((s) => {
          if (s.navIndex >= s.navHistory.length - 1) return s;
          const nextIdx = s.navIndex + 1;
          const nextPath = s.navHistory[nextIdx] ?? null;
          return {
            navIndex: nextIdx,
            activePath: nextPath,
            stageView: 'document',
            editorMode: 'read',
            expandedFolders: withExpandedParents(s.expandedFolders, nextPath),
            pendingHeadingSlug: null,
          };
        }),
      setPendingHeadingSlug: (pendingHeadingSlug) => set({ pendingHeadingSlug }),
      setActiveHeadings: (activeHeadings) => set({ activeHeadings }),
      setActiveBacklinks: (activeBacklinks) => set({ activeBacklinks }),
      setOutboxEdits: (outboxEdits) => set({ outboxEdits }),
      setEditorMode: (editorMode) => set({ editorMode }),
      setStageView: (stageView) => set({ stageView }),
      setCommandPaletteOpen: (commandPaletteOpen) => set({ commandPaletteOpen }),
      setConflictModalOpen: (conflictModalOpen) => set({ conflictModalOpen }),
      setPendingCanvasNodeId: (pendingCanvasNodeId) => set({ pendingCanvasNodeId }),
      setRecentFiles: (recentFiles) => set({ recentFiles }),
      setPinnedFiles: (pinnedFiles) => set({ pinnedFiles }),
      toggleFolder: (folderPath) =>
        set((s) => {
          const exists = s.expandedFolders.includes(folderPath);
          return {
            expandedFolders: exists
              ? s.expandedFolders.filter((f) => f !== folderPath)
              : [...s.expandedFolders, folderPath],
          };
        }),
      expandFolder: (folderPath) =>
        set((s) =>
          s.expandedFolders.includes(folderPath)
            ? s
            : { expandedFolders: [...s.expandedFolders, folderPath] },
        ),
      setTreeFilter: (treeFilter) => set({ treeFilter }),
      setOnboardingOpen: (onboardingOpen) => set({ onboardingOpen }),
      setSettingsOpen: (settingsOpen) => set({ settingsOpen }),
      dismissIosInstallPrompt: () => set({ dismissedIosInstall: true }),

      setDbHydrated: (dbHydrated) => set({ dbHydrated }),
      setVaultSource: (vaultSource) => set({ vaultSource }),
      setSyncedEntries: (syncedEntries) => set({ syncedEntries }),
      setRuntimeToken: (runtimeToken) => set({ runtimeToken }),
      setVaultLocked: (vaultLocked) => set({ vaultLocked }),
      setHasPassphraseLock: (hasPassphraseLock) => set({ hasPassphraseLock }),
      setLocalFolderName: (localFolderName) => set({ localFolderName }),
      setIsOnline: (isOnline) => set({ isOnline }),
      setSyncState: (syncState) => set({ syncState }),
      setSyncProgress: (syncProgress) => set({ syncProgress }),
      setSyncMessage: (syncMessage) => set({ syncMessage }),
      setSyncError: (syncError) => set({ syncError }),
      setLastSyncedAt: (lastSyncedAt) => set({ lastSyncedAt }),
      setLastSyncedCommitSha: (lastSyncedCommitSha) => set({ lastSyncedCommitSha }),
      setRateLimit: (rateLimit) => set({ rateLimit }),
    }),
    {
      name: 'genforge-kb-ui-v1',
      storage: createJSONStorage(() => safeStorage),
      partialize: (state) => ({
        vimMode: state.vimMode,
        sidebarOpen: state.sidebarOpen,
        inspectorOpen: state.inspectorOpen,
        showHiddenFiles: state.showHiddenFiles,
        ignorePatterns: state.ignorePatterns,
        repoConfig: state.repoConfig,
        authMode: state.authMode,
        authSession: sanitizeAuthSession(state.authSession),
        activePath: state.activePath,
        expandedFolders: state.expandedFolders,
        dismissedIosInstall: state.dismissedIosInstall,
      }),
      onRehydrateStorage: () => (state) => {
        if (state) {
          state.setAuthSession(sanitizeAuthSession(state.authSession));
        }
      },
    },
  ),
);
