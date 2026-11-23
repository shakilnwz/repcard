# Performance Audit

Find the work whose cost grows with data, traffic or tenants faster than it should: unindexed
lookups, N+1 queries, whole-table aggregates on every page load, fan-out in jobs, unbounded caches,
heavy bundles. Rank by the path's importance times its growth, not by how ugly the code is.

**Mode:** Read-only, under [`auditing.md`](../../../docs/conventions/auditing.md). `EXPLAIN` on
development databases is allowed; load tests are not run unless the caller names an environment.
**Output:** `docs/reports/YYYY-MM-DD-performance.md` from
[`report.md`](../../../docs/templates/report.md).
**Inputs:** the apps in scope (default: all), whether frontend bundles are measured (default: yes,
from the latest build output, with its date stated).

## Before you start

1. Pin the tree.
2. Read the list-endpoint and asynchronous-work sections of
   [`architecture.md`](../../../docs/conventions/architecture.md) and the **Database** section of
   [`coding.md`](../../../docs/conventions/coding.md).
3. Read prior performance reports; carry findings still present.

## Scope

- **Default:** entry points, Actions, Queries, reusable filters, Responses, Jobs, Listeners,
  scheduled commands, migrations (for indexes), the request pipeline (startup, middleware, module
  discovery, settings, cache, session, queue configuration), frontend entrypoints and build output,
  container and server configuration.
- **Excluded:** correctness (bugs audit); infrastructure sizing outside the repository.

## Bar

A finding is a cost that grows with data, traffic or tenants on a reachable path, or a fixed cost
paid on every request that need not be. State the growth: linear in what, per what.

## Method

1. **Money paths first:** webhook resolution, checkout, invoicing, usage counts, anything under a
   row lock. For each query: the predicate, the index it can use (`EXPLAIN`), and whether it runs
   under `FOR UPDATE`.
2. **Read paths:** dashboards and overviews (aggregates per load, caching), lists (search predicate,
   correlated subqueries, cross-connection relation filters), Responses lazy-loading relations.
3. **Background work:** scheduled commands (per-entity loops, re-dispatch on every run), jobs
   fanning out per recipient synchronously, chunking of large sets.
4. **Lifecycle:** what every request pays — startup work, settings loaded, the framework's production
   optimisations, session and cache drivers.
5. **Frontend:** entry chunk sizes, code splitting per route, large dependencies, images unoptimised,
   icons inlined in bulk.
6. **Runtime config:** the runtime's production tuning (see *Stack notes*), debuggers off outside
   development, compression and cache headers on static assets.
7. Re-read every High finding.

## Checklist

- [ ] Every money-path lookup has an index the predicate can use; none scans under a lock.
- [ ] No N+1: relations eager-loaded where iterated; lazy loading prevented outside production.
- [ ] No leading-wildcard `LIKE` on a growing table without an alternative.
- [ ] Dashboards cache with a TTL and a version key; no whole-table aggregate per load.
- [ ] Scheduled commands are set-based or chunked, and do not re-dispatch work already queued.
- [ ] Notifications fan out on the queue, not inside the request or a single job per recipient set.
- [ ] Caches are bounded: keys enumerable, TTLs set, versions bumped atomically.
- [ ] Production runs with the framework's production optimisations.
- [ ] Each SPA route is code-split; the entry chunk excludes route-only dependencies.

## Severity

| Severity | In this audit |
| --- | --- |
| High | Linear-or-worse cost on a money path or under a lock; a scheduled job whose cost grows with the platform and runs frequently |
| Medium | Linear cost on an admin or customer read path; uncached aggregates; cross-connection correlated queries |
| Low | Fixed overhead per request; bundle weight; container tuning |

## Stack notes

| Stack | Notes |
| --- | --- |
| Laravel | `preventLazyLoading()`; `config:cache`, `route:cache`, `view:cache`, `event:cache` in deploy; opcache and FPM worker counts; xdebug off |
| .NET | Lazy-loading proxies or per-row queries in loops; tracking queries on reads (`AsNoTracking` missing); cartesian explosion from several `Include`s without `AsSplitQuery`; sync-over-async blocking the thread pool; `HttpClient` created per request; output caching and response compression |
| Next.js | Request waterfalls in Server Components; `'use client'` sprawl inflating client bundles; uncached reads on hot pages and blanket dynamic rendering; RSC payload size; images outside `next/image`; `@next/bundle-analyzer` per route |
| React | Route-level lazy loading; heavy dependencies in the entry chunk; re-render cascades from unstable context values or props; long lists without virtualisation; `rollup-plugin-visualizer` per route |
| Vue | Route-level code splitting; heavy dependencies in the entry chunk; deep reactivity over large lists |

## Output

- IDs prefixed `B` (backend and infrastructure) and `F` (frontend).
- Each finding states its growth (`O(n)` in what) and, where measured, the number with its source.

## Done when

- Every money path was traced to its queries and their indexes.
- Bundle figures name the build they were taken from and its date.
- Every High was re-read at the pinned commit.
