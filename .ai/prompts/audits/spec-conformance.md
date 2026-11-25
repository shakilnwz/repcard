# Spec Conformance Audit

Check the code against its specs in both directions. **Under-delivery:** a requirement not
implemented, not tested, or implemented differently. **Overreach:** behaviour no requirement asks
for — an extra option, an unrequested endpoint, a speculative mode, a "while I was there" feature.
In spec-driven development both are defects: the first breaks the promise, the second ships
behaviour nobody specified, reviewed, or tests.

**Mode:** Read-only, under [`auditing.md`](../../../docs/conventions/auditing.md). The tests may be
run once, filtered by requirement tag, if the caller allows it.
**Output:** `docs/audit/spec-conformance.md` from [`audit.md`](../../templates/audit.md),
updated in place. A run scoped to one spec (the Verify task before Implemented) updates that spec's
rows only.
**Inputs:** the specs in scope (default: every spec at Approved or later), and whether to run the
tagged tests (default: no).

## Before you start

1. Pin the tree.
2. Read [`specs.md`](../../../docs/conventions/specs.md) and
   [`testing.md`](../../../docs/conventions/testing.md) → *Traceability*, and the stack profile of
   every app in scope.
3. For each spec in scope: read `spec.md`, `design.md`, `tasks.md`, `contracts/`, and its
   `features/` file if one exists. Note its status.
4. Read the existing living audit; re-verify each open row.

## Scope

- **Default:** every spec at Approved, In progress or Implemented; the code and tests of the modules
  they name; every entry point of every app (for the overreach sweep).
- **Excluded:** the quality of code that does conform (other audits own it); Draft specs, except to
  note behaviour already built against them.

## Bar

| Verdict | Means |
| --- | --- |
| **Conforms** | The requirement is implemented as written and a passing test tagged with its ID would fail if it broke |
| **Untested** | Implemented as written, but no tagged test proves it |
| **Divergent** | Implemented differently from the requirement or its scenario |
| **Missing** | Not implemented |
| **Overreach** | Behaviour in the code that no requirement of any spec asks for |
| **Spec defect** | The spec itself is untestable, ambiguous, contradicts another spec or a convention, or carries a marker past Draft |

Excluded from every verdict: implementation choices the spec rightly leaves to the design.

## Method

1. **Forward — requirement to code.** For each requirement: find its tagged tests
   (`grep -rn '<NNNN>\.R<n>'` across test directories and `features/`); trace the entry point the
   scenario exercises through the Action to the persisted state; compare the behaviour to the
   requirement and each scenario, refusals included. Record a verdict.
2. **Reverse — code to requirement.** Enumerate every observable behaviour: every entry point
   (routes, server actions, endpoints, commands, consumers), every scheduled job, every setting and
   feature flag a user or operator can change, every option a form offers, every notification sent.
   Map each to a requirement. An unmapped one is **Overreach**, unless it is a row of
   `docs/audit/legacy-capabilities.md` — behaviour that predates the rules (`specs.md` → *Legacy
   behaviour*). **Register mode**, run once at adoption: every unmapped behaviour becomes a row of
   that register — capability, entry points, tests covering it today, status `Unspecified` — instead
   of a finding.
3. **Contracts.** Diff `contracts/` against the implemented API — paths, methods, fields, types,
   status codes, error shapes — and against the generated client types.
4. **Non-functional requirements.** For each, find its measurement (test, tool, check) and whether
   it was run and met.
5. **Status.** Compare each spec's status with reality: Implemented with a failing or missing test,
   In progress with every task ticked, tasks ticked with no matching change.
6. **Spec quality.** Untestable phrasing, missing refusal scenarios, unquantified non-functional
   requirements, terms not in the glossary, two specs requiring contradictory behaviour.
7. Re-read every High finding against the code before writing it.

## Checklist

- [ ] Every requirement in scope has a verdict.
- [ ] Every entry point, job, setting, flag and form option maps to a requirement, or is overreach.
- [ ] Every contract matches the implementation and the client types.
- [ ] Every non-functional requirement has a measurement and a result.
- [ ] Every spec's status, tasks and tests agree.
- [ ] Every spec defect is listed for the owner.

## Severity

| Severity | In this audit |
| --- | --- |
| Critical | A Missing or Divergent requirement on authorization, money or data integrity, shipped |
| High | Missing or Divergent on a main flow; Overreach that adds an entry point, permission or data exposure no one specified; a spec marked Implemented that is not |
| Medium | Untested requirement; Overreach adding options, configuration or modes; contract drift; a non-functional requirement unmeasured |
| Low | Spec defects; missing tags on tests that do prove a requirement; status lag |

## Stack notes

| Stack | Notes |
| --- | --- |
| Laravel | Entry points from `php artisan route:list --json`, `schedule:list`, `event:list`; tags are Pest `->group()` |
| .NET | Entry points from the OpenAPI document and `Map*` calls; tags are `[Trait("Requirement", …)]` |
| Next.js | Entry points are every exported server action, every `route.ts`, every `page.tsx`; tags are `[NNNN.Rn]` title prefixes and Playwright `@NNNN.Rn` tags |
| React | Form options and visible actions in pages map to requirements like any entry point; tags are `[NNNN.Rn]` title prefixes and Playwright `@NNNN.Rn` tags |
| Vue | Form options and visible actions in views map to requirements like any entry point |

## Output

- IDs prefixed by verdict: `M` missing, `D` divergent, `U` untested, `O` overreach, `S` spec defect,
  `C` contract.
- A **Traceability matrix** per spec: requirement · verdict · tests · entry point.
- An **Unspecified behaviour** table from the reverse sweep: behaviour · location · proposed action
  (specify, or remove). In register mode, the legacy register instead.

## Done when

- Every requirement in scope has a verdict, and every entry point was mapped.
- Every High was re-read at the pinned commit.
- A scoped run states plainly whether the spec may move to Implemented.
