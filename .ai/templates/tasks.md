# NNNN: <Capability> — tasks

The ordered steps that build [`spec.md`](spec.md) per [`design.md`](design.md). Each task is small
enough to review in one sitting, independently verifiable, and cites the requirements it serves. A
requirement's acceptance test comes before the code that satisfies it.

**Progress:** <0 of N done>

## Tasks

- [ ] **T1 — <imperative title>** · R1
  - **Does:** <the change, in one or two lines>
  - **Done when:** <an observable condition — a named test passes, a migration applies, a check is green>
- [ ] **T2 — Acceptance tests for R1 and R2, failing** · R1, R2
  - **Does:** <tests from the spec's scenarios, tagged with their requirement IDs>
  - **Done when:** <the tests run and fail for the right reason>
- [ ] **T3 — <imperative title>** · R1, R2
  - **Does:** <…>
  - **Done when:** <T2's tests pass>
- [ ] **Tn — Verify** · all
  - **Does:** spec-conformance audit scoped to this spec; descriptive docs updated; client types
    regenerated
  - **Done when:** no open divergence or overreach; the spec's status reads Implemented

## Notes

Anything discovered while working that changes the plan — a task split, an order changed. A
discovery that changes *behaviour* is a spec change, not a note.
