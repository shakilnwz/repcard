import {
  Compass,
  FilePlus2,
  FileText,
  Network,
  Radar,
  RefreshCw,
  Search,
  SunMoon,
  X,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import type { VaultSearchHit } from '@/lib/searchEngine';
import { createNewVaultNote, syncNow } from '@/lib/vaultService';
import { useAppStore } from '@/store/useAppStore';

export function CommandPaletteModal() {
  const open = useAppStore((s) => s.commandPaletteOpen);
  const vaultSource = useAppStore((s) => s.vaultSource);
  const recentFiles = useAppStore((s) => s.recentFiles);
  const theme = useAppStore((s) => s.theme);

  const setCommandPaletteOpen = useAppStore((s) => s.setCommandPaletteOpen);
  const navigateToPath = useAppStore((s) => s.navigateToPath);
  const setPendingCanvasNodeId = useAppStore((s) => s.setPendingCanvasNodeId);
  const setStageView = useAppStore((s) => s.setStageView);
  const setActivePath = useAppStore((s) => s.setActivePath);
  const setTheme = useAppStore((s) => s.setTheme);

  const inputRef = useRef<HTMLInputElement | null>(null);
  const [query, setQuery] = useState('');
  const [hits, setHits] = useState<VaultSearchHit[]>([]);
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [newNoteMode, setNewNoteMode] = useState(false);
  const [newNotePath, setNewNotePath] = useState('');

  useEffect(() => {
    if (open) {
      setQuery('');
      setHits([]);
      setSelectedIdx(0);
      setNewNoteMode(false);
      setNewNotePath('');
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const trimmed = query.trim();
    if (!trimmed) {
      setHits([]);
      return;
    }

    let cancelled = false;
    const timer = setTimeout(() => {
      void import('@/lib/searchEngine')
        .then((mod) => mod.searchVault(trimmed, 15))
        .then((results) => {
          if (!cancelled) {
            setHits(results);
            setSelectedIdx(0);
          }
        })
        .catch(() => {});
    }, 45);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [open, query]);

  if (!open) return null;

  const openHit = (hit: VaultSearchHit) => {
    if (hit.matchedCanvasNodeId) {
      setPendingCanvasNodeId(hit.matchedCanvasNodeId);
    }
    setCommandPaletteOpen(false);
    navigateToPath(hit.path);
  };

  const handleCreateNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newNotePath.trim()) return;
    setCommandPaletteOpen(false);
    await createNewVaultNote(newNotePath);
  };

  const quickActions = [
    {
      id: 'new-note',
      label: 'Create New Markdown Note',
      icon: FilePlus2,
      disabled: vaultSource === 'preview',
      action: () => setNewNoteMode(true),
    },
    {
      id: 'global-graph',
      label: 'Open Global Link Graph',
      icon: Network,
      disabled: false,
      action: () => {
        setStageView('graph');
        setCommandPaletteOpen(false);
      },
    },
    {
      id: 'radar-studio',
      label: 'Open Interactive Radar & Studio',
      icon: Radar,
      disabled: false,
      action: () => {
        setStageView('radar');
        setCommandPaletteOpen(false);
      },
    },
    {
      id: 'dashboard',
      label: 'Open Roadmap Progress Dashboard',
      icon: Compass,
      disabled: false,
      action: () => {
        setActivePath(null);
        setCommandPaletteOpen(false);
      },
    },
    {
      id: 'sync-now',
      label: 'Push & Sync Vault Now',
      icon: RefreshCw,
      disabled: vaultSource === 'preview',
      action: () => {
        setCommandPaletteOpen(false);
        void syncNow().catch(() => {});
      },
    },
    {
      id: 'toggle-theme',
      label: 'Switch Theme (Dark / Light)',
      icon: SunMoon,
      disabled: false,
      action: () => {
        setTheme(theme === 'dark' ? 'light' : 'dark');
        setCommandPaletteOpen(false);
      },
    },
  ];

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Command Palette & Global Search"
      className="fixed inset-0 z-50 flex items-start justify-center bg-[#0B132B]/80 p-4 pt-[10vh] backdrop-blur-xs"
      onClick={(e) => {
        if (e.target === e.currentTarget) setCommandPaletteOpen(false);
      }}
    >
      <div className="w-full max-w-2xl overflow-hidden rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] shadow-2xl">
        {newNoteMode ? (
          <form onSubmit={handleCreateNote} className="space-y-3 p-4 text-xs">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-[var(--text-primary)]">
                New Note Path (relative to vault root)
              </span>
              <button
                type="button"
                onClick={() => setNewNoteMode(false)}
                className="text-[var(--text-muted)] hover:text-[var(--text-primary)]"
              >
                Back
              </button>
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                autoFocus
                value={newNotePath}
                onChange={(e) => setNewNotePath(e.target.value)}
                placeholder="ai_enginnering/notes/new-topic.md"
                className="min-w-0 flex-1 rounded-md border border-[var(--border-subtle)] bg-[var(--bg-canvas)] px-3 py-2 text-xs text-[var(--text-primary)] focus:border-[var(--accent-primary)] focus:outline-none"
              />
              <button
                type="submit"
                className="rounded-md bg-[var(--accent-primary)] px-4 py-2 font-semibold text-[var(--accent-on-primary)] hover:opacity-90"
              >
                Create & Edit
              </button>
            </div>
          </form>
        ) : (
          <>
            <div className="flex items-center gap-2 border-b border-[var(--border-subtle)] px-4 py-3">
              <Search className="h-4 w-4 shrink-0 text-[var(--accent-primary)]" />
              <input
                ref={inputRef}
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'ArrowDown') {
                    e.preventDefault();
                    setSelectedIdx((i) =>
                      hits.length > 0 ? (i + 1) % hits.length : 0,
                    );
                  } else if (e.key === 'ArrowUp') {
                    e.preventDefault();
                    setSelectedIdx((i) =>
                      hits.length > 0 ? (i - 1 + hits.length) % hits.length : 0,
                    );
                  } else if (e.key === 'Enter' && hits[selectedIdx]) {
                    e.preventDefault();
                    openHit(hits[selectedIdx]);
                  } else if (e.key === 'Escape') {
                    setCommandPaletteOpen(false);
                  }
                }}
                placeholder="Search notes, canvas cards, headings, and tags..."
                aria-label="Global vault search"
                className="min-w-0 flex-1 bg-transparent text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none"
              />
              <button
                type="button"
                onClick={() => setCommandPaletteOpen(false)}
                aria-label="Close command palette"
                className="rounded p-1 text-[var(--text-muted)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="max-h-[60vh] overflow-y-auto p-2 text-xs">
              {query.trim() ? (
                hits.length > 0 ? (
                  <ul className="space-y-1">
                    {hits.map((hit, idx) => (
                      <li key={hit.path}>
                        <button
                          type="button"
                          onClick={() => openHit(hit)}
                          className={`flex w-full flex-col gap-1 rounded-lg px-3 py-2 text-left transition-colors ${
                            idx === selectedIdx
                              ? 'bg-[var(--bg-hover)] ring-1 ring-[var(--accent-primary)]/40'
                              : 'hover:bg-[var(--bg-hover)]'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="flex items-center gap-1.5 font-semibold text-[var(--text-primary)]">
                              <FileText className="h-3.5 w-3.5 text-[var(--accent-primary)]" />
                              <span>{hit.title}</span>
                            </span>
                            <span className="font-mono text-[10px] text-[var(--text-muted)]">
                              {hit.path}
                            </span>
                          </div>
                          {hit.snippet && (
                            <p className="line-clamp-2 text-[11px] text-[var(--text-secondary)]">
                              {hit.snippet}
                            </p>
                          )}
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <div className="p-6 text-center text-[var(--text-muted)]">
                    No matching notes, headings, or canvas cards for &ldquo;{query}&rdquo;.
                    {vaultSource === 'preview' &&
                      ' Connect your repository or local folder to search full note bodies.'}
                  </div>
                )
              ) : (
                <div className="space-y-3 p-1">
                  <div>
                    <div className="px-2 pb-1 text-[10px] font-semibold tracking-wider text-[var(--text-muted)] uppercase">
                      Quick Actions
                    </div>
                    <ul className="space-y-0.5">
                      {quickActions.map((act) => {
                        const Icon = act.icon;
                        return (
                          <li key={act.id}>
                            <button
                              type="button"
                              disabled={act.disabled}
                              onClick={act.action}
                              className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-[var(--text-primary)] hover:bg-[var(--bg-hover)] disabled:opacity-40"
                            >
                              <Icon className="h-3.5 w-3.5 text-[var(--accent-primary)]" />
                              <span>{act.label}</span>
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  </div>

                  {recentFiles.length > 0 && (
                    <div>
                      <div className="px-2 pb-1 text-[10px] font-semibold tracking-wider text-[var(--text-muted)] uppercase">
                        Recent Files
                      </div>
                      <ul className="space-y-0.5">
                        {recentFiles.slice(0, 5).map((p) => (
                          <li key={p}>
                            <button
                              type="button"
                              onClick={() => {
                                setCommandPaletteOpen(false);
                                navigateToPath(p);
                              }}
                              className="flex w-full items-center justify-between gap-2 rounded-lg px-2.5 py-1.5 text-left text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]"
                            >
                              <span className="truncate font-medium">
                                {p.split('/').pop()}
                              </span>
                              <span className="truncate font-mono text-[10px] text-[var(--text-muted)]">
                                {p}
                              </span>
                            </button>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
