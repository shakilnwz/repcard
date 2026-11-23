# Coding Standards

Rules for how code is written inside a layer, in every stack. [`architecture.md`](architecture.md)
governs which layer may talk to which; this file governs everything else on the server side.
Frontend code is governed by [`frontend.md`](frontend.md). All three are normative.

Each rule is stated once, here, in stack-neutral terms. The app's stack profile —
[`stack-laravel.md`](stack-laravel.md), [`stack-dotnet.md`](stack-dotnet.md),
[`stack-nextjs.md`](stack-nextjs.md) — shows each rule in its language, names the mechanism that
enforces it, and adds the rules only that stack needs. Where a language's own idiom contradicts a
rule here (C#'s `I` prefix on interfaces, for one), the profile says so and the idiom wins for that
stack.

This list grows — new rules are appended under the matching heading. A rule a machine can check is
enforced by an arch test, an analyzer or a lint rule as well as written here (see
[`testing.md`](testing.md)).

## Types and class design

- Everything is explicitly typed wherever the language supports it: properties, parameters, return
  values, closures, callbacks. Strict modes are on — PHP `strict_types`, C# nullable reference
  types with warnings as errors, TypeScript `strict`. An escape hatch (`mixed`, `object`,
  `dynamic`, `any`) carries a comment stating why the type is unknowable.
- Classes are closed to inheritance unless designed for it (`final`, `sealed`), and immutable where
  they can be (`readonly`, records, `readonly` types). ORM models and entities are exempt where the
  framework must extend or proxy them.
- Type against an interface where one already exists — framework and package contracts. Do not
  introduce an interface for a single implementation. A contract a module publishes for other
  modules is the exception: it is the seam, so it exists even with one implementation.
- Every closed set of values is an enum (or, in TypeScript, an `as const` object and its union
  type). A value compared against a string literal in two places is an enum not yet written.

## Models

- Models and entities contain only persistence mapping: table, columns, casts or conversions,
  relations, accessors, composable filters. No business logic, predicates, assertions or
  application rules.
- A predicate on an enum belongs to the enum — a method on it, or an extension or function
  colocated with it where the language has no enum methods. `status === Paid || status === Shipped`
  repeated across call sites is `status.isSettled()`.
- A model's members are declared in a fixed order of groups — configuration first, framework hooks
  next, the surface other layers call last. The profile gives the order for its ORM.

## Queries

- A reusable filter composes: it adds a constraint, an eager load or an order and returns the
  unexecuted query. A method that executes — returns a scalar, an array, a model, or runs a query
  while the query is still being composed — is a Query.
- A Query earns its place by being complex, reused, or assembling several reads into one payload. A
  Query that wraps two or three filters and returns the query is a filter chain with a name; inline
  it. A Query that picks a strategy, falls back between sources, or decorates rows is deciding
  something, and is an Action.
- A query is its own step: it is assigned to a variable before the call that consumes it, whether
  that call renders, projects or serialises. The chain is the work the method does; buried in an
  argument list, a stack trace points at the wrapper rather than the query that failed.

## Entry points and responses

- An entry point returns only the framework's response types — never a raw ORM object, never an
  untyped structure.
- Never hardcode an HTTP status code. Use the framework's named constants (the profile names them).
- **Never construct a value inside the call that consumes it.** A Command built for an Action, or a
  Response built for the transport, is assigned to a variable first and the variable is passed. The
  argument list then names what is being handed over instead of hiding a second construction
  inside it, and each step is separately readable in a stack trace and a debugger. A construction
  that is itself the returned value stays where it is.
- The call producing the value a construction wraps is its own step too: an Action's result or a
  resolver feeding a Response is assigned first, so the work and the wrapping read as two things.
  A plain accessor is part of the argument, not a step of its own.
- An Action receives variables, never expressions computed in the argument list. A call, a cast
  wrapping a call and a ternary are computation and get a name; a bare cast, a property read, a
  literal and an array or object literal are already values.
- A construction that only runs on one branch stays where it is. Hoisting it makes it
  unconditional, and the guard it sat behind stops guarding.
- Never hand-roll a response payload as an anonymous array or object. A Response is the only home
  for a response shape: it has a name, a type and a client-side counterpart, and a second caller can
  reuse it. A bare acknowledgement message is the one literal an entry point builds; nothing rides
  along on it under an ad-hoc key, and a Response is never flattened to be merged into one.

## Commands and responses

- A Command's properties are immutable unless mutability is explicitly required.
- A Command is pure: the value it produces is a function of what it was handed — a request, a
  snapshot — and nothing else. It maps, trims, casts and names; it does not decide. A Command is not
  pure when it:
  1. reaches outside its inputs — authentication, the database, the container, configuration, the
     clock, the random generator, the router;
  2. enforces a rule — throws on a business condition, or carries its own validation rules;
     validation runs before the Command exists;
  3. carries behaviour — computes a price, shapes an outbound payload, builds persistence
     attributes; that is an Action's work.

  Private helpers that normalise the Command's own inputs belong in it. A Command that needs the
  current user or the time is handed them by its caller.
- Input types and Response types are different types, even when they share fields. A Command never
  doubles as a Response.
- List rows are the exception to the Response rule: they are projected inside the list query (see
  [`architecture.md`](architecture.md)). Every other response the same module returns, including the
  single-record read beside the list, goes through a Response.
- Client-side types are generated from the server's Commands and Responses (or from the API
  contract), and regenerated in the same change that alters them. A hand-written client type for a
  server shape is drift waiting to happen.

## Errors

- Distinguish *unknown* from *no*. A failed call to an external system — a timeout, a 5xx, an
  unparseable body — never maps to a negative domain outcome such as "payment declined" or "domain
  unavailable". It raises, retries, or records the state as unknown, and a person can tell which.
- Never swallow an exception to keep a flow moving. Catch only what the code can handle, and log
  with the identifiers needed to find the record again.
- Errors leave the system in one shape per app (the profile names it), with no stack trace, query
  or secret in production.
- A missing record a caller is entitled to see is a 404; a record they are not entitled to see is
  also a 404 unless the surface's ADR says otherwise, so existence is not leaked.

## Configuration

- Configuration is read through the framework's typed configuration system, never by reading
  environment variables scattered through the code. Raw environment access lives in one place.
- A setting the application cannot run correctly without is validated when the application starts,
  and its absence stops the start. A cache store that silently falls back to one without atomic
  locks turns every rate limiter, lock and idempotency guard into a no-op — refuse to start instead.
- An example environment file lists every key the configuration reads, with a safe local value or
  an empty one. It never holds a real secret.

## Database

- Never use database `ENUM` types. Use a string column and enforce the allowed values through the
  language's enum, mapped by the ORM — an enum column cannot be altered without a table rewrite, and
  the allowed set then lives in two places.
- **Never edit a migration that has run anywhere but your machine.** The change lands as a new
  migration. An edited migration leaves every existing database out of step with the code, and
  nothing reports it.
- One migration creates one table. A migration changes schema only: no conditional logic on the
  data, no backfill, no model calls. Moving data is a command or a job, run and verified on its own.
- Every foreign key states its delete behaviour deliberately. A cascade never removes financial or
  audit history — orders, invoices, transactions, ledger rows survive the deletion of whatever they
  reference.
- A column a hot path filters, joins or sorts on has an index the predicate can use. Lookups on a
  money path — a webhook resolving its payment, a usage count taken under a lock — are indexed
  before they ship, not after the table grows.
- Money is stored as an integer in minor units with its currency beside it, or as a fixed-point
  decimal; never as a float.
- Every temporal column ends in `_at` — `paid_at`, `starts_at`, `expires_at` — whatever its type,
  dates included. Booleans are `is_<adjective>` or `has_<noun>`. A nullable timestamp is preferred
  to a boolean when the moment matters. Tables are plural, foreign keys `<singular>_id`.
- Seeders and fixtures never create a credential that works outside local development. A seeded
  admin with a known password is a published backdoor once a seeder runs in production.

## Formatting

- The formatter decides. Each stack's formatter and its configuration are committed (the profile
  names them) and CI fails on unformatted code; style the formatter enforces is not argued in review.
- A parameter list stays on one line. It breaks only when the one-line form would exceed 120
  characters, counting the indent, modifiers, return type and an empty body. Once it breaks, every
  parameter takes its own line with a trailing comma where the language allows one.
- Statements of different kinds are separated by one blank line. Mapping input to a Command,
  invoking an Action and building the response are three activities, so three groups — the
  whitespace carries the shape of the method, which is otherwise what a comment would have to say.
  The test is whether the next line starts a new stage — gather, validate, compute, persist,
  notify, respond. Lines within one stage stay packed.
- Always use braces for control structures, even for a one-line body.

## Size and complexity

- A function whose cyclomatic complexity passes 10 is split, or carries a comment stating why the
  branching is irreducible — a lookup on an enum is; an entry point with six guard returns is not.
- A function past 50 lines, a class past 300 lines, or an Action with more than one public operation
  is doing more than one thing. The complexity audit lists them; each needs a reason or a split.

## Naming

- One concept, one name, everywhere. The project's terms live in `docs/reference/glossary.md`; when
  the glossary says `store`, the code, the database, the routes, the API fields, the UI copy and the
  docs never say `shop` for the same thing. A rename lands across all of them at once.
- Names are descriptive: `isRegisteredForDiscounts`, not `discount()`. No generic names that hide a
  responsibility — `Manager`, `Helper`, `Util`, `Processor`, `Data` as a whole name, `Part1`.
- An Action is named verb, then the noun it acts on: `PublishProduct`, with the stack's suffix. One
  operation has one verb across the project: if creating a file is `Create…`, it is never also
  `Store…`; if placing an order is `Place…`, there is no `Create…` beside it. A bulk Action is
  plural (`DeleteCoupons`), a single-record one singular, without exception.
- A `Get…` or `Find…` Action is checked against the read rule in
  [`architecture.md`](architecture.md): a plain read is not an Action and moves to the entry point
  or a Query. One that does carry a rule — it writes on a miss, it validates and prices — stays an
  Action, and is better named for what it does than for what it returns.
- A name says what the thing does. A `get`, `is` or `has` that writes, or a `validate` that saves,
  is a defect, not a style issue.
- Reusable query filters taking a value are `by<Attribute>`; argument-less states are a bare
  adjective (`due`, `provisioned`); ranges are the attribute plus a preposition (`createdBetween`).
- Enums are named for what their cases are, with a `Type` suffix only when the bare name already
  names something else — usually the model whose kinds the enum lists.
- Jobs are named for what they do; the namespace or folder already says what they are.
- Sibling modules modelling the same surface share one layout, and the same actor has the same name
  across modules — not `Customer` here and `User` there.
- Casing, prefixes and suffixes follow the language's idiom as the profile states it. JSON field
  casing is one convention per API, never mixed.

## Comments

- No comment when the code already says it. A comment that narrates the line below it is noise
  that rots; absence of a comment is the default.
- A comment that survives states the *why* — the constraint, the tradeoff, the non-obvious
  consequence — and states it completely.
- Comments must stand alone in their file. No ticket IDs, task lists, phase numbers, requirement
  IDs, or references to a plan or spec document; those mean nothing to the next reader, and
  traceability lives in tests and tasks (see [`specs.md`](specs.md)).
- A comment must be true of the code it sits on. Moving a comment, or changing the code under it,
  means re-earning it — a rationale describing the old contract or control flow is worse than no
  comment at all.
- Prefer a doc block — with typed shapes where a structure crosses a boundary — over an inline
  comment.
- The same rules apply to comments already in a file being touched, and to prose docs describing
  the code a change touches.

---

Related: [`architecture.md`](architecture.md) · [`frontend.md`](frontend.md) · [`security.md`](security.md)
