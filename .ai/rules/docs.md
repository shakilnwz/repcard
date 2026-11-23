---
paths:
  - AGENTS.md
  - README.md
  - 'apps/*/docs/**'
  - 'docs/**'
---

# Docs

## Bound conventions
`docs/conventions/documentation.md` binds every path here: where a document goes, its template,
and how it ages.

## Start from the template
Every document starts from its template in `docs/templates/`. Delete a section the document does
not need; never leave one empty.

## Know the kind before editing
Conventions, accepted ADRs, Approved specs and their `features/` scenarios are normative;
architecture, reference and workflows are descriptive and must match the code; reports are never
edited; living audits change rows, never append notes; plans move their **Status** line in the
change that completes a phase. Specs are bound by their own rule file.

## Drift is fixed in the change that causes it
A code change that makes a descriptive document untrue updates that document in the same change.

## Write for grep
Every identifier in backticks, exactly as in code. Dates as `YYYY-MM-DD`. No ticket IDs or plan
references in conventions, architecture or reference pages.
