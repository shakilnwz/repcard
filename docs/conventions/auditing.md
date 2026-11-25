# Auditing Conventions

How an audit is scoped, run, verified and written, whoever runs it — a person, an agent, or a fleet
of agents. Normative: an audit that breaks a rule here is not evidence, however many findings it
lists. [`documentation.md`](documentation.md) governs where its output goes; the per-type prompts in
[`.ai/prompts/audits/`](../../.ai/prompts/audits/) say what each kind of audit looks for.

## Scope

Applies to:

- every document under `docs/audit/` and `docs/reports/`
- every prompt under `.ai/prompts/audits/`
- any review, inventory or investigation whose output is a list of findings

## Read-only

An audit changes nothing but its own document.

- **Allowed:** reading files; `grep`, `find`, `git log`/`blame`/`diff`; static analysis that writes
  nothing into the tree (or writes only to a scratch directory outside it); `SELECT` against a
  development database; listing routes, config and the container.
- **Forbidden:** editing code, migrations, config or other documents; running migrations, seeders
  or anything that writes to a database; installing, upgrading or removing a dependency; calling a
  third-party API with side effects; committing.
- Running the test suite or lint is allowed only when the audit's prompt names it as part of the
  method, and its output is evidence like any other.
- A fix noticed mid-audit is written down as the finding's **Fix**, not applied. Fixing is a
  separate change, made after the audit is written, so the audit records the state it found.

## Two outputs

| Output | Path | Use when | After writing |
| --- | --- | --- | --- |
| **Report** | `docs/reports/YYYY-MM-DD-<topic>.md` | The question is "what is true now" — an inventory, a review, a one-off investigation | Never edited. A later run is a new report that names the old one |
| **Living audit** | `docs/audit/<topic>.md` | The findings must be tracked to closure across many changes | Rows change status as fixes land; nothing is appended as a note |

A report's findings that need tracking seed a living audit: the living audit links the report as
its origin and carries the findings forward with their IDs. A re-run of a living audit's subject
updates the living audit in place and, when it was a full re-run, also files a report.

## Before starting

1. **Pin the tree.** Record the date, branch, short commit and subject, and the working-tree state
   (clean, or exactly what is dirty). Every `path:line` in the output refers to this commit.
2. **Read what exists.** Search `docs/audit/` and `docs/reports/` for the subject. A finding already
   recorded and still present is carried with a **Prior** note naming where it was first recorded —
   not re-described as new, and not silently dropped.
3. **Know the stack.** Read `AGENTS.md`'s **Stacks** table and the profile for every app in scope.
   A finding is measured against the core convention *as the profile realises it*; a profile's
   mechanism is never itself a finding against the core.
4. **Declare scope.** Name the apps, modules and paths read, and what was excluded and why.
5. **Declare method.** Name how it was read: full read, grep sweep (with the patterns), AST or
   metric tool (with its settings), diff against a prior commit, parallel passes (with the split).
   The method is what lets the next audit reproduce or extend this one.
6. **State the bar.** The audit's "done" definition — what makes a finding a finding, what makes it
   closed — and what is excluded from every verdict. Each prompt gives the default; the document
   repeats it.

## Running

- **Partition, then pass.** A large scope is split into passes that do not overlap — by module
  group, by layer, by app, by SPA — and each pass covers its partition completely. Record the split.
- **Read every hit.** A grep hit is a lead, not a finding. Each is read in context before it is
  counted.
- **Count reproducibly.** A number in the output comes with the command or rule that produced it.
- **Coverage is reported.** What the audit did not reach — a module skipped, a runtime path not
  exercised, a database not inspected — is stated under **Not checked**. Silence implies coverage.

## Evidence

A finding is four things; one without all four is a lead and stays out of the document.

- **Location** — `path:line` at the pinned commit, or the narrowest range that holds it.
- **Evidence** — the code, query, count or trace that shows it, quoted or summarised so a reader can
  check it without re-running the audit.
- **Impact** — what goes wrong, for whom, and under which trigger. For a defect, the trigger must
  be reachable; a risk with no reachable trigger is labelled a risk, not a bug.
- **Fix** — the smallest change that clears it, or the plan in `docs/plans/` that owns it.

A claim of absence ("nothing calls X", "no route checks Y") states how it was searched — the
pattern and the paths — because absence is the claim most often wrong.

Never write a line number, a class name or a count from memory. If it was not read at the pinned
commit, it is not in the document.

## Verification

- Every **Critical** and **High** finding is re-read against the code after it is first recorded —
  ideally by a different reader or an independent agent pass that is given the location and claim,
  not the conclusion. A finding that does not survive re-reading is dropped or downgraded.
- **Medium** findings are spot-checked; **Low** findings are verified at least by re-reading the
  location.
- A finding produced by a sub-agent or a tool is unverified until the main author has read the code
  it points at. Agent and tool output arrives in the same confident tone whether it is right or not.
- The document's metadata records how verification was done.

## Severity

The default scale. Each audit type calibrates it in its prompt; the document states the calibration
it used.

| Severity | Means |
| --- | --- |
| **Critical** | Money, accounts, data or an admin surface exposed to an outside party; data loss in a main flow; production cannot deploy or boot |
| **High** | Wrong money or wrong state; a main flow broken; a security control silently void; a normative rule broken in a way that misleads future work |
| **Medium** | A secondary flow broken; a guarantee silently void under a plausible condition; a cost that grows with the data |
| **Low** | An edge case; cosmetic wrong data; a 500 on malformed input; drift with no behavioural effect |

Severity is about consequence under a reachable trigger, not about how much code is involved or how
ugly it is.

## Identifiers

- Every finding gets an ID unique within its document, never reused. Prefix by severity (`C3`,
  `H7`) or by area (`B4` for backend, `F2` for frontend) — the document says which.
- A closed finding keeps its row and its ID. Renumbering breaks every link to it.
- A finding carried from another document keeps a **Prior** note with that document and its ID.

## Writing

Start from [`report.md`](../../.ai/templates/report.md) or [`audit.md`](../../.ai/templates/audit.md).

- The answer before the evidence: the opening paragraph says what was found, how much of it matters,
  and what to do first.
- A summary table, then one section per finding in summary order.
- **Recommended order** closes a report: which fixes go first, and why that order.
- **Not checked** lists what the scope or method could not reach.
- Paths are relative to the root the first paragraph names.

## After the audit

- A finding needing more than one change gets a plan in `docs/plans/`, linked from the finding.
- A finding that reveals a missing rule gets a convention change, proposed — not applied by the
  audit — and an arch test where the rule is mechanically checkable.
- A finding that contests a rule — the code is right and the convention is wrong — gets an ADR.
- **Closing a finding:** replay its trigger against HEAD; when it no longer produces the wrong
  outcome, change its row in the same change as the fix. A row closed without a replay is not
  closed.
- An open finding nobody will fix before release is moved to the living audit's **Backlog** with
  the reason, explicitly — never left open by default.

## Cadence

Audits run at the gates in [`lifecycle.md`](lifecycle.md), and additionally:

- at adoption into an existing project: the baseline audits in [`lifecycle.md`](lifecycle.md) →
  *Adopting an existing project*;
- when a spec moves to Implemented: spec conformance, scoped to that spec;
- before every release, the [`phase-gate`](../../.ai/prompts/audits/phase-gate.md) audit;
- after a refactor touching more than one module: architecture conformance, modularity and
  documentation drift;
- after porting a fix or a feature between sibling modules or apps: consistency;
- after a dependency upgrade: dependencies, and the test-coverage audit's failing-test check;
- after an incident: bugs, scoped to the subsystem, with the incident as the first finding.

## Ownership

Every concern has one owning audit, so a finding is filed once. Another audit that meets it links
the owner's finding rather than re-describing it.

| Concern | Owner |
| --- | --- |
| Behaviour the spec requires but the code lacks, does differently, or goes beyond | Spec conformance |
| A reachable wrong outcome, whether or not a spec covers it | Bugs |
| Something an attacker can make go wrong | Security |
| A layer or flow rule broken inside one module | Architecture conformance |
| A seam, dependency direction, data-ownership or modularity-level rule broken between modules | Modularity |
| The same concern done different ways across modules, apps or surfaces | Consistency |
| A name that breaks the glossary, a naming rule or the language idiom | Naming |
| Structure more complicated than the behaviour needs | Simplification |
| Code nothing reaches | Dead code |
| Branching and size, measured | Complexity |
| A descriptive document untrue of the code | Documentation drift |

## Catalog

| Audit | Prompt | Default output | First required at |
| --- | --- | --- | --- |
| Architecture conformance | [`architecture-conformance.md`](../../.ai/prompts/audits/architecture-conformance.md) | Living audit | G1 |
| Modularity | [`modularity.md`](../../.ai/prompts/audits/modularity.md) | Report | G1, when ADR-0002 declares modules |
| Dependencies | [`dependencies.md`](../../.ai/prompts/audits/dependencies.md) | Report | G1 |
| Operations | [`operations.md`](../../.ai/prompts/audits/operations.md) | Report | G1 |
| Spec conformance | [`spec-conformance.md`](../../.ai/prompts/audits/spec-conformance.md) | Living audit | Each spec at Implemented; G2 |
| Consistency | [`consistency.md`](../../.ai/prompts/audits/consistency.md) | Report | G2 |
| Bugs | [`bugs.md`](../../.ai/prompts/audits/bugs.md) | Living audit | G2 |
| Database schema | [`database-schema.md`](../../.ai/prompts/audits/database-schema.md) | Report | G2 |
| Frontend | [`frontend.md`](../../.ai/prompts/audits/frontend.md) | Report | G2 |
| Test coverage | [`test-coverage.md`](../../.ai/prompts/audits/test-coverage.md) | Report | G2 |
| Security | [`security.md`](../../.ai/prompts/audits/security.md) | Living audit | G3 |
| Performance | [`performance.md`](../../.ai/prompts/audits/performance.md) | Report | G3 |
| Simplification | [`simplification.md`](../../.ai/prompts/audits/simplification.md) | Report | G3 |
| Naming | [`naming.md`](../../.ai/prompts/audits/naming.md) | Report | G3 |
| Dead code and weight | [`dead-code.md`](../../.ai/prompts/audits/dead-code.md) | Report | G3 |
| Complexity and size | [`complexity.md`](../../.ai/prompts/audits/complexity.md) | Report | G3 |
| Documentation drift | [`documentation-drift.md`](../../.ai/prompts/audits/documentation-drift.md) | Report | G3 |
| Phase gate | [`phase-gate.md`](../../.ai/prompts/audits/phase-gate.md) | Updates `docs/audit/readiness.md` | Every gate |

A new audit type is written from [`audit-prompt.md`](../../.ai/templates/audit-prompt.md), added to this
table and to the ownership table, and to a gate in `lifecycle.md` if it is required.

---

Related: [`documentation.md`](documentation.md) · [`lifecycle.md`](lifecycle.md) · [`security.md`](security.md)
