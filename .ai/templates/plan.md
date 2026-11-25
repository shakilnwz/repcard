# <Topic> — <the shape of the fix, in one line>

What changes and why, in one paragraph, linking the report the plan rests on. A plan carries
work that changes no behaviour — a refactor, a remediation, an upgrade. Work that changes
behaviour is a spec, not a plan.

**Rests on:** <report, audit finding IDs, or ADR this plan executes>

**Scope:** <modules, paths, call sites and their counts>

**Decisions taken:** <what is settled, so it is not reopened>

**Status:** <Unbuilt. Nothing below has been implemented.> <!-- Unbuilt | Phases 0–N done, N+1 next | Done -->

---

## The change

The target state, stated once: what exists afterwards, and what no longer does.

## Phase 0 — <name>

1. <step>
2. <step>

**Done when:** <an observable condition>

## Phase 1 — <name>

1. <step>

**Done when:** <an observable condition>

## Risk and rollback

What can go wrong in production while this lands, and how each phase is undone. Name any
step that cannot be undone — a data migration, a deleted column — explicitly.

## Out of scope

- <what this plan leaves alone, and where it is tracked instead>

## Open questions

- <a decision still owed, and who owes it>
