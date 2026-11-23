---
paths:
  - 'apps/*/docs/specs/**'
  - 'apps/*/features/**'
  - 'docs/specs/**'
  - 'features/**'
---

# Specs

## Bound conventions
`docs/conventions/specs.md` binds every path here: the artifacts, the statuses, EARS requirements,
traceability, and the Definitions of Ready and Done.

## Only the owner approves
An agent drafts, clarifies, designs and plans; it never sets a spec's status to Approved, and never
answers its own `[NEEDS CLARIFICATION: …]` marker. An Approved spec changes only through its change
log, with the owner's approval.

## Behaviour, not design
A spec names no class, table, route or column, and uses only glossary terms. Design goes in
`design.md`; a new term goes into `docs/reference/glossary.md` in the same change.

## IDs are permanent
Requirement IDs are never reused or renumbered; a withdrawn requirement is struck through, not
deleted. Scenarios live in one place — the spec, or its `features/` file — never both.

## Status follows reality
Tick a task in the change that completes it. A spec reads Implemented only after its
spec-conformance run is clean and every requirement has a passing tagged test.
