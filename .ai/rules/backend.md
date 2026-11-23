---
paths:
  - '**/*.cs'
  - '**/*.php'
  - 'src/modules/**/server/**'
  - 'src/server/**'
---

# Backend

## Bound conventions
`docs/conventions/architecture.md` and `docs/conventions/coding.md` bind all server code;
`docs/conventions/security.md` binds every entry point, Action, Job and webhook. Each app's stack
profile (`AGENTS.md` → **Stacks**) says how its stack realises them. Read the sections that cover
the change before writing it.

## Traps agents fall into here
- A plain read is not an Action; a read that carries a rule is (architecture.md → *The flow*).
- An entry point never declares its own surface — host, prefix, authentication, surface policy.
  The surface declaration does.
- A list endpoint gets no Command or Action, and returns the one list envelope.
- Build the Command, the Action result and the Response each into its own variable before passing
  it on.
- A response shape is a Response type; never a hand-built map or anonymous object beyond the bare
  acknowledgement.
- A Command is pure: it is handed the current user and the time, it does not fetch them.
- A failed external call is *unknown*, never a negative domain outcome.
- A price, total, tax or ownership the client sent is re-derived on the server, never trusted.

## Regenerate client types with the contract
A change to a Command, a Response or a contract regenerates the client types in the same change.
