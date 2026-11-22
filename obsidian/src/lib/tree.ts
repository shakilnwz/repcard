import { isPathIgnored } from '@/lib/ignore';
import type {
  FileKind,
  VaultFileEntry,
  VaultFolderNode,
  VaultTreeNode,
} from '@/types/vault';

const IMAGE_EXTS = new Set(['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg']);
const CODE_EXTS = new Set([
  'py',
  'ts',
  'tsx',
  'js',
  'jsx',
  'json',
  'txt',
  'sh',
  'yml',
  'yaml',
  'toml',
  'css',
  'html',
]);

export function getFileExtension(path: string): string {
  const base = path.split('/').pop() ?? path;
  const idx = base.lastIndexOf('.');
  if (idx <= 0) return '';
  return base.slice(idx + 1).toLowerCase();
}

export function classifyFileKind(path: string): FileKind {
  const ext = getFileExtension(path);
  if (ext === 'md') return 'markdown';
  if (ext === 'canvas') return 'canvas';
  if (ext === 'pdf') return 'pdf';
  if (IMAGE_EXTS.has(ext)) return 'image';
  if (CODE_EXTS.has(ext)) return 'code';
  return 'other';
}

export interface BuildVaultTreeOptions {
  ignorePatterns: string[];
  showHidden: boolean;
  filterQuery?: string;
}

interface MutableFolder {
  name: string;
  path: string;
  folders: Map<string, MutableFolder>;
  files: VaultFileEntry[];
}

function finalizeFolder(folder: MutableFolder): VaultFolderNode {
  const childFolders = Array.from(folder.folders.values())
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }))
    .map(finalizeFolder);

  const childFiles: VaultTreeNode[] = [...folder.files]
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }))
    .map((entry) => ({
      type: 'file',
      name: entry.name,
      path: entry.path,
      entry,
    }));

  const fileCount =
    childFiles.length +
    childFolders.reduce((acc, sub) => acc + sub.fileCount, 0);

  return {
    type: 'folder',
    name: folder.name,
    path: folder.path,
    fileCount,
    children: [...childFolders, ...childFiles],
  };
}

export function buildVaultTree(
  entries: VaultFileEntry[],
  options: BuildVaultTreeOptions,
): VaultTreeNode[] {
  const query = (options.filterQuery ?? '').trim().toLowerCase();

  const visibleEntries = entries.filter((entry) => {
    const hidden = Boolean(entry.isHidden) || isPathIgnored(entry.path, options.ignorePatterns);
    if (!options.showHidden && hidden) {
      return false;
    }
    if (query) {
      return (
        entry.path.toLowerCase().includes(query) ||
        entry.name.toLowerCase().includes(query)
      );
    }
    return true;
  });

  const root: MutableFolder = {
    name: '',
    path: '',
    folders: new Map(),
    files: [],
  };

  for (const entry of visibleEntries) {
    const parts = entry.path.split('/').filter(Boolean);
    if (parts.length === 0) continue;

    let current = root;
    for (let i = 0; i < parts.length - 1; i += 1) {
      const seg = parts[i];
      const nextPath = current.path ? `${current.path}/${seg}` : seg;
      let sub = current.folders.get(seg);
      if (!sub) {
        sub = {
          name: seg,
          path: nextPath,
          folders: new Map(),
          files: [],
        };
        current.folders.set(seg, sub);
      }
      current = sub;
    }

    current.files.push(entry);
  }

  return finalizeFolder(root).children;
}

export function countVaultFiles(
  entries: VaultFileEntry[],
  ignorePatterns: string[],
  showHidden: boolean,
): { visible: number; hidden: number; roadmaps: number } {
  let visible = 0;
  let hidden = 0;
  let roadmaps = 0;

  for (const entry of entries) {
    const isHidden = Boolean(entry.isHidden) || isPathIgnored(entry.path, ignorePatterns);
    if (isHidden) hidden += 1;
    if (showHidden || !isHidden) {
      visible += 1;
      if (entry.path.startsWith('roadmaps/') && entry.kind === 'markdown') {
        roadmaps += 1;
      }
    }
  }

  return { visible, hidden, roadmaps };
}
