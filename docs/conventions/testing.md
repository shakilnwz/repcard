# Testing Conventions

What gets a test, which kind, how a test traces to the spec it proves, and how conventions are
enforced mechanically. Normative: a change that breaks a rule here is wrong even if it works.
[`specs.md`](specs.md) governs what behaviour is required; this file governs the proof that the
code delivers it. Each stack profile names the runner, the harness and the arch-test tool.

## Scope

Applies to:

- every test directory and test file, in every app
- every change that alters behaviour

## What gets a test

- **Every requirement of an approved spec has at least one test that would fail if the requirement
  broke**, and the test cites the requirement (see *Traceability*). A requirement is not implemented
  until that test passes.
- In spec-driven work the acceptance test is written from the spec's scenario before the code that
  makes it pass, and is seen failing first.
- A bug fix carries a regression test that fails without the fix and passes with it, citing the
  requirement the bug violated — or the requirement the fix adds to the spec, when no spec covered
  the behaviour.
- Writing the test is part of the change. Running the suite is on request (see `AGENTS.md`); a
  hand-off that did not run the test says so.
- Cover the happy path and the failures that matter — authorization refused, validation refused,
  the concurrent or repeated call — not every permutation.
- A test proves behaviour through the boundary a caller uses: a feature test through the entry
  point, an Action test through the Action. It does not assert on private members or on how a result
  was computed.

## Traceability

- A test names the requirement it proves as `<spec>.R<n>` — `0012.R3` — through the runner's tagging
  mechanism, which the profile names (a group, a trait, a tag, a title prefix). One test may prove
  several requirements; it cites each.
- The test-coverage audit pairs every requirement with its tests by that tag. A test with no tag is
  not wrong, but it proves nothing the spec asked for; a requirement with no tagged test is a gap.
- Requirement IDs live in test tags and tasks, never in code comments (see [`coding.md`](coding.md)).

## Kinds

| Kind | Proves | Typical runner (see profile) |
| --- | --- | --- |
| Feature | An entry point end to end: status, response shape, persisted state, dispatched work | Pest · xUnit with `WebApplicationFactory` · Vitest against route handlers and actions |
| Unit | A pure unit with no framework: a value object, an enum predicate, a calculation | Pest `--unit` · xUnit · Vitest |
| Component | A UI component's rendered behaviour | Vue Test Utils · Testing Library |
| End-to-end | A user journey through the browser | Playwright |
| Arch | A convention holds across the codebase | Pest `arch()` · NetArchTest / ArchUnitNET · dependency-cruiser / ESLint boundaries |
| Integration | A boundary with real infrastructure the suite owns — database, queue, tenant | Testcontainers or the suite's own database |

Most tests are feature tests. A unit test that boots the framework is a feature test misfiled.
End-to-end tests cover journeys, not rules: a rule proved end to end and nowhere else makes the
suite slow and the failure vague.

## Conventions are enforced, not hoped for

A rule in `docs/conventions/` that a machine can check is checked — by an arch test, an analyzer, a
lint rule or a formatter rule. The check lands in the same change as the rule, or the rule records
why it cannot be checked. Candidates expected from the first module onward:

- entry points sit inside a declared surface and set nothing their surface sets
- entry points return only allowed response types, and do not reach persistence where the flow
  forbids it
- the module dependency graph matches the declared one: no cycles, no internal imports across a seam
- models contain only persistence mapping
- Commands are immutable and reach no ambient state
- no raw environment access outside configuration; no debug output left in code
- naming suffixes and prefixes per the profile

Beside the stack's checks, CI runs `.ai/bin/check`: the agents' generated rule files in sync with
`.ai/rules/`, no placeholder left after Phase 0, and every requirement of an Implemented spec cited
by a test. It is what holds the rules whichever agent, or person, wrote the change.

## Baselines

In a project adopted with existing code, a check the existing code fails is still switched on — with
a baseline that records the violations present on the day, so CI fails every new violation and none
of the old ones.

- **A baseline only shrinks.** An entry leaves when its violation is fixed, in the fixing change;
  none is added, except by regenerating the baseline with the owner's approval recorded in the
  change, which is a finding in itself.
- Every baseline is listed, with its size, in the architecture-conformance living audit, so its
  trend is visible at every gate.
- A project started under these rules has no baselines.

| Check | Baseline mechanism |
| --- | --- |
| PHPStan / Larastan | `phpstan-baseline.neon` from `--generate-baseline` |
| deptrac | `deptrac.baseline.yaml` from the baseline formatter |
| ESLint | bulk suppressions (`eslint-suppressions.json`, `--suppress-all`, `--prune-suppressions`) |
| .NET analyzers | `GlobalSuppressions.cs` entries scoped to the existing members |
| Arch tests (Pest `arch()`, NetArchTest, dependency-cruiser) | an explicit allow-list of the existing violators inside the test |

## Writing tests

- Models and entities are created through factories or builders, using their named states before
  setting attributes by hand. A model that tests need gets a factory in the same change.
- No network. External services are faked, and the fake asserts what was sent — including the host
  a credential went to.
- Time is frozen where it matters, never compared against a live clock.
- Concurrency rules get a test that replays the second request after the first commits, and asserts
  the second is refused or is a no-op.
- One behaviour per test, named for the behaviour: `it refuses a withdrawal above the balance`.
- A database-backed test runs against the engine production runs. An in-memory substitute that
  speaks a different SQL dialect proves the substitute.

## Isolation

- The test database is not the development database. The suite creates its own, and refuses to run
  when the configured name does not carry the test suffix — a misconfigured environment must not
  truncate development data.
- Tests do not depend on order or on each other's data. Parallel runs pass.
- Run the minimum that proves the change, filtered by name or tag. The whole suite is CI's job.

## Exceptions

- A behaviour that cannot be tested in-process — a third party's real callback, a browser-only
  gesture — is covered by a documented manual check in the pull request, cited to its requirement,
  and the test-coverage audit lists it.

---

Related: [`specs.md`](specs.md) · [`architecture.md`](architecture.md) · [`auditing.md`](auditing.md)
