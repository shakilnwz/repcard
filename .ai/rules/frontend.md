---
paths:
  - '**/*.css'
  - '**/*.jsx'
  - '**/*.tsx'
  - '**/*.vue'
  - 'modules/**/resources/**'
  - 'packages/js/**'
  - 'resources/**'
---

# Frontend

## Bound conventions
`docs/conventions/frontend.md` binds every path here; the **Untrusted input** section of
`docs/conventions/security.md` binds every template. Each app's frontend profile (`AGENTS.md` →
**Stacks**) says how its stack realises them, and any app convention in `AGENTS.md`'s path table
binds as well — check both.

## Traps agents fall into here
- A file used by one route lives beside that route; a file used by one feature lives inside it.
- A feature never deep-imports another feature's internals; promote to `shared/` instead.
- Backend shapes come from the generated types — never hand-write an interface for them.
- Every user-visible string goes through i18n; every icon-only button gets an accessible name.
- Never render raw HTML from user content that was not sanitized server-side for that purpose.
- `window.open` from a gesture handler runs before any `await`.
- Every screen that loads data has its loading, empty and error states.

## Reuse before writing
Search the shared UI directory and any workspace UI package for an existing component before
creating one.
