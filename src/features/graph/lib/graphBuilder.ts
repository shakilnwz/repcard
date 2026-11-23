import type { VaultFileRecord } from '@/shared/db/vaultDb';
import { extractRawOutgoingTargets, resolveWikilink } from '@/shared/lib/wikilinks';
import type { FileKind } from '@/features/vault/types/vault';

export interface GraphNode {
  id: string;
  name: string;
  folder: string;
  topFolder: string;
  kind: FileKind;
  degree: number;
  taskTotal?: number;
  taskDone?: number;
}

export interface GraphEdge {
  source: string;
  target: string;
}

export interface VaultGraphData {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

export function buildVaultGraph(
  files: readonly Pick<
    VaultFileRecord,
    | 'path'
    | 'name'
    | 'folder'
    | 'kind'
    | 'isHidden'
    | 'outgoingLinks'
    | 'content'
    | 'taskTotal'
    | 'taskDone'
  >[],
): VaultGraphData {
  const visibleFiles = files.filter((f) => !f.isHidden);
  const allPaths = visibleFiles.map((f) => f.path);

  const nodeMap = new Map<string, GraphNode>();
  for (const file of visibleFiles) {
    const topFolder = file.path.includes('/')
      ? file.path.split('/')[0]
      : '(root)';
    nodeMap.set(file.path, {
      id: file.path,
      name: file.name,
      folder: file.folder ?? '',
      topFolder,
      kind: file.kind,
      degree: 0,
      taskTotal: file.taskTotal,
      taskDone: file.taskDone,
    });
  }

  const edgeKeys = new Set<string>();
  const edges: GraphEdge[] = [];

  for (const file of visibleFiles) {
    const rawLinks =
      file.outgoingLinks && file.outgoingLinks.length > 0
        ? file.outgoingLinks
        : typeof file.content === 'string' &&
            (file.kind === 'markdown' || file.kind === 'canvas')
          ? extractRawOutgoingTargets(file.kind, file.content)
          : [];

    for (const rawTarget of rawLinks) {
      const targetPath = resolveWikilink(rawTarget, file.path, allPaths);
      if (!targetPath || targetPath === file.path || !nodeMap.has(targetPath)) {
        continue;
      }

      const undirectedKey =
        file.path < targetPath
          ? `${file.path}->${targetPath}`
          : `${targetPath}->${file.path}`;
      if (edgeKeys.has(undirectedKey)) continue;
      edgeKeys.add(undirectedKey);

      edges.push({ source: file.path, target: targetPath });
      const srcNode = nodeMap.get(file.path);
      const tgtNode = nodeMap.get(targetPath);
      if (srcNode) srcNode.degree += 1;
      if (tgtNode) tgtNode.degree += 1;
    }
  }

  return {
    nodes: Array.from(nodeMap.values()),
    edges,
  };
}

export function extractLocalGraph(
  centerPath: string,
  fullGraph: VaultGraphData,
  hops = 1,
): VaultGraphData {
  const includedIds = new Set<string>();
  if (fullGraph.nodes.some((n) => n.id === centerPath)) {
    includedIds.add(centerPath);
  }

  let frontier = new Set<string>(includedIds);
  for (let step = 0; step < hops; step += 1) {
    const nextFrontier = new Set<string>();
    for (const edge of fullGraph.edges) {
      if (frontier.has(edge.source) && !includedIds.has(edge.target)) {
        includedIds.add(edge.target);
        nextFrontier.add(edge.target);
      }
      if (frontier.has(edge.target) && !includedIds.has(edge.source)) {
        includedIds.add(edge.source);
        nextFrontier.add(edge.source);
      }
    }
    frontier = nextFrontier;
    if (frontier.size === 0) break;
  }

  const edges = fullGraph.edges.filter(
    (e) => includedIds.has(e.source) && includedIds.has(e.target),
  );
  const nodes = fullGraph.nodes.filter((n) => includedIds.has(n.id));
  return { nodes, edges };
}
