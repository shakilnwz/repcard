# Architecture Conformance Audit

Measure the code inside each module against [`architecture.md`](../../../docs/conventions/architecture.md)
and [`coding.md`](../../../docs/conventions/coding.md), as the app's stack profile realises them:
every place the one-way flow is broken, a layer does another layer's work, a surface is
re-declared, or a code-shape rule is not followed. Drift is cheap to fix while it is rare and
expensive once it is the pattern new code copies.

**Mode:** Read-only, under [`auditing.md`](../../../docs/conventions/auditing.md).
**Output:** `docs/audit/architecture.md` from [`audit.md`](../../../docs/templates/audit.md),
updated in place on re-runs. A deep dive into one rule (`Get*` Actions, query placement, Command
purity, hand-rolled payloads, enum predicates) may instead be filed as its own report and linked.
**Inputs:** the rules in scope (default: all of `architecture.md` and `coding.md` except what other
audits own), and the modules (default: all).

## Before you start

1. Pin the tree.
2. Read both conventions in full, the stack profile of every app in scope, and every `.ai/rules/`
   file whose paths cover server code.
3. Read the arch tests. A rule an arch test enforces, and that passes, needs no manual sweep — note
   it as covered.

## Scope

- **Default:** every module's server code; every app-level composition root (providers,
  `Program.cs`, `src/server/`).
- **Excluded:** relations *between* modules (modularity audit), names (naming audit), the same
  concern done differently in two places (consistency audit), behaviour (bugs, spec conformance),
  security (security audit), frontend (frontend audit).

## Bar

A finding is a rule in either convention, as the profile realises it, broken at a named location.
Behaviour does not matter: a violation is wrong even if it works. A rule the code contests — where
the code is right and the convention is wrong — is reported as **Contested**, for an ADR, not as a
violation.

## Method

Split into passes by rule family, each run across every module:

1. **Flow and layers:** entry points holding rules, transactions or a second Action; Actions reading
   the transport or returning transport responses; Jobs and Listeners holding rules; Models holding
   predicates or business logic.
2. **Reads:** `Get*`/`Find*` Actions that are plain reads; reads carrying rules left in entry
   points; Queries that are thin filter wrappers or that decide; reusable filters that execute.
3. **Surfaces:** entry points outside a declared surface; entry points setting their own host,
   prefix, authentication or surface policy; anything reachable that the deny-by-default rule
   should have covered; `edit` endpoints on a JSON API.
4. **Lists:** lists with a Command or Action; hand-rolled envelopes; rows projected after the query
   executed; list payloads widened with non-list data.
5. **Responses and Commands:** hand-rolled payloads; Responses flattened and merged; non-pure
   Commands; Commands reused as Responses; Responses issuing queries.
6. **Code shape:** construction inside arguments; Action results and queries inlined into arguments;
   computed Action arguments; model member order per the profile; missing types, `final`/`sealed`,
   immutability; strict mode off anywhere.
7. **Asynchronous work:** Jobs restating tier settings; dispatch inside transactions before commit;
   non-idempotent Jobs without a lock.

Every grep hit is read in context. Re-read every High finding before writing it.

## Checklist

- [ ] Every entry point is one of: plain read, list, Query call, or Command → one Action.
- [ ] Every Action decides, mutates or coordinates; none touches the transport.
- [ ] Every Model holds only persistence mapping.
- [ ] Every entry point sits in a declared surface and sets nothing its surface sets.
- [ ] Every response shape is a Response, the list envelope, or the bare acknowledgement.
- [ ] Every Command is pure and immutable.
- [ ] Code-shape rules hold.
- [ ] Every mechanically checkable rule broken here is proposed for an arch test.

## Severity

| Severity | In this audit |
| --- | --- |
| High | A violation new code is likely to copy (it is the majority pattern somewhere); an entry point outside every surface; a Job or entry point holding a money or state rule |
| Medium | A layer doing another's work in one place; a non-pure Command; a hand-rolled payload |
| Low | Code-shape and ordering drift |

## Stack notes

| Stack | Notes |
| --- | --- |
| Laravel | Entry points are controllers; `RouteFileTest` covers route files; look for `DB::` and `Model::query()` with rules in controllers, `$casts` properties, `scope*` methods holding rules |
| .NET | Entry points are `Map*` lambdas and controller actions; look for `DbContext` used with rules in endpoints, handlers returning `IResult`, `RequireAuthorization` with surface policies on single endpoints, entities with behaviour |
| Next.js | Entry points are server actions, `route.ts` and `page.tsx`; look for unwrapped actions, rules inside pages or components, ORM calls outside `server/`, ORM objects passed to client components |

## Output

- IDs area-prefixed by rule family: `F` flow, `R` reads, `SF` surfaces, `L` lists, `D` responses and
  Commands, `S` shape, `A` asynchronous.
- A **Proposed arch tests** section: each mechanically checkable rule that failed, with the check.
- A **Contested** section for rules the code argues against.

## Done when

- Every rule family ran across every module, or is listed under **Not checked**.
- Every High was re-read at the pinned commit.
