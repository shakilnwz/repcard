import { classifyFileKind, getFileExtension } from '@/features/vault/lib/tree';
import type { VaultFileEntry } from '@/features/vault/types/vault';

function entry(
  path: string,
  size: number,
  taskTotal?: number,
  taskDone?: number,
): VaultFileEntry {
  const name = path.split('/').pop() ?? path;
  return {
    path,
    name,
    ext: getFileExtension(path),
    kind: classifyFileKind(path),
    size,
    taskTotal,
    taskDone,
  };
}

export const SAMPLE_VAULT_ENTRIES: VaultFileEntry[] = [
  entry('README.md', 96),
  entry('gen.py', 34953),
  entry('Untitled.canvas', 320),

  // Roadmaps
  entry('roadmaps/ai-engineer.md', 28400, 191, 0),
  entry('roadmaps/ai-engineer.canvas', 58200, 191, 0),
  entry('roadmaps/cpp.md', 21600, 127, 0),
  entry('roadmaps/cpp.canvas', 36900, 127, 0),
  entry('roadmaps/devsecops.md', 17500, 93, 0),
  entry('roadmaps/devsecops.canvas', 28100, 93, 0),
  entry('roadmaps/inference-engineering.md', 23800, 138, 0),
  entry('roadmaps/inference-engineering.canvas', 44200, 138, 0),
  entry('roadmaps/iot-roadmap.md', 13730, 65, 0),
  entry('roadmaps/iot-roadmap.canvas', 18536, 65, 0),
  entry('roadmaps/mlops.md', 11200, 62, 0),
  entry('roadmaps/mlops.canvas', 19400, 62, 0),
  entry('roadmaps/python.md', 15800, 87, 0),
  entry('roadmaps/python.canvas', 29800, 87, 0),
  entry('roadmaps/python.pdf', 185435),
  entry('roadmaps/software-architect.md', 19400, 112, 0),
  entry('roadmaps/software-architect.canvas', 34500, 112, 0),
  entry('roadmaps/system-design.md', 24600, 147, 0),
  entry('roadmaps/system-design.canvas', 45100, 147, 0),

  // AI Engineering
  entry('ai_enginnering/AI Radar.canvas', 14103),
  entry('ai_enginnering/ai-radar.radar.json', 17430),
  entry('ai_enginnering/ai-engineer.md', 20620, 116, 0),
  entry('ai_enginnering/ai-engineer.canvas', 65661, 193, 0),
  entry('ai_enginnering/AI Engineering.pdf', 5925227),
  entry('ai_enginnering/ai-engineer.pdf', 218254),
  entry('ai_enginnering/ai-eng.png', 850053),
  entry('ai_enginnering/sn/AI vs AGI.md', 184),
  entry('ai_enginnering/sn/Harness Enginnering.md', 142),
  entry('ai_enginnering/sn/Inference.md', 190),
  entry('ai_enginnering/rag/qwen-3.5-4b-lmstudio-rag-setup.md', 16911),
  entry('ai_enginnering/rag/requirements.txt', 280),
  entry('ai_enginnering/rag/data/sample_knowledge.md', 920),
  entry('ai_enginnering/rag/eval/questions.json', 4120),
  entry('ai_enginnering/rag/scripts/01_verify_connection.py', 2450),
  entry('ai_enginnering/rag/scripts/06_eval.py', 12625),
  entry('ai_enginnering/rag/scripts/rag_common.py', 29234),

  // C++
  entry('cpp/cpp.md', 10517, 107, 2),
  entry('cpp/cpp.canvas', 14294),
  entry('cpp/Phase 2.md', 248),

  // IoT
  entry('iot/IOT Device Manufacturing Course Outline Updated by Rezaul.md', 14986),
  entry('iot/iot_learning_roadmap.md', 9927),
  entry('iot/iot_roadmap.canvas', 16279),
  entry('iot/iot_roadmap_flowchart_mermaid.md', 13748),

  // Laravel
  entry('laravel/clean-code-in-laravel.pdf', 6883828),

  // Hidden / ignored paths (visible when "Show hidden files" is enabled)
  entry('.obsidian/app.json', 88),
  entry('.obsidian/community-plugins.json', 112),
  entry('.ai/plan.md', 43565),
  entry('.ai/roadmap-sync-plan.md', 27612),
  entry('app/package.json', 820),
  entry('ai_enginnering/rag/stores/chroma/chroma.sqlite3', 491520),
  entry('ai_enginnering/rag/.venv/pyvenv.cfg', 120),
];
