# Spec-Driven Development

The spec is the source of truth for behaviour. Code implements a spec, tests prove it, and a
behaviour change starts as a spec change. Normative: behaviour no approved spec asks for is a
defect, however well it works. [`architecture.md`](architecture.md) and [`coding.md`](coding.md)
govern how behaviour is built; this file governs what is built, and how anyone can tell.

The conventions, ADRs and `AGENTS.md` are the project's constitution: every spec and design is
checked against them, and a spec that needs one broken proposes the change to the constitution
first.

## Scope

Applies to:

- `docs/specs/**` and `features/**`
- every change that adds, removes or alters behaviour a user or another system can observe

Work that changes no behaviour — a refactor, an audit remediation, a dependency upgrade — goes
through a plan in `docs/plans/`, not a spec.

## The artifacts

One directory per capability, numbered per tree, never renumbered:

```
docs/specs/NNNN-<capability>/
├── spec.md       what and why — requirements, scenarios, non-functional targets; never how
├── design.md     how — module placement, data model, contracts, flows, risks; links ADRs
├── tasks.md      ordered, verifiable steps, each citing the requirements it serves
└── contracts/    machine-readable contracts the capability exposes or consumes (OpenAPI, JSON Schema)
```

Each file starts from its template: [`spec.md`](../templates/spec.md),
[`design.md`](../templates/design.md), [`tasks.md`](../templates/tasks.md).

- **A spec is capability-sized:** something an actor can do, or a capability the system has,
  deliverable in days to a couple of weeks. A spec past roughly fifteen requirements is two specs.
- **`design.md` is required** when the capability touches more than one module, adds or changes a
  table or a contract, or moves money or state. Otherwise the spec may go straight to tasks.
- **Terms come from the glossary.** A spec uses only terms in `docs/reference/glossary.md`, and adds
  any new term to it in the same change, so the domain has one vocabulary from spec to column.

## Status

`Draft → Clarified → Approved → In progress → Implemented`, or `Superseded by NNNN` or
`Withdrawn`. The status line in `spec.md` is the only place status lives.

| Status | Means | Who moves it there |
| --- | --- | --- |
| Draft | Being written; may carry clarification markers | Anyone |
| Clarified | No markers left; every requirement is testable | The author, after the owner answered |
| Approved | Ready to design and build | **The owner only** |
| In progress | Tasks are being executed | Whoever starts the first task |
| Implemented | Every requirement traced to a passing test; conformance checked | Whoever closes the last task, after the scoped spec-conformance audit |

## Requirements

- Every requirement has an ID, `R<n>`, unique and never reused within its spec; it is cited across
  the project as `<NNNN>.R<n>` — `0012.R3`. A withdrawn requirement is struck through, not deleted,
  so its ID stays taken.
- Requirements are written in EARS form, which forces the trigger and the response into the open:

  | Pattern | Form |
  | --- | --- |
  | Ubiquitous | The system shall `<response>`. |
  | Event | When `<trigger>`, the system shall `<response>`. |
  | State | While `<state>`, the system shall `<response>`. |
  | Unwanted | If `<condition>`, then the system shall `<response>`. |
  | Optional | Where `<feature is enabled>`, the system shall `<response>`. |

- One behaviour per requirement, observable from outside: no class, table, route or column names.
- Every functional requirement has at least one acceptance scenario in Given/When/Then. Every
  authorization and validation rule has a scenario for the refusal, not only for the success.
- Non-functional requirements are quantified, or they are wishes: "p95 under 300 ms at 50 requests
  per second", "WCAG 2.1 AA", "available in `en` and `tr`" — never "fast", "accessible", "localised".
- Every spec states what is **out of scope**. What a spec does not exclude, someone will build.
- Ambiguity is marked, never guessed: `[NEEDS CLARIFICATION: <the question>]`. A spec with a marker
  cannot be approved.

## Traceability

The chain runs requirement → task → test → code, and every link is checkable:

- `tasks.md` cites the requirement IDs each task serves.
- Tests cite the requirement IDs they prove, through the runner's tag (see [`testing.md`](testing.md)).
- A pull request names its spec and tasks.
- Code does not cite spec IDs; the tests that exercise it do.

In both directions: every requirement reaches a passing test, and every behaviour in the code
reaches a requirement. Behaviour with no requirement is **overreach** — an extra option, an
unrequested endpoint, a speculative extension — and is either specified or removed.

## The workflow

1. **Specify.** Write `spec.md` from the template: problem, actors, requirements, scenarios,
   non-functional targets, out of scope, open questions as markers. Status Draft.
2. **Clarify.** Put every marker to the owner; record each answer in the spec's clarification log.
   Status Clarified.
3. **Approve.** The owner approves. Status Approved.
4. **Design.** Write `design.md`: module placement, data model, contracts, flows, failure modes,
   risks. Check it against the constitution — every convention section it touches — and record each
   new decision in an ADR.
5. **Plan tasks.** Write `tasks.md`: small, ordered, each independently verifiable, the acceptance
   test of a requirement before the code that satisfies it.
6. **Implement.** Task by task: write the test from the scenario, see it fail, make it pass, tick
   the task. Status In progress.
7. **Verify.** Run the spec-conformance audit scoped to this spec. Close its findings. Status
   Implemented.
8. **Change.** A behaviour change to an Implemented spec edits the spec first — new or amended
   requirements with new IDs, an entry in its change log — then the tasks, tests and code. The spec
   change is reviewed like code.

## Definition of Ready

A spec may be implemented when:

- its status is Approved, and it carries no clarification marker;
- every functional requirement has a scenario, including refusals;
- every non-functional requirement is quantified;
- out of scope is stated;
- `design.md`, where required, is written and its ADRs accepted.

## Definition of Done

A spec is Implemented when:

- every task is ticked;
- every requirement is traced to a passing test;
- the scoped spec-conformance audit finds no divergence and no overreach left open;
- contracts are published and client types regenerated;
- every descriptive document the work made untrue is updated.

## Bugs

A bug is behaviour that contradicts a requirement: fix the code and add a regression test tagged
with that requirement. Behaviour no requirement covers is not a bug yet — it is a gap: add the
requirement to the spec (a Draft amendment the owner approves), then fix it.

## Legacy behaviour

In a project that had code before these rules, the behaviour that predates them is registered,
not condemned. The adoption's spec-conformance sweep lists every existing capability as a row of
`docs/audit/legacy-capabilities.md`.

- A registered capability is neither overreach nor a bug: it is behaviour with no spec yet.
- **Spec on touch.** Before a legacy capability's behaviour changes, it gets a spec. Its
  requirements first state what the capability does today — read from the code and pinned by
  tests — and the change then amends them through the normal flow. A change that alters no
  behaviour (a refactor, a fix that restores intended behaviour the owner confirms) needs no spec.
- **Characterization first.** Before untested legacy code is changed, tests pin its current
  observable behaviour, tagged with the new spec's requirement IDs where they prove one. A
  characterization test that pins behaviour the change alters is updated in the same change, never
  deleted silently.
- The register's row closes, naming the spec, when that spec reaches Implemented. Capabilities the
  owner retires leave the register with their removal.

## Executable scenarios

When an app runs a Gherkin runner (Behat, Reqnroll, playwright-bdd), its acceptance scenarios live
in `features/NNNN-<capability>.feature`, every scenario tagged with its requirement ID, and
`spec.md` links the file instead of repeating the scenarios — a scenario lives in exactly one place.
Journeys spanning several specs live in `features/flows/<journey>.feature` and state no rule of
their own. A scenario not yet passing is tagged `@pending`, and none is left pending at Implemented.

## Agents

- Before implementing behaviour, find the spec and the task. Without one, draft the spec and stop
  for approval — unless the user explicitly says to proceed, in which case the hand-off lists the
  unspecified behaviour so it can be specified afterwards.
- Never invent a requirement, resolve a clarification by assumption, or approve a spec.
- Never build beyond the task. An improvement noticed on the way is proposed as a spec change, not
  shipped as a surprise.

---

Related: [`testing.md`](testing.md) · [`documentation.md`](documentation.md) · [`lifecycle.md`](lifecycle.md)
