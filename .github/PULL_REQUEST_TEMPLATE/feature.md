# {Feature title — short, imperative}

**App(s):** {app name(s) / packages}
**Module(s):** {module name(s)}
**Type:** {BE / FE / fullstack}
**Spec:** {`docs/specs/NNNN-<capability>/spec.md`, status Approved or In progress}
**Tasks:** {`T3`, `T4` of `tasks.md`}
**Requirements:** {`NNNN.R1`, `NNNN.R2` — every requirement this PR implements or tests}
**Related issue / card:** {URL, or "n/a"}

## Summary

{2–4 sentences: what an actor can do now that they couldn't before, in the spec's terms.}

## Design / approach

{Short description of the technical approach, pointing at `design.md` rather than repeating it.
Call out anything the design did not foresee:
- New entry points, and the surface each sits in
- New Commands, Actions, Queries, Responses
- New tables / columns (one migration per table)
- New cross-module contracts or events
- New shared UI components}

## How to test

1. {Setup — fresh tenant / seed / env}
2. {Walk the happy path of each requirement's scenario}
3. {Walk at least one refusal, including an authorization refusal}
4. **Expected:** {what should happen}
5. **Verify persisted state:** {table / record}

## Screenshots / recordings

{Required for any UI change. Include before / after where applicable.}

## Checklist

**Spec**
- [ ] Every behaviour in this PR is required by a requirement listed above — no extra option, endpoint, mode or setting
- [ ] Every requirement listed has a test tagged with its ID that failed before the code and passes now ([`testing.md`](../../docs/conventions/testing.md))
- [ ] Ticked tasks in `tasks.md` match this PR; the spec's status moved if this PR starts or finishes it
- [ ] New domain terms added to `docs/reference/glossary.md`; names in code, schema, API and UI copy use glossary terms

**Conventions** — as the app's stack profile realises them
- [ ] The flow in [`architecture.md`](../../docs/conventions/architecture.md) holds: entry points validate input and hand a Command to one Action; plain reads and lists stay out of Actions
- [ ] No module reaches another's internals or writes its tables; cross-module calls go through published contracts, Queries or events
- [ ] [`security.md`](../../docs/conventions/security.md): every entry point authorizes the record; money and state transitions are atomic and idempotent; client-sent prices and ownership re-derived
- [ ] Migrations follow the **Database** rules in [`coding.md`](../../docs/conventions/coding.md): new migrations only, one table each, no backfill, no `ENUM`, deliberate delete behaviour
- [ ] Every user-visible string localised; every control accessible ([`frontend.md`](../../docs/conventions/frontend.md))
- [ ] Client types regenerated if a Command, Response or contract changed
- [ ] Reference, workflow and architecture docs updated where this makes them untrue

**Build**
- [ ] Lint, formatting, type check, build and tests pass for the affected app — CI fails on any
- [ ] Self-reviewed before requesting review

## Notes for reviewer

{Anything non-obvious — patterns introduced, follow-ups planned, performance considerations.}
