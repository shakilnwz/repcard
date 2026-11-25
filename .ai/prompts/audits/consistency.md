# Consistency Audit

Find the same concern done different ways: one concern implemented twice, code that was once
identical and has forked, a hardening applied to one sibling and not the others, several mechanisms
for one job, the same resource answered in different shapes, client and server disagreeing about the
same rule. Every discrepancy is a place where a fix lands once and is missing twice.

**Mode:** Read-only, under [`auditing.md`](../../../docs/conventions/auditing.md).
**Output:** `docs/reports/YYYY-MM-DD-consistency.md` from
[`report.md`](../../templates/report.md).
**Inputs:** what to compare (default: every module against its siblings, every app against the
others, every surface against the others, client against server).

## Before you start

1. Pin the tree.
2. Read [`architecture.md`](../../../docs/conventions/architecture.md),
   [`coding.md`](../../../docs/conventions/coding.md) and
   [`frontend.md`](../../../docs/conventions/frontend.md), the stack profiles, and
   `docs/reference/glossary.md`.
3. Read earlier consistency, discrepancy and duplication reports; mark what converged, what is still
   split, and what forked since.

## Scope

- **Default:** every app, module and frontend surface; configuration; shared packages.
- **Excluded:** naming alone (naming audit); unreachable duplicates (dead-code audit). A difference
  recorded in an ADR or a spec as deliberate is not a finding.

## Bar

A discrepancy is two or more places handling the same concern differently with no recorded reason.
Each finding names every variant, which one should win — usually the hardened, the newer, or the
convention-conforming one — and why.

## Method

1. **Concern inventory.** For each cross-cutting concern — authentication, authorization checks,
   HTTP client, error shape, logging, i18n, pagination and list envelope, money, dates and their
   serialisation, notifications, file storage, settings, queues and retry policy, caching, feature
   flags — list every implementation in every app, module and surface (grep for the mechanism's
   imports and base classes). More than one → finding, unless recorded.
2. **Parallel subsystems.** Same-named modules across apps: are they the same subsystem (compare
   classes and behaviour) or false friends? Different-named modules doing the same job?
3. **Forks.** Files at the same relative path across apps or modules: identical (md5), near-identical
   (whitespace-normalised similarity ≥ 85%), or forked API-incompatibly. A fork grows more expensive
   to merge with every commit.
4. **Asymmetric hardening.** For each security- or reliability-relevant fix in `git log` (secrets
   handling, middleware, transaction boundaries, after-commit dispatch, throttling, validation),
   check whether every sibling received it.
5. **Shape discrepancies.** For each entity exposed by more than one endpoint, app or surface,
   compare the response shapes, field names, casing and error formats.
6. **Surface asymmetries.** For each capability present on more than one surface or for more than
   one entity of the same kind, compare what each allows — a status route here and not there, bulk
   delete for one entity and not its sibling — against the specs.
7. **Client against server.** Validation rules, enums, limits and defaults defined on both sides;
   generated types against what the server returns.
8. **Configuration.** The same setting across apps and environments: queue `after_commit`, retry and
   timeout pairs, cache stores, session settings, date formats.
9. Re-read every High finding before writing it.

## Checklist

- [ ] Every cross-cutting concern has one mechanism per app, or the difference is recorded.
- [ ] Same-named subsystems classified: same, near-duplicate, or false friend.
- [ ] Every once-identical file pair classified: identical, near, forked.
- [ ] Every hardening fix checked across siblings.
- [ ] Every multi-endpoint entity checked for one shape.
- [ ] Client and server rules agree.

## Severity

| Severity | In this audit |
| --- | --- |
| High | A hardening present in one sibling and missing in another (one is still exposed); client and server disagreeing on a rule the server must enforce; a shape mismatch that breaks a flow |
| Medium | Parallel implementations diverging; several mechanisms for one concern; forks of once-shared code; shape or envelope discrepancies |
| Low | Cosmetic differences with no behavioural effect |

## Stack notes

| Stack | Notes |
| --- | --- |
| Laravel | Compare `bootstrap/app.php` middleware stacks, `config/queue.php`, model date serialisation, Resource shapes, route-name patterns (`*.status.update` against `*.update-status`) |
| .NET | Compare `Program.cs` pipelines, exception handlers and ProblemDetails customisation, `JsonSerializerOptions`, policies per surface |
| Next.js | Compare surface wrappers, server-action result shapes, fetch and cache options, error boundaries |
| React | Count HTTP clients, query-key schemes, i18n set-ups, notification and table implementations across SPAs |
| Vue | Count HTTP clients, i18n set-ups, notification and table implementations across SPAs |
| Across stacks | When two apps on different stacks serve the same domain, compare their API contracts and enums field by field |

## Output

- IDs `K1…`. Each finding has a **Variants** table: location · behaviour · verdict (canonical or
  converge).
- A **Concern matrix**: concern × app/surface, naming the mechanism each uses.

## Done when

- Every concern in the inventory was checked across every app and surface in scope.
- Every finding names its canonical variant.
- Every High was re-read at the pinned commit.
