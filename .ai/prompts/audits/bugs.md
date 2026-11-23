# Bug Audit

Find reachable defects: inputs or sequences a real caller can produce that yield a wrong result,
a 500, lost or invented money or data, an authentication or authorization bypass, or dead wiring
that makes a shipped feature silently not work. The audit hunts for consequences, not style.

**Mode:** Read-only, under [`auditing.md`](../../../docs/conventions/auditing.md). Nothing is
exercised end to end unless the caller allows it; neither lint nor the suite is run unless named.
**Output:** `docs/audit/bugs.md` (or `docs/audit/bugs-<app>.md` in a monorepo) from
[`audit.md`](../../../docs/templates/audit.md). On a first run, create it; on a re-run, update rows
in place and add new findings with new IDs.
**Inputs:** the modules or subsystem in scope (default: everything), and an incident to start from
(default: none).

## Before you start

1. Pin the tree.
2. Read [`security.md`](../../../docs/conventions/security.md) — most Critical bugs are a broken rule
   there — and the **Errors** section of [`coding.md`](../../../docs/conventions/coding.md).
3. Read the existing living audit and every report touching the subsystem. Re-verify each open row:
   still present → keep; gone → close it, naming the commit that closed it.

## Scope

- **Default:** every module's `app/`, `routes/`, `config/`, `database/`; app-level `bootstrap/`,
  `config/`, `routes/`; every SPA and server-rendered template.
- **Excluded:** convention and layering drift (architecture-conformance audit), naming, missing
  tests (test-coverage audit), and risks with no reachable trigger — those are listed as risks, if
  at all.

## Bar

A bug is **fixed** when its trigger, replayed against HEAD, no longer produces the wrong outcome.
Every finding states its trigger concretely enough to replay.

## Method

1. Map the flows that matter first: money in and out, account and session lifecycle, every state
   machine, every webhook and callback, every scheduled command.
2. Split into non-overlapping passes — by module group, plus one per SPA — and run each completely.
3. Per flow, walk the entry point to the persisted state, asking the checklist at each step.
4. Hand re-read every Critical and High finding against the code, by a pass that is given the
   location and the claimed trigger, not the conclusion.

## Checklist

- [ ] **Authorization:** can a caller reach a record they do not own by changing an id? Is every
      permission the UI offers enforced by a route? Does any surface lack its guard?
- [ ] **Concurrency:** what happens when the same request arrives twice at once — double spend,
      double send, deadlock between paths locking rows in different orders?
- [ ] **Idempotency:** does a retried job, webhook or callback repeat its side effects?
- [ ] **State machines:** can a transition happen from a state it should not? Does an unrelated event
      undo an operator's decision (payment lifting a suspension)?
- [ ] **Unknown vs no:** does a timeout or provider error get recorded as a negative outcome?
- [ ] **Money:** rounding, currency, tax included or excluded consistently between quote, invoice and
      charge; amounts displayed matching amounts charged.
- [ ] **Dead wiring:** a listener never registered, a setting saved but never read, a notification
      linking to a route that does not exist, a button whose handler never fires, an event nobody
      dispatches.
- [ ] **Data loss:** a save that nulls fields the form did not send; a cascade deleting history.
- [ ] **Configuration:** what happens with each optional env var unset — does a guard silently
      become a no-op?
- [ ] **Queues:** retries, backoff and timeouts that match the work; failures that land somewhere.
- [ ] **Caching:** stale reads after a state change that should take effect immediately; keys that
      collide across tenants or users.
- [ ] **Malformed input:** 500s on input the validation lets through.
- [ ] **Frontend:** popups opened after an `await`; stale state after navigation; error states that
      never render.

## Severity

| Severity | In this audit |
| --- | --- |
| Critical | Money, accounts or an admin surface exposed to an outside user; money minted or lost |
| High | Wrong money or state; a main flow broken |
| Medium | A secondary flow broken, or a guarantee silently void |
| Low | An edge case, wrong cosmetic data, or a 500 on malformed input |

## Stack notes

| Stack | Notes |
| --- | --- |
| Laravel | Jobs dispatched inside transactions without `after_commit`; `firstOrCreate` races without a unique index; tenant state cached in statics across queue jobs; `retry_after` shorter than a job's runtime |
| .NET | `async void`; `.Result`/`.Wait()` deadlocks; scoped services captured by singletons; `DbContext` shared across threads; unobserved task exceptions in background services; `DateTime.Now` against `DateTimeOffset` columns |
| Next.js | Stale reads after a mutation that did not revalidate its tags; per-user data in a shared cache; hydration mismatches; server actions trusting closed-over ids; `after()` work assumed durable |
| React | Effects with missing or lying dependencies; stale closures in handlers and intervals; index keys on lists that reorder; server data copied into local state and drifting from the cache; popups opened after `await` |
| Vue | Stale store state after navigation; watchers firing on their own writes; popups opened after `await` |

## Output

- IDs are severity-prefixed (`C1`, `H4`, `M12`, `L3`), never reused; the status table lists open
  rows first, by severity.
- Each open finding's section includes **Trigger**, written as replay steps.

## Done when

- Every flow mapped in step 1 was walked, or is listed under **Not checked**.
- Every open row was re-verified at the pinned commit; every closed row names its closing commit.
- Every Critical and High was re-read by an independent pass.
