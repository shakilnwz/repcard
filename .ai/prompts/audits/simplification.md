# Simplification Audit

Find structure that is more complicated than the behaviour it delivers: abstractions with one
implementation, extension points nobody extends, configuration nobody sets, layers that only
delegate, hand-rolled versions of what the framework already does, and logic written the long way.
Where spec conformance finds *behaviour* nobody asked for, this audit finds *machinery* nobody
needs. Every finding names the simpler form.

**Mode:** Read-only, under [`auditing.md`](../../../docs/conventions/auditing.md). Nothing is
refactored by the audit.
**Output:** `docs/reports/YYYY-MM-DD-simplification.md` from
[`report.md`](../../../docs/templates/report.md).
**Inputs:** the modules in scope (default: all), and the latest complexity report to start from
(default: the newest in `docs/reports/`).

## Before you start

1. Pin the tree.
2. Read [`architecture.md`](../../../docs/conventions/architecture.md) and
   [`coding.md`](../../../docs/conventions/coding.md), and the stack profile of every app in scope.
   **What the conventions require is never a simplification finding:** an Action is not a
   pass-through layer, a module's published contract is not a speculative interface, a Command is
   not ceremony. Simplify inside the architecture, never around it.
3. Read the latest complexity, dead-code and simplification reports; carry what is still present.

## Scope

- **Default:** every module's server code and every frontend feature.
- **Excluded:** unreachable code (dead-code audit), measured branching (complexity audit),
  behaviour beyond the spec (spec conformance).

## Bar

A finding is a construct whose removal or replacement keeps every requirement's tests passing and
leaves the code shorter, flatter, or with fewer concepts — and no requirement, convention or
declared seam depends on what is removed. Each finding states the simpler form and what it costs to
get there.

## Method

1. **Speculative generality.** List every interface, abstract class, strategy, factory, registry,
   plugin point and generic type parameter, with its implementation count
   (`implements X`, `: IX`, `extends`, registrations). One implementation and no published seam →
   finding.
2. **Dead flexibility.** List every configuration key, feature flag, optional parameter and boolean
   argument, with every value it takes in code, config and tests. A flag that is always one value, a
   parameter always passed the same thing, a mode no caller selects → finding.
3. **Pass-through and indirection.** Services, helpers or wrappers whose methods only forward to one
   other method; call chains of three or more hops that add nothing; events with one listener in the
   same module where a direct call reads plainer.
4. **Reinvention.** Hand-rolled pagination, validation, retry, date arithmetic, money formatting,
   HTTP clients, caching, serialization, array/collection utilities — where the framework, the
   standard library or an installed package already provides it.
5. **Convoluted logic.** Nested conditionals that guard clauses flatten; `match (true)` or switch
   cross-products that a table or an enum method expresses; boolean flag parameters that split one
   function into two; double negatives; state that is derived but stored; loops a collection
   pipeline, LINQ or array method states in one line.
6. **Local duplication.** Repeated blocks inside one module that a private function would name.
   (Duplication across modules or apps belongs to the consistency audit.)
7. For each finding, sketch the simpler form and estimate the lines removed; read the tests that
   would have to pass unchanged.

## Checklist

- [ ] Every abstraction has more than one implementation, or is a declared seam.
- [ ] Every flag, option and parameter takes more than one value somewhere.
- [ ] No layer exists only to forward.
- [ ] No hand-rolled replacement for an available framework or library feature.
- [ ] Hotspots from the complexity report read for a simpler form.

## Severity

| Severity | In this audit |
| --- | --- |
| Medium | Machinery that misleads or slows every change in its area — a plugin system with one plugin, a generic repository over the ORM, a configuration layer nobody configures |
| Low | A local simplification: a flattened conditional, an inlined wrapper, a library call replacing hand-written code |

## Stack notes

| Stack | Notes |
| --- | --- |
| Laravel | Reinvention of collections, `Str`, `Http`, `Cache::remember`, `RateLimiter`, validation rules; service classes wrapping one Eloquent call |
| .NET | Generic repositories and unit-of-work wrappers over `DbContext`; mediator pipelines for in-process calls with one handler each; interfaces registered once and mocked nowhere; hand-written mapping where a projection does |
| Next.js | `'use client'` on components that need none; client-side fetching for data a Server Component can read; state libraries holding server data; wrapper components that only pass props |
| React | Effects that derived state or an event handler replaces; server data mirrored into a store; memoisation no measurement justifies; wrapper components that only pass props; context for values one subtree uses |
| Vue | Stores holding one view's state; watchers that a computed replaces; prop drilling a provide/inject or store would remove |

## Output

- IDs `S1…`. Each finding has **Before** (location and shape), **After** (the simpler form, sketched),
  **Lines** (estimated delta), **Risk** (what could break, and which tests guard it).
- A summary of estimated lines removed per module.

## Done when

- Every abstraction, flag and configuration key in scope was counted, or is listed under
  **Not checked**.
- Every finding names its simpler form and the tests that guard it.
