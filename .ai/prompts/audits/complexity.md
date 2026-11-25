# Complexity and Size Audit

Measure cyclomatic complexity, method length and file size across every language in the project,
and name the hotspots worth splitting. The numbers are a map, not a verdict: a lookup table on an
enum scores high and is fine; an entry point with six guard returns scores the same and breaks the
flow. Simpler *forms* for what the hotspots do belong to the simplification audit, which starts from
this report.

**Mode:** Read-only, under [`auditing.md`](../../../docs/conventions/auditing.md). A measurement tool
may be run if it writes only outside the tree — `lizard` (one tool for PHP, C#, TypeScript and
JavaScript, run with `uvx lizard` or `pipx run lizard`), the stack's analyzer in a scratch copy, or a
small AST walker written in a scratch directory with the project's own parser. Never install a
dependency into the project.
**Output:** `docs/reports/YYYY-MM-DD-complexity-and-size.md` from
[`report.md`](../../templates/report.md).
**Inputs:** languages in scope (default: every server and frontend language in the repository),
thresholds (default below).

## Before you start

1. Pin the tree.
2. Read the **Size and complexity** section of [`coding.md`](../../../docs/conventions/coding.md),
   and the stack profiles' tooling sections.
3. Read the previous complexity report; the trend matters more than the snapshot.

## Scope

- **Default:** all server code (`*.php`, `*.cs`, server-side `*.ts`) and all frontend script
  (`*.ts`, `*.tsx`, and the `<script>` blocks of `*.vue`, extracted to scratch files first).
- **Excluded:** translations, templates and markup, migrations, generated code (OpenAPI clients,
  EF model snapshots, type declarations), `vendor/`, `node_modules/`, `bin/`, `obj/`, build output.

## Bar

**Counting:** each function starts at 1; add one for each `if`, `else if`/`elseif`, `for`,
`foreach`, `while`, `do`, `catch`, ternary, null-coalescing operator, `&&`/`||` (and PHP's
`and`/`or`/`xor`), non-default `case`, and non-default `match`/`switch` expression arm. Closures,
lambdas and arrow functions count toward the function that contains them. When a tool counts
differently, name the tool and its rule in the report so runs stay comparable.

**Secondary metric:** cognitive complexity (nesting-weighted), where a tool for the language is
available, reported beside cyclomatic for the hotspots only.

**Thresholds:** complexity > 10 is a hotspot; > 15 is high. Function > 50 lines, class > 300 lines,
component script > 200 lines are size hotspots. A hotspot is a finding only when the branching or
size is reducible — say why for each.

## Method

1. Measure every function per language: complexity, lines, file, type.
2. Produce the distribution per language: count, total, mean, median, P90/P95/P99, max; buckets 1,
   2–5, 6–10, 11–20, 21–50, > 50.
3. List hotspots with score, lines and location; read each and classify: **reducible** (split it,
   and how) or **irreducible** (a lookup, a dispatcher on an enum — why).
4. Largest files: top 20 by lines per language, with what each type does and whether it is one
   thing.
5. Compare with the previous report: new hotspots, resolved ones, distribution shift.

## Checklist

- [ ] Distribution and buckets per language.
- [ ] Every function over threshold read and classified.
- [ ] Top files by size read and classified.
- [ ] Entry points and Actions over threshold checked against the flow — high complexity there is
      usually a layering finding too; link it to the architecture audit.
- [ ] Trend against the previous run.

## Severity

| Severity | In this audit |
| --- | --- |
| Medium | Reducible hotspot over 15, or on a money or state path |
| Low | Reducible hotspot over 10; size hotspot doing more than one thing |

## Stack notes

| Stack | Notes |
| --- | --- |
| Laravel | `lizard -l php`, or a `nikic/php-parser` walker from the app's own `vendor/` in a scratch script |
| .NET | `lizard -l csharp`, or CA1502 with `CodeMetricsConfig.txt` (`CA1502: 10`) built in a scratch copy of the solution |
| Next.js | `lizard -l typescript` (TSX included), or ESLint's `complexity` rule at 10 run from outside the tree |
| React | `lizard -l typescript` (TSX included), or ESLint's `complexity` rule at 10 run from outside the tree; a component's hook count as a size signal |
| Vue | Extract each `<script setup>` block to a scratch `.ts` file, then measure as TypeScript |

## Output

- Summary metrics and bucket tables per language first, with a one-line verdict each.
- Hotspots table: score, cognitive score where measured, lines, function, location, classification.

## Done when

- Every file in scope was measured, or is listed under **Not checked** with the reason (parse error,
  unsupported syntax).
- The counting rule, tool and thresholds are stated in the report.
