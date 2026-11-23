# Documentation Drift Audit

Find every place the documentation says something the code no longer does. A stale descriptive
page wastes a reader's time; a stale page that contradicts a convention misleads an implementer
into wrong code; a stale `AGENTS.md` misleads every agent in every session.

**Mode:** Read-only, under [`auditing.md`](../../../docs/conventions/auditing.md). Drift is
reported, not fixed.
**Output:** `docs/reports/YYYY-MM-DD-documentation-drift.md` from
[`report.md`](../../../docs/templates/report.md).
**Inputs:** the document trees in scope (default: all but `reports/`).

## Before you start

1. Pin the tree.
2. Read [`documentation.md`](../../../docs/conventions/documentation.md): the layout, the three kinds,
   the lifecycle per kind.

## Scope

- **Default:** `AGENTS.md`, `CLAUDE.md`, `README.md`; `docs/{adr,architecture,audit,conventions,
  plans,reference,workflows}`, and the same under `apps/*/docs/`; `.ai/rules/`, `.ai/prompts/`;
  `docs/templates/`; pull-request templates; the `Related:` links and status lines of `docs/specs/`.
- **Excluded:** `reports/` — point-in-time by rule, never drift. What specs and `features/` *require*
  — the spec-conformance audit owns whether code matches them; a spec the code disagrees with is not
  drift but a divergence or a spec change.

## Bar

A finding is a statement in a document that is false at the pinned commit, a document in the wrong
place or shape under `documentation.md`, or a normative statement in a descriptive page.

## Method

1. **Identifiers:** extract every backticked identifier — class, method, path, route name, config
   key, env var, command, table, column — and grep each against the code. A miss is a finding.
2. **Behaviour:** trace every workflow's steps and every reference page's mechanics through the
   cited code. A call that no longer happens, an order that changed, a count that moved.
3. **Status lines:** every plan's status against the code; every ADR's status against what
   superseded it; every living audit's open rows against HEAD.
4. **Authority:** every "must", "never", "always" outside `conventions/` and `.ai/rules/`; every
   descriptive statement contradicting a convention.
5. **Layout:** every file against the layout table — directory, file name, template shape, no
   indexes, `Related:` footer.
6. **Agent entry points:** `AGENTS.md`'s overview, commands, endpoints, and path table against the
   repository; `.ai/rules/index.md` against the rule files' `paths:`.
7. Spot-check every High finding before writing it.

## Checklist

- [ ] Every backticked identifier resolves.
- [ ] Every workflow traces.
- [ ] Every plan and ADR status is current.
- [ ] No descriptive page contradicts a convention or states a rule.
- [ ] `AGENTS.md` describes the repository as it is.
- [ ] Every rule file's globs match real paths.
- [ ] Layout and templates followed.

## Severity

| Severity | In this audit |
| --- | --- |
| High | A document that would lead an implementer to wrong code — a descriptive page contradicting a convention, a reference describing a rewritten subsystem, `AGENTS.md` wrong about structure or commands |
| Medium | A workflow tracing calls that no longer happen; a plan status behind the code; a phantom identifier |
| Low | Layout or template drift; a stale count |

## Output

- Summary table: document, drift, severity.
- Findings grouped by document; within each, the false statement quoted and the truth beside it.

## Done when

- Every document in scope was read and its identifiers checked, or it is listed under
  **Not checked**.
- Every High was spot-checked at the pinned commit.
