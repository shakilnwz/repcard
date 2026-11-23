import { beforeEach, describe, expect, it } from 'vitest';
import { vaultDb, type VaultFileRecord } from '@/shared/db/vaultDb';
import { buildVaultGraph, extractLocalGraph } from '@/features/graph/lib/graphBuilder';
import {
  findMatchingCanvasNodeId,
  invalidateSearchIndexCache,
  searchVault,
} from '@/shared/lib/searchEngine';

function makeFile(
  path: string,
  content: string,
  overrides: Partial<VaultFileRecord> = {},
): VaultFileRecord {
  const name = path.split('/').pop() ?? path;
  const folder = path.includes('/') ? path.slice(0, path.lastIndexOf('/')) : '';
  return {
    path,
    name,
    folder,
    ext: name.includes('.') ? `.${name.split('.').pop()}` : '',
    kind: path.endsWith('.canvas') ? 'canvas' : 'markdown',
    size: content.length,
    blobSha: `sha-${path}`,
    isHidden: false,
    isBinary: false,
    isCached: true,
    content,
    updatedAt: 1000,
    ...overrides,
  };
}

describe('searchEngine and graphBuilder', () => {
  beforeEach(async () => {
    invalidateSearchIndexCache();
    await vaultDb.files.clear();
    await vaultDb.searchIndex.clear();
  });

  it('indexes Markdown notes and JSON Canvas cards in Dexie searchIndex and jumps to canvas nodes', async () => {
    const ragDoc = makeFile(
      'ai_enginnering/rag/qwen-3.5-4b-lmstudio-rag-setup.md',
      [
        '---',
        'title: Qwen 3.5 4B Local RAG Lab',
        'tags: [rag, chromadb]',
        '---',
        '# Vector Stores',
        'Store embeddings locally in ChromaDB or Qdrant.',
      ].join('\n'),
      {
        tags: ['rag', 'chromadb'],
        frontmatter: { title: 'Qwen 3.5 4B Local RAG Lab' },
      },
    );

    const pythonCanvas = makeFile(
      'roadmaps/python.canvas',
      JSON.stringify({
        nodes: [
          { id: 'py-intro', type: 'text', text: '# Python Roadmap\n- [ ] Syntax' },
          {
            id: 'py-pydantic',
            type: 'text',
            text: '## Pydantic Validation\nType-safe data models for RAG APIs.',
          },
        ],
        edges: [],
      }),
    );

    await vaultDb.files.bulkPut([ragDoc, pythonCanvas]);

    const ragHits = await searchVault('ChromaDB');
    expect(ragHits.length).toBeGreaterThanOrEqual(1);
    expect(ragHits[0].path).toBe('ai_enginnering/rag/qwen-3.5-4b-lmstudio-rag-setup.md');
    expect(ragHits[0].snippet.toLowerCase()).toContain('chromadb');

    const persisted = await vaultDb.searchIndex.get('minisearch');
    expect(persisted?.serializedJson).toBeTruthy();

    const canvasHits = await searchVault('Pydantic');
    expect(canvasHits.length).toBeGreaterThanOrEqual(1);
    expect(canvasHits[0].path).toBe('roadmaps/python.canvas');
    expect(canvasHits[0].matchedCanvasNodeId).toBe('py-pydantic');
    expect(findMatchingCanvasNodeId(pythonCanvas.content ?? '', 'Pydantic Validation')).toBe(
      'py-pydantic',
    );
  });

  it('builds deduplicated vault graph edges and extracts 1-hop local neighborhoods', () => {
    const files: VaultFileRecord[] = [
      makeFile('roadmaps/ai-engineer.md', 'Learn [[qwen-3.5-4b-lmstudio-rag-setup]] and [[python.canvas]]', {
        outgoingLinks: ['qwen-3.5-4b-lmstudio-rag-setup', 'python.canvas'],
      }),
      makeFile(
        'ai_enginnering/rag/qwen-3.5-4b-lmstudio-rag-setup.md',
        'Back to [[ai-engineer]] and [[embeddings]]',
        {
          outgoingLinks: ['ai-engineer', 'embeddings'],
        },
      ),
      makeFile('ai_enginnering/rag/embeddings.md', 'Dense vectors guide'),
      makeFile('roadmaps/python.canvas', JSON.stringify({ nodes: [], edges: [] })),
      makeFile('unrelated/orphan.md', 'No links here'),
    ];

    const fullGraph = buildVaultGraph(files);
    expect(fullGraph.nodes).toHaveLength(5);
    // ai-engineer <-> rag is deduplicated to 1 undirected edge, plus ai-engineer <-> python.canvas and rag <-> embeddings
    expect(fullGraph.edges).toHaveLength(3);

    const localOneHop = extractLocalGraph('roadmaps/ai-engineer.md', fullGraph, 1);
    const localIds = localOneHop.nodes.map((n) => n.id).sort();
    expect(localIds).toEqual([
      'ai_enginnering/rag/qwen-3.5-4b-lmstudio-rag-setup.md',
      'roadmaps/ai-engineer.md',
      'roadmaps/python.canvas',
    ]);
  });
});
