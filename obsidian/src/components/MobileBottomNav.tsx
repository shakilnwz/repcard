import { FolderTree, Home, RefreshCw, Search, Settings } from 'lucide-react';
import { useAppStore } from '@/store/useAppStore';
import type { MobileTab } from '@/types/vault';

interface MobileBottomNavProps {
  onSelectTab: (tab: MobileTab) => void;
}

const ITEMS: Array<{
  id: MobileTab;
  label: string;
  icon: typeof Home;
}> = [
  { id: 'home', label: 'Home', icon: Home },
  { id: 'files', label: 'Files', icon: FolderTree },
  { id: 'search', label: 'Search', icon: Search },
  { id: 'sync', label: 'Sync', icon: RefreshCw },
  { id: 'settings', label: 'Settings', icon: Settings },
];

export function MobileBottomNav({ onSelectTab }: MobileBottomNavProps) {
  const activeMobileTab = useAppStore((s) => s.activeMobileTab);

  return (
    <nav
      aria-label="Mobile navigation"
      className="pb-safe shrink-0 border-t border-[var(--border-subtle)] bg-[var(--bg-surface)] lg:hidden"
    >
      <div className="grid grid-cols-5">
        {ITEMS.map(({ id, label, icon: Icon }) => {
          const active = activeMobileTab === id;
          return (
            <button
              key={id}
              type="button"
              onClick={() => onSelectTab(id)}
              aria-current={active ? 'page' : undefined}
              className={`flex flex-col items-center justify-center gap-0.5 py-2 text-[11px] transition-colors ${
                active
                  ? 'font-semibold text-[var(--accent-primary)]'
                  : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
              }`}
            >
              <Icon className="h-4 w-4" />
              <span>{label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
