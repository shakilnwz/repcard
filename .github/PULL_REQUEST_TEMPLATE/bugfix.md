# fix: {short description of the bug}

**App(s):** {app name(s) / packages}
**Module(s):** {module name(s)}
**Type:** {BE / FE / fullstack}
**Related issue / card:** {URL, or "n/a"}
**Requirement broken:** {`NNNN.Rn`, or "none — a gap: the spec amendment adding it is {link}, approved by {owner}"}
**Audit row:** {e.g. `docs/audit/bugs.md` H7, or "not recorded"}

## The bug

{What was broken? Include exact user-facing symptoms and, if known, the conditions that trigger it.}

**Steps to reproduce (before this PR):**
1. {step}
2. {step}
3. **Observed:** {wrong behavior}
4. **Expected:** {correct behavior}

## Root cause

{1–3 sentences. What was actually wrong in the code — not just the symptom. If the symptom and root cause are the same, say so.}

## The fix

{What this PR changes to address the root cause. Keep it minimal — no surrounding cleanup or unrelated refactors.}

## How to verify

1. {Reproduce the original scenario}
2. **Expected:** the bug no longer occurs
3. {Regression check — what nearby behavior to confirm still works}

## Regression test

**Test added / extended:** {path to test file, or "n/a — explain why"}

The test must fail without the fix and pass with it, and carry the broken requirement's ID in the
stack's tag mechanism.

## Screenshots / recordings

{Before / after for UI bugs. Skip for backend-only.}

## Checklist

- [ ] Root cause identified, not just the symptom patched
- [ ] Fix is scoped to the bug — no opportunistic refactors
- [ ] Regression test fails on the old code, passes on this branch, and is tagged with the requirement
- [ ] The fix restores the requirement — it adds no behaviour the spec does not require
- [ ] The audit row, if any, was replayed against this branch and updated here
- [ ] Conventions still respected ([`architecture.md`](../../docs/conventions/architecture.md), [`coding.md`](../../docs/conventions/coding.md), [`security.md`](../../docs/conventions/security.md))
- [ ] Lint, formatting, build and tests pass for the affected app — CI fails on any
- [ ] No console errors
- [ ] Self-reviewed before requesting review

## Notes for reviewer

{Optional. If the same root cause likely affects other code paths, flag them here — and record them as audit rows.}
