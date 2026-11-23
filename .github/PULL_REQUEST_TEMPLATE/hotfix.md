# hotfix: {short description}

> Use this template only for urgent production fixes that bypass the normal release cadence.

**Severity:** {SEV1 / SEV2 / SEV3}
**App(s) affected:** {app name(s)}
**Tenant(s) affected:** {specific tenants, or "all", or "n/a"}
**Incident / alert ref:** {URL or ID, if any}
**Requirement broken:** {`NNNN.Rn`, or "unspecified — spec amendment to follow: {issue URL}"}
**Discovered at:** {YYYY-MM-DD HH:MM TZ}

## What is broken in production

{User-visible impact. Who is blocked, what they see, since when.}

## Root cause

{1–3 sentences. The actual underlying cause. If still uncertain at time of writing, say so explicitly and mark this as a mitigation rather than a fix.}

## The fix (or mitigation)

{Minimum change required to restore service. No refactors, no opportunistic cleanup — those go in a follow-up PR.}

- [ ] This is a **fix** (root cause addressed)
- [ ] This is a **mitigation** (symptom suppressed; follow-up issue linked below)

## How to verify in production

1. {Step a responder can run post-deploy to confirm restoration}
2. **Expected:** {signal of recovery — metric, log line, user flow}

## Rollback plan

{What to do if this PR makes things worse. Usually: revert this commit and redeploy. Note anything irreversible — e.g. data migrations — explicitly.}

## Risk assessment

- [ ] Change is scoped to the affected code path only
- [ ] No schema changes, OR schema change is additive and reversible
- [ ] No destructive data operations
- [ ] Reviewed by a second engineer before merge (required for hotfix)

## Tests

{Hotfixes still need a regression test before merge OR a follow-up issue committing to one. Pick one:}

- [ ] Regression test added in this PR
- [ ] Follow-up issue created to add regression test: {issue URL}

## Follow-ups

- [ ] Incident recorded as the first finding of a scoped bugs audit (see [`auditing.md`](../../docs/conventions/auditing.md) → *Cadence*)
- {Link to any cleanup, root-cause-fix, or postmortem issue that comes out of this}

## Notes for reviewer

{What you want a second pair of eyes on most.}
