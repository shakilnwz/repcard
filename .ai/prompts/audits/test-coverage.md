# Test Coverage Audit

Find the behaviour no test proves: requirements, refusals and concurrency guards that could break
without a red build. Line coverage is a by-product; the question is whether every requirement of
every approved spec has a test that cites it and would fail if it broke, and whether the suite
itself can be trusted.

**Mode:** Read-only, under [`auditing.md`](../../../docs/conventions/auditing.md). The suites may be
run once, with coverage if a driver is present, and their output is evidence; nothing is written into
the tree. If a suite cannot run, say so and work from reading alone.
**Output:** `docs/reports/YYYY-MM-DD-test-coverage.md` from
[`report.md`](../../../docs/templates/report.md).
**Inputs:** apps in scope (default: all), whether to run the suites (default: yes, once).

## Before you start

1. Pin the tree.
2. Read [`testing.md`](../../../docs/conventions/testing.md) and
   [`specs.md`](../../../docs/conventions/specs.md) → *Traceability*, and each stack profile's
   testing section — it names the tag mechanism.
3. List every requirement ID of every spec at Approved or later; every entry point; every arch test;
   every closed row in the bugs living audit.

## Scope

- **Default:** every test directory in every app; `docs/specs/**`; `features/**`; every entry point;
  every Action on money or state.
- **Excluded:** test style beyond what `testing.md` requires. Whether the *code* conforms to the
  requirement is the spec-conformance audit's question; this audit asks whether a test would notice.

## Bar

A finding is behaviour that matters with no test that would fail if it broke: a requirement with no
tagged test, an entry point with no test, an authorization refusal never asserted, a concurrency
guard never replayed, a fixed bug without a regression test, a mechanically checkable convention
with no arch test — or a test that cannot fail (asserts nothing, asserts on a mock it configured,
fakes the thing under test).

## Method

1. **Requirements to tests.** For each requirement ID, find the tests tagged with it. Read them: do
   they exercise the requirement's trigger and assert its response, refusals included? Untagged
   requirements, and tagged tests that do not actually prove their tag, are findings.
2. **Entry points to tests.** For each entry point, find a test that reaches it. For each authorized
   one, find a test asserting the refusal (403/404) for a caller who should not pass.
3. **Guards.** For each lock, idempotency key and throttle on a money or state path, find a test
   replaying the second request.
4. **Fixes.** For each closed row in the bugs living audit, find its regression test and its tag.
5. **Conventions.** For each rule `testing.md` lists as mechanically checkable, find the arch test.
6. **Quality.** Sample tests for assertions that cannot fail, network calls not faked, live clock
   comparisons, order dependence, in-memory database substitutes, and the test database guard.
7. **If run:** record pass, fail and skip counts per suite, duration, coverage by module, every failing
   or skipped test with its reason, and every `@pending` scenario of an Implemented spec.

## Checklist

- [ ] Every requirement paired with a tagged test that proves it.
- [ ] Every entry point has a test; every authorized one has a refusal test.
- [ ] Every concurrency guard has a replay test.
- [ ] Every closed bug has a regression test.
- [ ] Every mechanically checkable convention has an arch test.
- [ ] No network in tests; time frozen where compared; real database engine; test database guarded.
- [ ] The suites pass; skipped and pending tests each have a reason.

## Severity

| Severity | In this audit |
| --- | --- |
| High | A money, authorization or state requirement with no test; a failing suite; a test database that can point at development data |
| Medium | A requirement, entry point or capability with no test; a closed bug with no regression test; a convention with no arch test; a test that cannot fail |
| Low | Missing tags on tests that do prove a requirement; test-quality issues in non-critical areas |

## Stack notes

| Stack | Notes |
| --- | --- |
| Laravel | Tags: `->group('NNNN.Rn')`; run one with `php artisan test --group=NNNN.Rn`; arch tests under `tests/Arch` |
| .NET | Tags: `[Trait("Requirement", "NNNN.Rn")]`; feature tests through `WebApplicationFactory`; flag `UseInMemoryDatabase` in tests |
| Next.js | Tags: `[NNNN.Rn]` title prefix in Vitest, `@NNNN.Rn` Playwright tags; check every exported server action has a direct test |
| React | Tags: `[NNNN.Rn]` title prefix in Vitest, `@NNNN.Rn` Playwright tags; component tests with Testing Library querying by role; MSW at the HTTP boundary |
| Vue | Component tests with Vue Test Utils titled with requirement IDs; journeys in Playwright |
| Gherkin | Every scenario in `features/` carries its `@NNNN.Rn` tag; `@pending` on an Implemented spec is a finding |

## Output

- A **Traceability matrix** per spec: requirement · tests · proves it (yes/partly/no).
- An **Entry points without tests** list, grouped by surface.

## Done when

- Every requirement, entry point and closed bug was paired or listed.
- The report states whether each suite ran and, if so, its result.
