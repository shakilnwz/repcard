# Dead Code and Weight Audit

Find what the project carries and does not use: unreachable classes, routes and components;
unused dependencies, config, translations and binaries; and code duplicated where a shared home
exists. Every line kept is a line read, upgraded and audited forever.

**Mode:** Read-only, under [`auditing.md`](../../../docs/conventions/auditing.md). Nothing is deleted
by the audit.
**Output:** `docs/reports/YYYY-MM-DD-dead-code-and-weight.md` from
[`report.md`](../../../docs/templates/report.md). In a monorepo, one report per app plus one for
what crosses apps and shared packages.
**Inputs:** the apps and packages in scope (default: all).

## Before you start

1. Pin the tree.
2. Read prior dead-code reports; mark which of their findings are gone, still present, or grew.
3. List the entry points the framework calls by convention — routes, scheduled commands, listeners
   and handlers discovered by attribute or convention, auto-discovered policies, view components,
   assembly-scanned registrations, file-system routes (`page.tsx`, `route.ts`) — so nothing reached
   only by convention is reported dead.

## Scope

- **Default:** every app and module, frontend sources, translations, tracked public assets,
  `packages/`, root tooling (`.github/`, `docker/`, `scripts/`, task runner), and every manifest.
- **Excluded:** `vendor/`, `node_modules/`, `bin/`, `obj/`, `.next/`, `dist/` and other build output.

## Bar

A finding is **certain** when no reference exists by name, by path, by string (route names,
container keys, translation keys) or by convention-based discovery, searched across the whole
repository. It is **likely** when the only references are themselves dead. Report the two
separately; only certain findings carry a "delete" fix.

## Method

1. **Backend:** for each class, search references by FQCN, short name and string; for each route,
   search its name and URI in backend and frontend; for each config key and translation key, search
   its dotted name.
2. **Frontend:** for each component and module, match every named, default, deep and asset-query
   import (`?raw`, `?url`) against exports; for barrels, list exports no consumer imports.
3. **Dependencies:** for each manifest entry, find an import or a config reference; note vendor size
   freed by removal.
4. **Duplication:** md5 of files at the same relative path across apps; then whitespace-normalised
   comparison and a similarity ratio for near-duplicates (≥ 85%). Report duplication only where a
   shared home exists or should.
5. **Binaries:** `git ls-files -z | xargs -0 du -b`, then search each asset's path and filename.
6. Re-grep every certain finding by name and by path before writing it.

## Checklist

- [ ] Unreferenced classes, Actions, Jobs, Listeners, Policies, commands.
- [ ] Routes no frontend or test calls; controllers no route reaches.
- [ ] Components, composables, stores and barrel exports nothing imports.
- [ ] Config keys, env vars and translation keys nothing reads.
- [ ] Manifest dependencies nothing imports; dev tools nothing runs.
- [ ] Tracked binaries nothing references; oversized images.
- [ ] Byte- and near-identical code across apps with an existing shared home.
- [ ] Feature flags permanently on or off; settings saved but never read.
- [ ] Empty files, empty directories with `.gitkeep` that now have siblings, stale scaffolding.

## Severity

| Severity | In this audit |
| --- | --- |
| Medium | Large duplication with a shared home; a dependency with a security or upgrade burden kept for nothing; dead code that looks live and misleads |
| Low | Unused code, assets and keys with no other cost |

## Stack notes

| Stack | Notes |
| --- | --- |
| Laravel | Search by FQCN, short name and string; routes from `php artisan route:list --json`; unused packages with `composer-unused` |
| .NET | Build a scratch copy with IDE0051, IDE0052 and CA1812 as warnings; `public` types unreferenced outside their project; unused `PackageReference`s |
| Next.js | `knip`, run from outside the tree, for unused files, exports and dependencies; a `page.tsx` is reachable by URL even when nothing links it — dead only if no spec requires it |
| React | `knip`, run from outside the tree, for unused files, exports and dependencies; components never rendered; routes no navigation reaches |
| Vue | `knip` with its Vue support; components never imported; routes no navigation reaches |

## Output

- Headline table: certain deletions (LOC), consolidation candidates (LOC), binaries (KB), packages
  freed — per app.
- **Certain** and **Likely** listed separately within each finding.

## Done when

- Every class, route, component and manifest entry in scope was checked, or is listed under
  **Not checked**.
- Every certain finding was re-grepped by name and path at the pinned commit.
