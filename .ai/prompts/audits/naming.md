# Naming Audit

Measure every name in the system against the glossary, the naming rules in
[`coding.md`](../../../docs/conventions/coding.md), and each stack's idiom. Names are the cheapest
documentation while they are right and the most expensive thing to change once they are in a
database column, an API field and a URL. A misleading name is a bug that has not fired yet.

**Mode:** Read-only, under [`auditing.md`](../../../docs/conventions/auditing.md).
**Output:** `docs/reports/YYYY-MM-DD-naming.md` from [`report.md`](../../templates/report.md).
**Inputs:** the kinds of name in scope (default: all below), the apps (default: all).

## Before you start

1. Pin the tree.
2. Read `docs/reference/glossary.md`, the **Naming** sections of `coding.md` and
   [`frontend.md`](../../../docs/conventions/frontend.md), and the **Naming** section of every stack
   profile in scope.
3. Read earlier naming reports; carry what is still present.

## Scope

Every kind of name, in every app:

- types, functions, methods, properties, variables, enum cases
- files and directories
- routes, route names and URL segments
- tables, columns, indexes, constraints
- configuration and environment keys
- events, jobs, queues, permissions, translation keys
- API fields, query parameters, error codes
- UI copy terms, and the terms in specs and docs

**Excluded:** whether a concern is implemented twice (consistency audit) — this audit owns only what
the things are called.

## Bar

A finding is a name that breaks the glossary (a concept with two names, or two concepts with one),
breaks a naming rule or the stack idiom, or says something the code does not do.

## Method

1. **Extract** identifiers per kind: AST or grep for declarations, `ls -R` for files, the route
   list, the schema, configuration files, translation files, the OpenAPI document.
2. **Glossary pass.** Cluster names by concept and look for synonyms (`customer`/`user`/`client`,
   `store`/`shop`/`tenant`, `remove`/`delete`/`destroy`). Every concept with more than one name,
   and every term absent from the glossary, is listed.
3. **Rule pass, mechanical.** Casing per kind per stack; suffixes and prefixes (`Action`, `Handler`,
   `Job`, `Interface`, `I`, `Async`, `Type`, `Base`, `use`); `_at` on temporal columns; `is_`/`has_`
   on booleans; plural tables and `<singular>_id` keys; `by<Attribute>` filters and no `where*`;
   kebab-case routes; JSON field casing per API.
4. **Vocabulary pass.** One verb per operation across modules (`Create`/`Store`/`Place`); plural for
   bulk, singular for single; `Get…`/`Find…` Actions checked against the read rule.
5. **Truth pass, by reading.** Names that promise something the code does not keep: a `get…`, `is…`
   or `has…` that writes; a `validate…` that saves; `isPaid` true for refunded; a `…Service` that is
   a value object; generic names hiding a responsibility (`Manager`, `Helper`, `Util`, `Data`,
   `Info`, `Part1`).
6. **Layout pass.** Sibling modules modelling the same surface share one directory layout.
7. **Spelling.** Typos in identifiers and file names (`repots.ts`).

## Checklist

- [ ] Every concept has one name across code, schema, API, UI copy and docs.
- [ ] Every glossary term is used; every used domain term is in the glossary.
- [ ] Casing, prefix and suffix rules hold per stack.
- [ ] One verb per operation; plurality consistent.
- [ ] No name contradicts its behaviour.
- [ ] Sibling module layouts match.

## Severity

| Severity | In this audit |
| --- | --- |
| High | A name contradicting behaviour on money, authorization or state; one concept with two names in the schema or a public API |
| Medium | Verb, plurality or suffix inconsistency across modules; mixed JSON casing in one API; terms missing from the glossary; sibling layouts diverging |
| Low | Typos, generic names, isolated casing slips |

## Stack notes

| Stack | Notes |
| --- | --- |
| Laravel | No `Interface`/`Contract` suffix; no `Job` suffix outside tiers; kebab-case route names and Blade files; `by<Attribute>` filters |
| .NET | `I` prefix on interfaces; `Async` suffix; `_camelCase` fields; `<Verb><Noun>Handler`, `…Command`, `…Response`; namespaces match folders |
| Next.js | kebab-case files; PascalCase components and types; `use-*.ts` hooks; no `I` prefix; no TypeScript `enum` |
| React | kebab-case files; PascalCase components and types; `use-*.ts` hooks; `*-page.tsx` pages; `<Thing>Schema` Zod schemas; no `I` prefix; no TypeScript `enum` |
| Vue | PascalCase SFCs; `Base`/`The` prefixes; `use*` composables; named routes `<Resource><Action>` |

## Output

- IDs `N1…`, grouped by kind of name.
- A **Glossary deltas** table: concept · names found · proposed canonical name · places to change.
  Renames proposed here land as one change across every layer, never piecemeal.

## Done when

- Every kind of name in scope was extracted and passed through every pass, or is listed under
  **Not checked**.
- Every High was re-read at the pinned commit.
