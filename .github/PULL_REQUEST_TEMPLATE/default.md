# {PR title — short, imperative}

**App(s):** {app name(s) / packages / infra / docs}
**Module(s):** {module name(s), or "n/a"}
**Type:** {BE / FE / fullstack / infra / chore / docs}
**Related issue / card:** {URL, or "n/a"}
**Spec / plan:** {`docs/specs/NNNN-<capability>/` and tasks, `docs/plans/<topic>.md`, or "none — no behaviour change"}
**Closes audit rows:** {e.g. `docs/audit/bugs.md` M7, or "none"}

## What this changes

{2–4 sentences. Plain language. What the code does now that it didn't before.}

## Why

{1–2 sentences. The user-visible or developer-visible reason this change is needed.}

## How to test

1. {Setup step — e.g. fresh tenant, seed data, env var}
2. {Action step}
3. **Expected:** {what should happen}

## Screenshots / recordings

{Drop them here for any UI change. Skip if backend-only.}

## Checklist

- [ ] Follows [`architecture.md`](../../docs/conventions/architecture.md) and [`coding.md`](../../docs/conventions/coding.md) — or [`frontend.md`](../../docs/conventions/frontend.md) for frontend code
- [ ] Follows the stack profile of every app touched
- [ ] Meets [`security.md`](../../docs/conventions/security.md) for every entry point, Action and template touched
- [ ] Any behaviour change is required by an Approved spec ([`specs.md`](../../docs/conventions/specs.md)) and carries tests tagged with its requirement IDs per [`testing.md`](../../docs/conventions/testing.md); otherwise no test's expectations changed
- [ ] Every descriptive doc this makes untrue is updated here; plan status lines moved if a phase completed
- [ ] Every audit row this closes was replayed against this branch and updated here
- [ ] Lint, formatting, build and tests pass for the affected app — CI fails on any
- [ ] No console errors
- [ ] Self-reviewed before requesting review

## Notes for reviewer

{Optional. Schema changes, route additions, deferred follow-ups, anything non-obvious.}
