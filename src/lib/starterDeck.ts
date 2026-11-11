import type { FlashcardItem, LibrarySource } from '@/types/schema'

export const STARTER_LIBRARY_ID = 'starter-deck'

export const STARTER_LIBRARY_META: LibrarySource = {
  id: STARTER_LIBRARY_ID,
  name: 'System Design & AI Starter Deck',
  url: '',
  enabled: true,
  lastSyncedAt: new Date().toISOString(),
  cardCount: 4,
}

export const STARTER_CARDS: FlashcardItem[] = [
  {
    id: 'starter-1',
    dateAdded: '2026-11-01T00:00:00.000Z',
    term: 'PagedAttention (vLLM)',
    domain: 'AI Systems / LLM Serving',
    level: 'High-Level',
    fields: {
      whatItIs: 'An attention algorithm inspired by operating system virtual memory paging that divides the Key-Value (KV) cache into non-contiguous physical blocks rather than pre-allocating static contiguous arrays for worst-case context lengths.',
      problemSolved: 'Eliminates internal and external KV memory fragmentation (saving 60–80% GPU VRAM waste), allowing servers to batch 2–4× more concurrent generation requests per GPU without out-of-memory crashes.',
      productionContext: 'Core memory engine powering vLLM, TensorRT-LLM, and HuggingFace TGI in large-scale inference deployments.',
    },
    referenceUrl: 'https://arxiv.org/abs/2309.06180',
    tags: ['ai-systems', 'llm-serving', 'memory', 'kv-cache'],
  },
  {
    id: 'starter-2',
    dateAdded: '2026-11-02T00:00:00.000Z',
    term: 'Speculative Decoding',
    domain: 'AI Systems / LLM Serving',
    level: 'High-Level',
    fields: {
      whatItIs: 'An inference acceleration technique that uses a small, fast draft model to generate K candidate tokens sequentially, followed by a single batched forward pass through the large target model to verify all K tokens concurrently in parallel.',
      problemSolved: 'Overcomes the strict memory-bandwidth bottleneck of autoregressive generation (1 token per memory-bound forward pass), yielding 2–3× wall-clock latency speedup with mathematically identical token distributions.',
      productionContext: 'Standard optimization in Google Gemini, vLLM speculative worker, llama.cpp, and Cloudflare Workers AI.',
    },
    referenceUrl: 'https://arxiv.org/abs/2211.17192',
    tags: ['ai-systems', 'inference-acceleration', 'draft-model'],
  },
  {
    id: 'starter-3',
    dateAdded: '2026-11-03T00:00:00.000Z',
    term: 'Raft Consensus Algorithm',
    domain: 'Distributed Systems',
    level: 'High-Level',
    fields: {
      whatItIs: 'A leader-based distributed consensus protocol designed for understandability, dividing consensus into three distinct sub-problems: leader election, log replication, and safety invariants.',
      problemSolved: 'Guarantees that a cluster of distributed nodes agrees on a replicated append-only state log even under arbitrary network partitions and machine crashes, avoiding split-brain scenarios.',
      productionContext: 'Foundational consensus backbone in etcd (Kubernetes cluster state), HashiCorp Consul, CockroachDB, and TiKV.',
    },
    referenceUrl: 'https://raft.github.io/',
    tags: ['distributed-systems', 'consensus', 'fault-tolerance'],
  },
  {
    id: 'starter-4',
    dateAdded: '2026-11-04T00:00:00.000Z',
    term: 'Write-Ahead Logging (WAL)',
    domain: 'Database Systems',
    level: 'Low-Level',
    fields: {
      whatItIs: 'An append-only storage protocol where state changes and transaction deltas are flushed sequentially to persistent non-volatile storage before corresponding in-memory dirty buffer pool pages are written to data files.',
      problemSolved: 'Guarantees Atomicity and Durability (ACID) during unexpected power cuts or OS crashes by enabling fast REDO/UNDO log playback while deferring expensive random page flushes.',
      productionContext: 'Crucial durability engine in PostgreSQL (pg_wal), MySQL InnoDB (redo log), SQLite (wal mode), and RocksDB.',
    },
    referenceUrl: 'https://en.wikipedia.org/wiki/Write-ahead_logging',
    tags: ['databases', 'acid', 'storage-engines', 'durability'],
  },
]
