import {
  Code2,
  File,
  FileText,
  FileType,
  Folder,
  FolderOpen,
  ImageIcon,
  LayoutGrid,
} from '@/shared/ui/MaterialIcons';
import type { FileKind, VaultTreeNode } from '@/features/vault/types/vault';

function fileIcon(kind: FileKind, isActive = false) {
  switch (kind) {
    case 'markdown':
      return <FileText className={`h-4 w-4 shrink-0 ${isActive ? 'text-current' : 'text-[var(--accent-primary)]'}`} />;
    case 'canvas':
      return <LayoutGrid className={`h-4 w-4 shrink-0 ${isActive ? 'text-current' : 'text-[var(--accent-secondary)]'}`} />;
    case 'pdf':
      return <FileType className={`h-4 w-4 shrink-0 ${isActive ? 'text-current' : 'text-[var(--text-secondary)]'}`} />;
    case 'image':
      return <ImageIcon className={`h-4 w-4 shrink-0 ${isActive ? 'text-current' : 'text-[var(--accent-primary)]/80'}`} />;
    case 'code':
      return <Code2 className={`h-4 w-4 shrink-0 ${isActive ? 'text-current' : 'text-[var(--text-secondary)]'}`} />;
    default:
      return <File className={`h-4 w-4 shrink-0 ${isActive ? 'text-current' : 'text-[var(--text-muted)]'}`} />;
  }
}

interface VaultTreeProps {
  nodes: VaultTreeNode[];
  activePath: string | null;
  expandedFolders: string[];
  forceExpandAll?: boolean;
  onToggleFolder: (folderPath: string) => void;
  onSelectFile: (filePath: string) => void;
}

interface TreeBranchProps extends VaultTreeProps {
  depth: number;
}

function TreeBranch({
  nodes,
  activePath,
  expandedFolders,
  forceExpandAll,
  onToggleFolder,
  onSelectFile,
  depth,
}: TreeBranchProps) {
  return (
    <ul className="space-y-0.5" role={depth === 0 ? 'tree' : 'group'}>
      {nodes.map((node) => {
        if (node.type === 'folder') {
          const isOpen =
            Boolean(forceExpandAll) || expandedFolders.includes(node.path);
          return (
            <li key={node.path} role="treeitem" aria-expanded={isOpen}>
              <button
                type="button"
                onClick={() => onToggleFolder(node.path)}
                style={{ paddingLeft: `${depth * 12 + 8}px` }}
                className="flex w-full items-center gap-2 rounded-md py-1.5 pr-2 text-left text-sm transition-colors hover:bg-[var(--bg-hover)]"
              >
                {isOpen ? (
                  <FolderOpen className="h-4 w-4 shrink-0 text-[var(--accent-primary)]" />
                ) : (
                  <Folder className="h-4 w-4 shrink-0 text-[var(--text-muted)]" />
                )}
                <span className="min-w-0 flex-1 truncate font-medium text-[var(--text-primary)]">
                  {node.name}
                </span>
                <span className="rounded bg-[var(--bg-elevated)] px-1.5 py-0.5 text-[11px] tabular-nums text-[var(--text-muted)]">
                  {node.fileCount}
                </span>
              </button>
              {isOpen && node.children.length > 0 && (
                <TreeBranch
                  nodes={node.children}
                  activePath={activePath}
                  expandedFolders={expandedFolders}
                  forceExpandAll={forceExpandAll}
                  onToggleFolder={onToggleFolder}
                  onSelectFile={onSelectFile}
                  depth={depth + 1}
                />
              )}
            </li>
          );
        }

        const isActive = activePath === node.path;
        return (
          <li key={node.path} role="treeitem" aria-selected={isActive}>
            <button
              type="button"
              onClick={() => onSelectFile(node.path)}
              title={node.path}
              style={{ paddingLeft: `${depth * 12 + 8}px` }}
              className={`flex w-full items-center gap-2 rounded-xl py-1.5 pr-2 text-left text-sm transition-colors ${
                isActive
                  ? 'bg-[var(--button-primary-bg)] font-bold text-[var(--button-primary-fg)] shadow-xs'
                  : 'text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]'
              }`}
            >
              {fileIcon(node.entry.kind, isActive)}
              <span className="min-w-0 flex-1 truncate">{node.name}</span>
              {typeof node.entry.taskTotal === 'number' && node.entry.taskTotal > 0 && (
                <span className={`text-[11px] tabular-nums ${isActive ? 'opacity-80' : 'text-[var(--text-muted)]'}`}>
                  {node.entry.taskDone ?? 0}/{node.entry.taskTotal}
                </span>
              )}
            </button>
          </li>
        );
      })}
    </ul>
  );
}

export function VaultTree(props: VaultTreeProps) {
  if (props.nodes.length === 0) {
    return (
      <div className="rounded-2xl bg-[var(--bg-canvas)] p-4 text-center text-xs text-[var(--text-muted)] shadow-xs">
        No matching vault files. Clear the filter or enable hidden files.
      </div>
    );
  }

  return <TreeBranch {...props} depth={0} />;
}
