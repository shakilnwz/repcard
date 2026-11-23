# Readiness Audit

Living record of the project's progress against the gates in
[`lifecycle.md`](../conventions/lifecycle.md), kept current: when a criterion closes, its row
changes rather than a note being appended. The criteria themselves are defined there; this page
only tracks them. Paths are relative to the project root.

**Opened:** <!-- bootstrap: YYYY-MM-DD, and the commit when the project is under version control -->
**Last verified:** <!-- the phase-gate report that last checked every row -->

## What "met" means here

A criterion is **met** when its condition can be shown at HEAD — a file, a passing check, a fresh
report — and the row's evidence column points at it. A criterion is **waived** only by the project
owner, with the reason on the row. Excluded from every verdict: work belonging to a later gate,
however far along it is.

Status — ✅ Met · ⚠️ Waived (reason on row) · ❌ Not met.

## Status

**0 met · 0 waived · 40 not met.** Current phase: **0 — Bootstrap**.

| Gate | Met | Waived | Not met |
| --- | ---: | ---: | ---: |
| G0 Bootstrap | 0 | 0 | 9 |
| G1 Foundation | 0 | 0 | 10 |
| G2 Build | 0 | 0 | 6 |
| G3 Harden | 0 | 0 | 9 |
| G4 Release | 0 | 0 | 6 |

### G0 — Bootstrap

| ID | Criterion | Status | Evidence / blocking reason |
| --- | --- | --- | --- |
| G0.1 | Rules installed; placeholders filled; agents configured | ❌ Not met | — |
| G0.2 | ADR-0001: stack per app; Stacks table filled; unused profiles removed | ❌ Not met | — |
| G0.3 | ADR-0002: shape, modules, modularity level | ❌ Not met | — |
| G0.4 | Context page: people, external systems, capabilities | ❌ Not met | — |
| G0.5 | Glossary | ❌ Not met | — |
| G0.6 | Project hygiene | ❌ Not met | — |
| G0.7 | One-command local boot, documented | ❌ Not met | — |
| G0.8 | CI: lint, format, types, test, build per app, and `.ai/bin/check` | ❌ Not met | — |
| G0.9 | Pull-request templates point at conventions and specs | ❌ Not met | — |

### G1 — Foundation

| ID | Criterion | Status | Evidence / blocking reason |
| --- | --- | --- | --- |
| G1.1 | Surfaces declared; surface table filled | ❌ Not met | — |
| G1.2 | Modules exist; graph enforced by tooling | ❌ Not met | — |
| G1.3 | Arch tests enforce mechanical conventions | ❌ Not met | — |
| G1.4 | Authentication and authorization specified, Implemented, deny by default | ❌ Not met | — |
| G1.5 | Logging, error tracking, queue tiers, failed-job sink | ❌ Not met | — |
| G1.6 | Config stops the start when missing; locks atomic | ❌ Not met | — |
| G1.7 | Test database isolated and guarded | ❌ Not met | — |
| G1.8 | Frontend shell | ❌ Not met | — |
| G1.9 | Deploy to staging migrates the right database | ❌ Not met | — |
| G1.10 | Architecture, modularity, dependencies, operations audits clean of Critical/High | ❌ Not met | — |

### G2 — Build

| ID | Criterion | Status | Evidence / blocking reason |
| --- | --- | --- | --- |
| G2.1 | Every in-scope capability's spec Implemented | ❌ Not met | — |
| G2.2 | Every requirement traced to a passing test | ❌ Not met | — |
| G2.3 | Spec conformance: no High divergence or overreach | ❌ Not met | — |
| G2.4 | Every plan Done or out of scope | ❌ Not met | — |
| G2.5 | Workflow document per money or state flow | ❌ Not met | — |
| G2.6 | Build-phase audits: no Critical; High planned | ❌ Not met | — |

### G3 — Harden

| ID | Criterion | Status | Evidence / blocking reason |
| --- | --- | --- | --- |
| G3.1 | Security: no open Critical/High | ❌ Not met | — |
| G3.2 | Bugs: no open Critical/High | ❌ Not met | — |
| G3.3 | Performance: no High; money paths indexed; spec budgets met | ❌ Not met | — |
| G3.4 | Simplification, dead code, complexity: fixed or backlogged | ❌ Not met | — |
| G3.5 | Naming and consistency: no High; Medium fixed or backlogged | ❌ Not met | — |
| G3.6 | Modularity: no cycle, undeclared seam or level breach | ❌ Not met | — |
| G3.7 | Documentation drift: no open High | ❌ Not met | — |
| G3.8 | Frontend: no open High on a11y, i18n, console | ❌ Not met | — |
| G3.9 | Backups restored once; monitoring; runbook | ❌ Not met | — |

### G4 — Release

| ID | Criterion | Status | Evidence / blocking reason |
| --- | --- | --- | --- |
| G4.1 | Phase-gate audit at the release commit; audits fresh | ❌ Not met | — |
| G4.2 | Zero open Critical/High; rest fixed or accepted | ❌ Not met | — |
| G4.3 | Every released spec Implemented; release notes list them | ❌ Not met | — |
| G4.4 | Rollback planned and tested | ❌ Not met | — |
| G4.5 | Production configuration verified | ❌ Not met | — |
| G4.6 | Tagged; phase line reads Released; docs match release | ❌ Not met | — |

## Blocked criteria

One section per criterion of the current gate that is blocked by something beyond doing the work:
what blocks it, where, and the smallest change that clears it. A criterion that is merely not yet
done gets no section.

## Backlog

Findings and criteria the owner accepted as open past a gate.

| Item | Area | Note |
| --- | --- | --- |
