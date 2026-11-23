import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { KnowledgebaseShell } from '@/features/vault/KnowledgebaseShell';
import { clearAllDexieTables } from '@/shared/db/vaultDb';
import { clearAllBinaries } from '@/features/vault/lib/binaryStore';
import { bytesToBase64 } from '@/shared/lib/crypto';
import { DEFAULT_IGNORE_PATTERNS } from '@/features/vault/lib/ignore';
import { useAppStore } from '@/shared/store/useAppStore';

function resetStore() {
  if (typeof document !== 'undefined') {
    delete document.documentElement.dataset.colorMode;
  }
  useAppStore.setState({
    colorMode: 'default',
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
    dbHydrated: true,
    vaultSource: 'preview',
    syncedEntries: [],
    runtimeToken: null,
    vaultLocked: false,
    hasPassphraseLock: false,
    localFolderName: null,
    isOnline: true,
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
    stageView: 'document',
    commandPaletteOpen: false,
    conflictModalOpen: false,
    pendingCanvasNodeId: null,
    recentFiles: [],
    pinnedFiles: [],
  });
}

describe('AppShell', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(async () => {
    window.localStorage.clear();
    window.history.replaceState(null, '', '/');
    await clearAllBinaries();
    await clearAllDexieTables();
    resetStore();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('renders desktop workspace and selects a file from the vault tree', async () => {
    const user = userEvent.setup();
    render(<KnowledgebaseShell />);

    expect(screen.getByText('RepCard Knowledgebase')).toBeInTheDocument();

    const sidebar = screen.getByRole('complementary', { name: 'Vault sidebar' });
    await user.click(
      within(sidebar).getByRole('button', { name: /ai-engineer\.md\s*0\s*\/\s*191/i }),
    );

    expect(useAppStore.getState().activePath).toBe('roadmaps/ai-engineer.md');
    expect(screen.getByRole('heading', { name: 'ai-engineer.md' })).toBeInTheDocument();
  });

  it('toggles hidden files and filters tree items', async () => {
    const user = userEvent.setup();
    render(<KnowledgebaseShell />);

    const sidebar = screen.getByRole('complementary', { name: 'Vault sidebar' });
    expect(within(sidebar).queryByText('.obsidian')).not.toBeInTheDocument();

    await user.click(within(sidebar).getByRole('button', { name: /show hidden files/i }));
    expect(within(sidebar).getByText('.obsidian')).toBeInTheDocument();

    const filterInput = within(sidebar).getByLabelText('Filter vault files');
    await user.type(filterInput, 'AI Radar');
    expect(within(sidebar).getByRole('button', { name: /AI Radar\.canvas/i })).toBeInTheDocument();
    expect(within(sidebar).queryByText('.obsidian')).not.toBeInTheDocument();
  });

  it('switches themes and opens onboarding & settings modals', async () => {
    const user = userEvent.setup();
    render(<KnowledgebaseShell />);

    expect(document.documentElement.dataset.colorMode).toBeUndefined();
    await user.click(screen.getByRole('button', { name: /switch theme/i }));
    expect(document.documentElement.dataset.colorMode).toBe('navy-canvas');
    await user.click(screen.getByRole('button', { name: /switch theme/i }));
    expect(document.documentElement.dataset.colorMode).toBe('black-navy-card');
    await user.click(screen.getByRole('button', { name: /switch theme/i }));
    expect(document.documentElement.dataset.colorMode).toBeUndefined();

    await user.click(screen.getByRole('button', { name: /connect github repo/i }));
    const onboarding = screen.getByRole('dialog', {
      name: 'Repository Connection & Setup',
    });
    expect(within(onboarding).getByRole('link', { name: /sign in with github/i })).toHaveAttribute(
      'href',
      '/api/auth/login',
    );

    await user.click(within(onboarding).getByRole('button', { name: /local folder/i }));
    expect(
      within(onboarding).getByText(/Local Folder Picker Unsupported/i),
    ).toBeInTheDocument();

    await user.click(within(onboarding).getByRole('button', { name: /fine-grained pat/i }));
    await user.click(within(onboarding).getByRole('button', { name: /save configuration/i }));
    expect(useAppStore.getState().authMode).toBe('pat');

    await user.click(screen.getByRole('button', { name: 'Open settings' }));
    const settings = screen.getByRole('dialog', { name: 'Application Settings' });
    expect(within(settings).getByText(/Offline Storage Manager/i)).toBeInTheDocument();
    await user.click(within(settings).getByRole('button', { name: 'Close settings' }));
    expect(screen.queryByRole('dialog', { name: 'Application Settings' })).not.toBeInTheDocument();
  });

  it('displays collaborator push-access error when redirected from OAuth callback', () => {
    window.history.replaceState(null, '', '/?auth_error=push_access_required');
    render(<KnowledgebaseShell />);

    expect(
      screen.getByText(/authentication notice: push_access_required/i),
    ).toBeInTheDocument();
  });

  it('syncs via PAT without writing token to localStorage and wipes cache cleanly', async () => {
    const secretPat = 'github_pat_never_in_localstorage_123';
    const noteText = '# Synced Note\n- [x] Stored in Dexie';

    globalThis.fetch = vi.fn<typeof fetch>(async (url) => {
      const s = String(url);
      if (s.endsWith('/user')) {
        return new Response(JSON.stringify({ login: 'shakilnwz' }), { status: 200 });
      }
      if (s.includes('/repos/') && !s.includes('/git/')) {
        return new Response(
          JSON.stringify({
            full_name: 'shakilnwz/genforge-lab-knowledgebase',
            default_branch: 'main',
            private: true,
            permissions: { pull: true, push: true },
          }),
          { status: 200 },
        );
      }
      if (s.includes('/git/ref/heads/main')) {
        return new Response(
          JSON.stringify({ object: { sha: 'abc1234567890' } }),
          { status: 200, headers: { ETag: '"etag-1"' } },
        );
      }
      if (s.includes('/git/trees/abc1234567890')) {
        return new Response(
          JSON.stringify({
            tree: [
              { path: 'roadmaps/ai-engineer.md', type: 'blob', sha: 'blob-1', size: noteText.length },
            ],
          }),
          { status: 200 },
        );
      }
      return new Response(
        JSON.stringify({
          content: bytesToBase64(new TextEncoder().encode(noteText)),
          encoding: 'base64',
        }),
        { status: 200 },
      );
    });

    const user = userEvent.setup();
    render(<KnowledgebaseShell />);

    await user.click(screen.getByRole('button', { name: /connect github repo/i }));
    const onboarding = screen.getByRole('dialog', {
      name: 'Repository Connection & Setup',
    });

    await user.click(within(onboarding).getByRole('button', { name: /fine-grained pat/i }));
    await user.type(within(onboarding).getByPlaceholderText('github_pat_...'), secretPat);
    await user.click(within(onboarding).getByRole('button', { name: /verify & sync/i }));

    expect(await screen.findByText(/GitHub Synced · abc1234/i)).toBeInTheDocument();

    // Critical security check: token never appears anywhere in localStorage
    const rawLocalStorage = window.localStorage.getItem('genforge-kb-ui-v1') ?? '';
    expect(rawLocalStorage).not.toContain(secretPat);
    expect(rawLocalStorage).toContain('shakilnwz');

    // Open the synced note & verify rich Markdown rendering + Document Outline TOC
    const sidebar = screen.getByRole('complementary', { name: 'Vault sidebar' });
    await user.click(within(sidebar).getByRole('button', { name: /ai-engineer\.md/i }));
    expect(
      await screen.findByRole('heading', { name: 'Synced Note' }),
    ).toBeInTheDocument();
    expect(screen.getByText(/Document Outline \(1\)/i)).toBeInTheDocument();

    const checkbox = screen.getByRole('checkbox');
    expect(checkbox).toBeEnabled();
    expect(checkbox).toBeChecked();
    await user.click(checkbox);
    expect(checkbox).not.toBeChecked();
    expect(await screen.findByText(/1 unsynced/i)).toBeInTheDocument();
    expect(useAppStore.getState().outboxEdits).toHaveLength(1);

    // Execute Forget Token & Wipe Local Cache in Settings
    await user.click(screen.getByRole('button', { name: 'Open settings' }));
    const settings = screen.getByRole('dialog', { name: 'Application Settings' });
    await user.click(
      within(settings).getByRole('button', { name: /forget token & wipe local cache/i }),
    );
    await user.click(within(settings).getByRole('button', { name: /confirm wipe everything/i }));

    expect(
      await within(settings).findByText(/all IndexedDB\/OPFS caches wiped/i),
    ).toBeInTheDocument();
    expect(useAppStore.getState().vaultSource).toBe('preview');
    expect(useAppStore.getState().runtimeToken).toBeNull();
  });

  it('displays Roadmap Progress Dashboard on Overview and opens Command Palette on Search', async () => {
    const user = userEvent.setup();
    render(<KnowledgebaseShell />);

    expect(screen.getByText(/Roadmap Progress Dashboard/i)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Open global search' }));
    expect(
      screen.getByRole('dialog', { name: /command palette/i }),
    ).toBeInTheDocument();

    await user.keyboard('{Escape}');
    expect(
      screen.queryByRole('dialog', { name: /command palette/i }),
    ).not.toBeInTheDocument();
  });

  it('opens Interactive Radar & Studio, filters blips, and live-renders pasted shorthand JSON', async () => {
    const user = userEvent.setup();
    render(<KnowledgebaseShell />);

    await user.click(screen.getByRole('button', { name: /toggle radar chart view/i }));
    const workspace = await screen.findByTestId('radar-workspace');
    expect(within(workspace).getByText('AI Radar')).toBeInTheDocument();
    expect(
      within(workspace).getAllByText('Prompt Engineering').length,
    ).toBeGreaterThanOrEqual(1);

    const filterInput = within(workspace).getByLabelText('Filter radar blips');
    await user.type(filterInput, 'GraphRAG');
    expect(
      within(workspace).getAllByText('GraphRAG').length,
    ).toBeGreaterThanOrEqual(1);

    await user.click(
      within(workspace).getByRole('button', { name: /enter radar fullscreen/i }),
    );
    expect(
      await screen.findByTestId('radar-fullscreen-overlay'),
    ).toBeInTheDocument();
    await user.keyboard('{Escape}');
    expect(
      screen.queryByTestId('radar-fullscreen-overlay'),
    ).not.toBeInTheDocument();
    expect(screen.getByTestId('radar-workspace')).toBeInTheDocument();

    await user.click(within(workspace).getByRole('button', { name: /create new/i }));
    const creator = await screen.findByTestId('radar-creator');
    await user.click(within(creator).getByRole('button', { name: /json input/i }));

    const textarea = within(creator).getByLabelText('Radar JSON editor');
    fireEvent.change(textarea, {
      target: {
        value: JSON.stringify({
          type: 'genforge-radar',
          title: 'Systems Stack',
          adopt: [{ title: 'Rust' }],
          trial: [{ title: 'Zig' }],
        }),
      },
    });

    expect(
      await within(creator).findByText(/Detected: genforge-radar · 2 steps · 2 items/i),
    ).toBeInTheDocument();
    expect(within(creator).getAllByText('Rust').length).toBeGreaterThanOrEqual(1);
    expect(within(creator).getAllByText('Zig').length).toBeGreaterThanOrEqual(1);
  });
});
