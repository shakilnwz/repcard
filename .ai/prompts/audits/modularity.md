# Modularity Audit

Decide whether the modular architecture is real or only folders. The question is not whether
modules are independent — modules legitimately need each other — but whether every interaction
between them crosses a **governed seam**: a published contract, an event, a Query, and nothing else.
Measure the dependency graph, its direction, its invisible edges, data ownership, and whether
tooling enforces any of it, against the modularity level ADR-0002 declares.

**Mode:** Read-only, under [`auditing.md`](../../../docs/conventions/auditing.md). Graph tools may be
run from outside the tree, writing only to a scratch directory.
**Output:** `docs/reports/YYYY-MM-DD-modularity.md` from
[`report.md`](../../templates/report.md).
**Inputs:** the apps in scope (default: every app ADR-0002 declares modular). A non-modular app is
out of scope; say so and stop.

## Before you start

1. Pin the tree.
2. Read [`architecture.md`](../../../docs/conventions/architecture.md) → *Modules* and ADR-0002: the
   module list, the shared kernel, the declared dependency graph, and the **modularity level**.
3. Read the stack profile's module section: what the public surface is and how visibility is
   enforced in that stack.
4. Read earlier modularity, independence and seam reports; the trend matters more than the snapshot.

## Scope

- **Default:** every module of every modular app — server code, migrations, configuration,
  translations, routes, tests, and the matching frontend feature.
- **Excluded:** layering inside one module (architecture conformance).

## Bar

A finding is an edge between modules that does not cross a published seam, a breach of the
dependency direction or of the declared modularity level, a module that is not one bounded slice,
or a graph no tool enforces.

## Method

1. **Inventory.** For each module: its one-sentence responsibility, its public surface (the
   contracts, events and Queries it publishes), its tables, its routes.
2. **Explicit edges.** Every import, `use`, `using` or project reference from one module into
   another. Classify each by target: **seam** (published contract, event, Query, client-safe index)
   or **direct** (Model or entity, Action, Repository, internal service, Response, component).
3. **Invisible edges.** Translation and view namespaces of another module; configuration keys of
   another module; container bindings or service lookups by string; event names as strings;
   foreign keys, joins and raw queries touching another module's tables; frontend imports between
   features. Dynamically resolved edges make every count a floor — say so.
4. **Graph.** Build the module × module matrix (count and kind of edge). Find cycles. Check the shared
   kernel depends on no feature module and holds no domain feature.
5. **Metrics.** Per module: afferent coupling Ca (who depends on it), efferent coupling Ce (what it
   depends on), instability I = Ce / (Ca + Ce). A stable module (low I) depending on an unstable one
   (high I) breaks the stable-dependencies principle. Note where coupling concentrates — a handful of
   Models usually carry most of it.
6. **Data ownership.** Each table owned by exactly one module; writes to a table only from its owner;
   at Level 2 or 3, no cross-module foreign key, join or query at all.
7. **Events.** Payloads carry identifiers and facts, not Models; listeners in other modules do not
   reach back into the emitter's tables.
8. **Co-change.** From `git log --name-only` over the last 6 months, count commits that touch two
   modules together. Pairs that change together far more often than apart have a hidden seam, or
   are one module.
9. **Autonomy.** Can each module's tests run without other feature modules' internals? If a module
   were removed, what breaks besides its declared dependents?
10. **Enforcement.** Is the declared graph checked in CI? An unguarded graph is a finding at every
    gate from G1.
11. Re-read every High finding before writing it.

## Checklist

- [ ] Every cross-module edge classified seam or direct, invisible edges included.
- [ ] The graph is acyclic, and the shared kernel depends on nothing above it.
- [ ] Every table has one owner; the declared level holds.
- [ ] Event payloads carry no Models across seams.
- [ ] Ca, Ce and I computed; stable-dependencies breaches listed.
- [ ] Co-change pairs listed.
- [ ] The graph is enforced by tooling in CI.

## Severity

| Severity | In this audit |
| --- | --- |
| High | A cycle; the shared kernel depending on a feature module; a module writing another's tables; a breach of the declared level (a cross-schema join at Level 2); no enforcement of the graph after G1 |
| Medium | Direct reads of another module's Models or internals; invisible edges; Models crossing seams in events; strong co-change between modules; a god module owning other modules' concerns |
| Low | Inventory gaps: an unclear responsibility, an unpublished but unused surface |

## Stack notes

| Stack | Notes |
| --- | --- |
| Laravel | Explicit edges: `grep -rn "^use Modules\\\\" modules/<A>/` minus `Modules\<A>`; invisible: `<module>::` in PHP, Blade and Twig, `config('<module>.')`; enforcement: `deptrac` |
| .NET | Explicit edges: `<ProjectReference>`s (only `.Contracts` allowed) and `using` of other modules' namespaces; visibility: `public` types outside `.Contracts`, `InternalsVisibleTo` beyond the test project; data: one `DbContext` per module, `HasDefaultSchema`; enforcement: NetArchTest or ArchUnitNET |
| Next.js | Explicit edges: imports of `@/modules/<other>/…` beyond `index.ts` and `server/index.ts`; `server-only` respected; enforcement: `dependency-cruiser` or `eslint-plugin-boundaries`, run with `npx` from outside the tree |
| React | Feature folders importing another feature's internals instead of its `index.ts`; enforcement: `eslint-plugin-boundaries` or `dependency-cruiser` |
| Vue | Feature folders importing another feature's internals instead of its `index.ts` |

## Output

- **Dependency matrix** (module × module: count, seam/direct) and a Mermaid graph of the direct edges.
- **Metrics** table: module · Ca · Ce · I · tables owned.
- **Co-change** table: module pair · commits together · commits apart.
- Findings with IDs `MD1…`.

## Done when

- Every module's edges, explicit and invisible, were collected, or the gap is listed under
  **Not checked**.
- The report states plainly whether the declared level holds and whether the graph is enforced.
- Every High was re-read at the pinned commit.
