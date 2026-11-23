# Architecture Rules

This file is the authority for the layering and modularity rules in every app of the project,
whatever its stack. It is normative: a change that breaks a rule here is wrong even if it works.
See [`coding.md`](coding.md) for how the code inside a layer is written, and the app's stack
profile — [`stack-laravel.md`](stack-laravel.md), [`stack-dotnet.md`](stack-dotnet.md),
[`stack-nextjs.md`](stack-nextjs.md) — for the mechanism each concept below maps to. A profile
realises these rules; it never relaxes one.

## Concepts

The rules are written in one vocabulary. Each profile opens with the table mapping these
names to its framework.

| Concept | What it is |
| --- | --- |
| **Entry point** | Where a request enters: an HTTP endpoint, a server action, a console command, a message consumer |
| **Input validation** | The shape, format and allowed values of what entered, checked before anything else runs |
| **Command** | The validated input as an immutable, typed value (a DTO) |
| **Action** | One decision, mutation or coordination — the use case |
| **Query** | A named read that is complex, reused, or assembles several reads into one payload |
| **Repository** | A persistence query complex or reused enough to be named; optional, never generic |
| **Model** | The persistence mapping of one table: an ORM model or entity |
| **Response** | A named, typed projection of a record or payload into what leaves the system |
| **Job / Listener** | Work moved off the request, or a reaction to an event — both call an Action |
| **Event** | An announcement that something happened, carrying identifiers and facts |
| **Module** | A bounded slice of the domain owning its code, its data and its public surface |
| **Surface** | Who is on the other end of an entry point — public, customer, admin, partner, a provider's webhook |

## The flow

Anything that decides, mutates or coordinates flows one way:

```
Entry point → Input validation → Command → Action → Model
```

An Action reaches persistence through a Repository or a Query when the query is complex or reused;
otherwise it queries the Model directly:

```
Action → Repository → Model
Action → Query → Model
```

An Action is for something happening — a decision, a mutation, a coordination. Fetching a row is
none of those. A plain read that only names a record and hands it back is not an Action however it
is dressed up, so the entry point runs it against the Model itself:

```
Entry point → Model
```

The line is what the code decides, not how many lines it is. The moment the read carries a rule —
what the caller is allowed to see, what happens when it is missing, what else has to be true — it
has stopped being a read and belongs in an Action.

A read that assembles several queries into one response — a dashboard, a trend — decides nothing
either. It gets a Query of its own, which the entry point calls directly, handing it request
primitives rather than a Command built to feed it:

```
Entry point → Query → Model
```

## Layers

What each layer owns, and what it must never do. A responsibility that fits no row has found a
missing layer: name it in an ADR before inventing it in code.

| Layer | Owns | Never |
| --- | --- | --- |
| Entry point | Reading the request, building the Command, calling one Action or Query, returning a response | Business rules, transactions, a query that carries a rule, a second Action coordinated with the first |
| Input validation | Shape, format, length and allowed values of every field; coarse authorization of the request as a whole | Reading other records to decide an outcome; side effects |
| Command | Carrying validated input across the boundary, immutably | Behaviour beyond construction and derivation of its own fields |
| Action | One decision, mutation or coordination; its transaction; dispatching events and jobs; record-level authorization | Reading the transport (request, cookies, headers); returning a transport response; rendering |
| Repository / Query | A query that is complex or reused, returned as models, a composable query, or a typed payload | Writes that carry a decision; calling Actions |
| Model | Persistence mapping: table, columns, casts, relations, composable filters | Business logic, predicates, assertions, application rules |
| Response | Projecting one record or payload into the shape that leaves the system | Queries; loading relations the caller did not load |
| Job / Listener | Running an Action off the request, or in reaction to an event | Holding the business rule itself |
| Event | Identifiers and the facts listeners need | Behaviour; whole models crossing a module seam |

An Action that needs another Action's outcome calls it; an Action never calls an entry point, and a
Job never calls an entry point or reads a request.

## Surfaces

The surface an entry point serves decides its host or path prefix, its authentication, and its
transport middleware. Each app declares its surfaces in **one** place — the profile names where —
and that declaration is the whole of what a surface means.

- **An entry point never re-declares its surface.** No host, prefix, authentication scheme or
  surface policy on an individual route, handler or action. One that needs another surface's
  setting belongs to that surface; when none fits, the app is missing a surface — add it to the
  declaration rather than rebuilding it inside one entry point.
- **Authentication runs before sign-in only where it must.** The sign-in, sign-up and recovery
  entry points are the one group reachable while signed out on an otherwise authenticated surface,
  and they are grouped so the exception is visible.
- **Deny by default.** A new entry point on an authenticated surface is authenticated without
  anyone remembering to say so.
- **A signature is a surface.** Callbacks authorized by a signature rather than a session — a
  payment provider's webhooks, a browser returning from external checkout — get their own surface,
  so the signature is checked by the declaration and never forgotten by an entry point.
- **JSON APIs read a record through `GET <resource>/{id}`**, and that read is what an edit form
  loads. There is no `edit` endpoint on a JSON API; "edit" names only a server-rendered screen.
- **One file per resource**, named after the URL segment it serves. A satellite endpoint stays in
  its owner's file.

The surface declaration is the project's to fill, one row per surface, and is kept here as the
record:

| App | Surface | Host / prefix | Authentication | Declared in |
| --- | --- | --- | --- | --- |
| <!-- bootstrap: `apps/api` --> | <!-- admin --> | <!-- `/api/admin` --> | <!-- admin session, active admin --> | <!-- the profile's declaration point --> |

An arch test fails an entry point that sets any part of its surface itself. The test lands with the
first surface, not after the first violation.

## List endpoints

A list that pages, searches, sorts or filters a table decides nothing, so it gets no Command and no
Action. The entry point reads the query string, applies the Model's reusable filters, and hands the
unexecuted query to the project's **one** list response, which applies paging, ordering and search
in the database:

```
Entry point → reusable filters → Model → list response
```

- Every list returns the same envelope, named in the profile. Never hand-roll one, and never rename
  its keys: the frontend's shared table reads them.
- Unrecognised filter values resolve to "no filter", never to an error or to every row.
- Rows are projected **inside the query**, so filtering and ordering push down into SQL.
  Materialising the table to project it pages the whole table in memory, and is not a substitute.
  This is the one place the Response rule in [`coding.md`](coding.md) yields: list rows are
  projected by the list response, every other response by a named Response.
- A list query that already earned a name is called straight from the entry point, with request
  primitives, never a Command built to feed it.
- A list that caches caches the **rendered payload**, keyed on every list parameter, with a TTL and
  the module's version key so a write invalidates it.
- A list returns a list. Anything else — an unread count, a filter's options — gets its own
  endpoint on its own cadence; do not widen the envelope to carry it.
- A search a list offers is indexed for the way it searches. A leading-wildcard `LIKE` over a
  growing table is a full scan per keystroke.

A list stops being a plain read once it has to decide something its filters cannot express, and
then it goes back through an Action like anything else.

## Modules

A module is a bounded slice of the domain. It owns its code, its tables, its routes, its
configuration, its translations, its tests and its frontend feature, and it exposes a **public
surface** — published contracts, events, Queries, and nothing else. Everything not on the public
surface is internal, and the stack's visibility mechanism says so (see the profile).

Independence is not the goal: modules legitimately need each other. A **governed seam** is. Every
interaction between two modules crosses a seam the owner published:

- **Writes** go through the owning module's Action, reached through its published contract. A
  module never inserts, updates or deletes another module's rows — directly, or through the other
  module's Model.
- **Reads** go through the owner's Query or published contract.
- **Reactions** subscribe to the owner's event. Do not call a module back to tell it what you did
  with its data.
- **Events crossing a seam carry identifiers and facts**, never a Model or entity: a listener in
  another module must not need the emitter's internals to use it.
- **Invisible edges count.** A translation namespace, a view namespace, a container key by string,
  a config key, an event name as a string, a foreign key or join across module tables — each is a
  dependency, and the same rules apply to it as to an import.

### Modularity level

ADR-0002 declares the level the project holds. The modularity audit measures against it.

| Level | Data | Cross-module database access | Deployment |
| --- | --- | --- | --- |
| **1 — Code modules** | One database, tables owned per module | Read-only relations for eager loading and joins are allowed; writes are not | One deployable |
| **2 — Data modules** | One schema (or table prefix) per module | None: no foreign key, join or query across module schemas — data crosses only through seams | One deployable |
| **3 — Service modules** | One database per module | None | Deployable independently; seams are network contracts |

### Dependency rules

- Dependencies between modules run one way, and the graph is acyclic. Two modules that need each
  other have a third module hiding inside them, or a missing one both depend on.
- The shared kernel (`Core`, `Shared`, `Support`, or the profile's equivalent) sits at the bottom.
  It depends on no feature module, and it holds no domain feature — a feature that two modules use
  is a module, not shared code.
- Depend toward stability: a module many others depend on changes rarely and exposes contracts; a
  volatile module is depended on by few.
- **The graph is enforced by tooling** — project references, a dependency rule set, an import
  boundary linter (the profile names it). An unguarded graph decays one convenient import at a time.
- A module's tests run without any other feature module's internals present.
- Package dependencies are declared at the app level, so a dependency is visible in one place.

## Asynchronous work

- A Job or Listener calls an Action; the rule it executes lives in the Action, so the same outcome
  is reachable synchronously in a test.
- Queues are named by priority, and every Job declares the queue it runs on. Retry count, backoff
  and timeout are owned by the queue tier, not restated per Job.
- A Job or Listener is idempotent: the queue delivers at least once, so running it twice must leave
  the same state as running it once. Where the work cannot be made idempotent, it holds a lock keyed
  on the subject and checks state under it.
- Work dispatched inside a transaction is dispatched after commit, so a worker never sees a record
  that was rolled back.
- A failed job lands somewhere a person will see it. A queue whose failures go nowhere is a silent
  data loss; the operations audit checks it.

## Exceptions

A layer that cannot follow these rules for a mechanical reason — not a convenience — states the
reason in an ADR, and the rule here names the carve-out, as the list-endpoint projection does. An
exception that lives only in code is drift.

---

Related: [`coding.md`](coding.md) · [`security.md`](security.md) · [`specs.md`](specs.md) · [`testing.md`](testing.md)
