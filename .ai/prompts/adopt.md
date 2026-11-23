# Adopt an Existing Project

Take a project that already has code, and has just received these rules, to the point where the
rules describe it truthfully and every gap between them is on record: the decisions the code
embodies written down, each app bound to its stack profile, the agents in use configured, existing
behaviour registered, existing violations measured, and the project's real phase assessed against
[`lifecycle.md`](../../docs/conventions/lifecycle.md) → *Adopting an existing project*. A project
with no code yet is taken through [`bootstrap.md`](bootstrap.md) instead.

**Mode:** Reads the code; writes the rules' documents only — ADRs, the context page, the glossary,
`AGENTS.md`, `.ai/agents`, the legacy register, the baseline audits, `docs/audit/readiness.md` — and
runs `.ai/bin/sync-rules`. It changes no application code, test, configuration, dependency or CI
workflow. A baseline for a mechanical check is proposed, and written only when the owner approves
wiring that check.
**Output:** filled `AGENTS.md`; retroactive ADR-0001 and ADR-0002; a context page; the glossary;
`.ai/agents` and the generated agent rule files; `docs/audit/legacy-capabilities.md`; the baseline
audits; every gate's rows in `docs/audit/readiness.md`; a phase-gate report assessing G0 to G4.
**Inputs:** the codebase, and the owner, who confirms what the code shows and answers what it
cannot. Never present an inference as a fact: every claim about the project cites the path it came
from, and what the code cannot settle is asked.

## Before you start

1. Confirm the rules are present: `AGENTS.md` (the project's own keeps the rules' block between
   `<!-- specforge:begin -->` and `<!-- specforge:end -->`), `CLAUDE.md`, `.ai/rules/`, `.ai/prompts/`, `.ai/agents`, `.ai/bin/`, `docs/conventions/`,
   `docs/templates/`, `docs/audit/readiness.md`.
2. List every file the installation kept from the project instead of the rules' version — a
   `*.specforge-incoming` file beside it, or the list the manual copy printed. Each is reconciled
   below, never silently.
3. Pin the tree: the date, and the branch and commit when the project is under version control.
4. Read `lifecycle.md` → *Adopting an existing project*, [`specs.md`](../../docs/conventions/specs.md)
   → *Legacy behaviour*, and [`testing.md`](../../docs/conventions/testing.md) → *Baselines*.

## Survey the code first

Derive everything the code already answers, each finding with the paths that show it:

1. **Apps and stacks:** manifests and lockfiles — `composer.json` with `artisan`; `*.sln`, `*.slnx`,
   `*.csproj`; `next.config.*`, and `next`, `react` or `vue` among `package.json` dependencies — with
   runtime and framework versions, and the path each one lives in: a frontend inside a server app
   (`resources/js`, `ClientApp`) is a path of its own.
2. **Shape:** single app or monorepo (workspace files, `apps/`, solution projects); each app's
   surfaces (route groups and their guards, hosts and prefixes; `MapGroup` policies; App Router route
   groups); modules, and the edges between them — enough to propose a modularity level, not to audit
   it.
3. **External systems:** SDKs, HTTP clients and their base URLs, the configuration keys that name a
   provider.
4. **Vocabulary:** the domain nouns in models or entities, tables, routes and UI copy, with every
   concept that goes by more than one name flagged.
5. **Capabilities:** what each kind of user can do, one line each, from entry points, scheduled jobs
   and navigation — the candidates for the legacy register.
6. **Agent instructions already present:** `AGENTS.md`, `CLAUDE.md`, `GEMINI.md`,
   `.github/copilot-instructions.md`, and any rules under `.claude/`, `.cursor/`,
   `.github/instructions/`, `.windsurf/`, `.devin/`, `.agents/`, `.kiro/`. Note every instruction
   that contradicts a convention.
7. **Enforcement already present:** CI workflows, linters, formatters, static analysis, arch tests,
   and any baselines they already carry.

## Ask the owner

One round, each question carrying the survey's finding as the proposed answer:

1. **Stacks, shape, surfaces, modules:** confirm or correct. The modularity level: the one the code
   has, or a target above it — recorded as a target, with the gap as findings.
2. **Product and capabilities:** the product in two sentences, who uses it, and which surveyed
   capabilities are in scope, out of scope, or to be retired.
3. **Vocabulary:** the canonical term for each flagged group.
4. **Agents** that work in the project.
5. **Contradictions:** for each existing instruction that contradicts a convention, which wins — the
   convention (the code is brought into line, starting from a baseline) or the project's practice
   (an ADR records the exception).
6. **Constraints:** compliance, data residency, accessibility and performance targets, deadlines.

## Steps

1. Write **ADR-0001** (stacks) and **ADR-0002** (shape, surfaces, modules, modularity level) from
   [`adr.md`](../../docs/templates/adr.md), recording what exists. Once the owner confirms, their
   status reads `Accepted (retroactive, YYYY-MM-DD)`. A decision the owner wants changed is a further
   ADR, status Proposed; an exception to a convention from answer 5 is another.
2. Write the context page `docs/architecture/context.md` from
   [`architecture.md`](../../docs/templates/architecture.md): people, external systems, and the
   capabilities in scope, each marked as built or to be built.
3. Write `docs/reference/glossary.md` from the vocabulary answers. A rename the canonical terms imply
   is not made here; it becomes a naming-audit finding.
4. Fill `AGENTS.md` — **Stacks**, **Architecture Overview**, **Common Commands**, **Local
   Endpoints**, **Database** — from what the project already runs and documents, never invented. If
   the project kept its own `AGENTS.md`, the installer appended the rules' block to it and wrote the
   kit's complete file beside it as `AGENTS.md.specforge-incoming`: bring the project sections over
   from it (**Phase**, **Stacks**, **App conventions** and the sections after them), leaving the
   block and the project's own text untouched and resolving contradictions as the owner answered.
   Reconcile every other kept file the same way, then delete its `*.specforge-incoming` copy.
5. Trim the rules to the stacks in use. Fill the **Stacks** table with one row per path that has its
   own profiles; the stack rule files keep their globs, since the table scopes them. Adjust a core
   rule file's `paths:` only where the layout needs it, in the form Laravel Boost writes back.
6. Confirm `.ai/agents` lists the agents in use — the installer fills it from its answers — and run
   `.ai/bin/sync-rules` after any change. The project's own rule files are never touched; a
   `conflict:` line names a file to rename.
7. **Baseline audits**, each run from its prompt under
   [`auditing.md`](../../docs/conventions/auditing.md) and filed as it says: architecture
   conformance, modularity (when modular), security, test coverage, dependencies, and spec
   conformance in register mode — its reverse sweep writes every existing behaviour as a row of
   `docs/audit/legacy-capabilities.md` (from [`audit.md`](../../docs/templates/audit.md)): the
   capability, its entry points, the tests that cover it today, status `Unspecified`.
8. **Baselines:** for each mechanical check the profiles call for that the existing code fails, count
   the violations and propose the baseline mechanism from `testing.md` → *Baselines*. Write none the
   owner has not approved.
9. Assess every gate, not only G0: update each row of `docs/audit/readiness.md` to met, with its
   evidence, or not met, with the gap. Set **Opened** to today.
10. Run `.ai/bin/check`, then the [`phase-gate`](audits/phase-gate.md) audit across all gates; it
    names the highest gate whose criteria all hold.

## Done when

- Every placeholder is filled, or listed in the hand-off with the question it waits on.
- The retroactive ADRs await the owner's confirmation; every kept file is reconciled.
- Every existing capability in scope has a spec or a row on the legacy register.
- The baseline audits are filed, and every Critical finding is named in the hand-off.
- `.ai/bin/check` passes, or each failure is listed with its cause.
- The phase-gate report names the phase the evidence supports. `AGENTS.md`'s **Phase** line is
  unchanged — setting it is the owner's decision.
