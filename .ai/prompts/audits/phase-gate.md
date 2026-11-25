# Phase Gate Audit

Decide whether the current phase's gate in
[`lifecycle.md`](../../../docs/conventions/lifecycle.md) can close: verify every criterion of that
gate, and every criterion of earlier gates for regression, against the code and documents at HEAD.
This is the audit run before advancing a phase and before every release.

**Mode:** Read-only, under [`auditing.md`](../../../docs/conventions/auditing.md), except for the two
documents this audit owns: it files a report and updates the rows of
[`docs/audit/readiness.md`](../../../docs/audit/readiness.md). It never edits `AGENTS.md`'s
**Phase** line, and never marks a criterion waived — both are the owner's call, made after reading
the report.
**Output:** `docs/reports/YYYY-MM-DD-gate-G<N>.md` from
[`report.md`](../../templates/report.md), and updated rows in `docs/audit/readiness.md`.
**Inputs:** the gate to check (default: the gate closing the phase `AGENTS.md` names), or `all` —
at adoption, every gate, to find the highest one whose criteria all hold.

## Before you start

1. Pin the tree. For G4, the pinned commit must be the release candidate.
2. Read `lifecycle.md` for the gate's criteria, and `readiness.md` for their current rows.
3. List every living audit in `docs/audit/` and every report in `docs/reports/` with its date and
   commit.
4. List every spec in `docs/specs/` with its status, and the capabilities in scope on the context
   page; the spec-based criteria are checked from these and the spec-conformance audit's matrices.

## Scope

- **Default:** every criterion of the target gate; every criterion of earlier gates.
- **Excluded:** criteria of later gates.

## Bar

A criterion is **met** when its condition can be shown at HEAD and the evidence is named: a path,
a passing check, a report. "Probably true" is not met. A required audit is **fresh** when its latest
run is no older than the last commit touching its scope (`git log -1 --format=%h -- <scope>`
compared with the report's commit).

## Method

1. For each criterion of the target gate, gather the evidence and decide met or not met; for not
   met, state the smallest remaining step.
2. For each criterion of earlier gates marked met, re-check it cheaply; a regression reopens the row.
3. For each audit the gate requires: confirm it ran, is fresh, and its open findings meet the
   gate's severity bar. A stale audit makes its criterion not met until re-run.
4. For each spec-based criterion: every capability in scope has a spec at the required status; every
   requirement of an Implemented spec has a passing tagged test (run the suites filtered by tag if
   the caller allows, otherwise cite the latest test-coverage report); no `@pending` scenario
   remains on an Implemented spec.
5. Count open findings by severity across every living audit.
6. Update every row of `readiness.md` you checked: status, evidence, date.

## Checklist

- [ ] Every criterion of the target gate has a verdict and evidence.
- [ ] Every earlier criterion re-checked for regression.
- [ ] Every required audit present, fresh, and within the severity bar.
- [ ] Open findings counted across all living audits.
- [ ] `readiness.md` rows and status counts updated.

## Output

- Opening paragraph: **Gate G<N> can close** or **Gate G<N> cannot close: <k> criteria not met**,
  then the list.
- Summary table: criterion, verdict, evidence.
- **Regressions** section for earlier criteria reopened.
- **Audit freshness** table: audit, last run, commit, fresh or stale, open Critical/High.
- **Specs** table: spec, status, requirements, traced, overreach findings open.
- **Owner decisions** section: criteria the owner could waive, with what waiving would accept.

## Done when

- Every criterion of the target and earlier gates has a verdict.
- `readiness.md` matches the report.
- The report says plainly whether the gate can close.
