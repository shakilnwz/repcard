# Database Schema Audit

Deeply analyze the migrations and the overall database schema of **every application** in scope,
and report all discrepancies, anomalies, inconsistencies, design issues, potential bugs and
improvement opportunities. The schema is the part of a system most expensive to change later, and
the migration history is the part most likely to have silently diverged from the databases it
built.

**Mode:** Read-only, under [`auditing.md`](../../../docs/conventions/auditing.md). Do **not** modify,
create, delete or rewrite any file, migration, model or database structure. Do **not** execute
migrations, seeders or any statement that writes. `SELECT` and schema introspection only.
**Output:** `docs/reports/YYYY-MM-DD-database-schema.md` from
[`report.md`](../../templates/report.md).
**Inputs:** the apps and connections in scope (default: all), and a prior schema report to diff
against (default: the latest in `docs/reports/`).

## Before you start

1. Pin the tree: date, branch, short commit and subject, working-tree state.
2. Read the **Database** section of [`coding.md`](../../../docs/conventions/coding.md) and the
   money and concurrency rules in [`security.md`](../../../docs/conventions/security.md).
3. Search `docs/audit/` and `docs/reports/` for `schema`, `migration`, `database`, `index`. Carry
   every prior finding still present with a **Prior** note.
4. List every database connection or `DbContext` and which migrations run against which — module
   migration paths, tenant paths, package migrations, settings migrations.

## Scope

- **Default:** every migration in every app (see *Stack notes* for where they live), every Model or
  entity and its mapping, factories and seeders, the database and queue configuration, and the
  deploy steps that migrate.
- **Live databases:** the development databases, read with `SELECT` and `information_schema` only.
  Production is never touched; a claim about production is written as "not checked on production —
  look for <the observable sign>".
- **Excluded:** query performance beyond indexing (performance audit), data correctness inside rows.

## Bar

A finding is a place where the schema, the migration history, the models and the deploy disagree
with each other or with the conventions, or where the design will lose data, corrupt state or block
a predictable change. Excluded from every verdict: naming taste with no convention behind it.

## Method

1. Read every migration in run order, per connection. Reconstruct each table's final shape.
2. Compare the reconstruction against the live development schema. A difference means a migration
   was edited after it ran, a migration never ran, or the database was changed by hand — use
   `git log -p` on the migration to tell which.
3. Cross-check every Model against its table: `$table`, `$connection`, `$fillable`, `casts()`,
   relations and their foreign keys, enum casts against the stored values.
4. Trace every deploy workflow step that migrates: which connection is the default at that point,
   and which migration paths are registered.
5. Re-read every Critical and High finding against the code before writing it.

## Checklist

- [ ] **History:** any migration edited after it ran (`git log --follow -p`); live schema differing
      from the reconstruction; migrations that only work on an empty database.
- [ ] **Routing:** each connection migrates exactly the tables it should; tenant tables never land in
      the central database; deploy runs the right command per connection; nothing hides a failure
      with `|| true`.
- [ ] **Framework tables:** `jobs`, `failed_jobs`, `job_batches`, `cache`, `cache_locks`, `sessions`
      exist on the connection config points at.
- [ ] **Keys:** every foreign key exists as a constraint, matches the referenced column's type and
      signedness, and has a deliberate `onDelete`; no cascade removes financial or audit history.
- [ ] **Indexes:** every foreign key, every column a hot path filters, joins or sorts on, every
      unique business identifier; no duplicate or redundant indexes; composite index column order
      matches the queries.
- [ ] **Types:** no `ENUM` columns; money as integer minor units or `decimal`, never float; text
      lengths sized to content; JSON columns not used for data that is queried relationally;
      timezone handling consistent.
- [ ] **Naming:** temporal columns end in `_at`; booleans `is_`/`has_`; one name per concept across
      tables; pivot tables named consistently.
- [ ] **Integrity:** uniqueness enforced by the database where the domain requires it, not only in
      validation; nullable only where absence is meaningful; defaults that match the model.
- [ ] **Model parity:** casts match column types; enum casts cover every stored value; `$fillable`
      excludes columns that must not be mass-assigned; soft deletes declared on both sides.
- [ ] **Migrations' content:** one table created per migration; no data backfill, conditional logic
      or model calls; `down()` either correct or deliberately absent.
- [ ] **Seeders:** no credential usable outside local development; no seeder required for the app to
      boot in production.

## Severity

| Severity | In this audit |
| --- | --- |
| Critical | Deploy builds the wrong schema in the wrong database; data loss by cascade on a main flow; framework table missing so failures are lost |
| High | Live schema diverged from migrations; missing constraint lets money or state go wrong; unindexed lookup on a money path |
| Medium | Missing index that grows with data; type or nullability mismatch with the model; enum or naming drift with behavioural effect |
| Low | Naming drift, redundant index, cosmetic default mismatch |

## Stack notes

| Stack | Notes |
| --- | --- |
| Laravel | Migrations in `database/migrations` and `modules/*/database/migrations`; model parity through `casts()`, `$fillable`, relations; framework tables `jobs`, `failed_jobs`, `job_batches`, `cache_locks`, `sessions` |
| .NET | Migrations per `DbContext` under each module's `Migrations/`; model parity through `IEntityTypeConfiguration<T>` and the model snapshot; check `HasDefaultSchema` per module at modularity Level 2; concurrency tokens on state-bearing entities |
| Next.js | Prisma `schema.prisma` and `prisma/migrations`, or Drizzle schema and its migrations folder; drift between the schema file and the applied migrations; `@@index` on hot predicates |

## Output

- Findings grouped by severity, each with location (`migration:line`, `Model:line`, workflow step).
- A **Per-table notes** appendix for tables with several minor findings, rather than one finding each.

## Done when

- Every migration in scope was read and every Model cross-checked, or listed under **Not checked**.
- Every live-schema comparison names the database it was taken against.
- Every Critical and High was re-read at the pinned commit.
