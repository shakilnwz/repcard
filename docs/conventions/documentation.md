# Documentation Conventions

Where every document goes, what it starts from, and how it ages. Normative: a document that breaks a
rule here is wrong even if it reads well. The comment rules in [`coding.md`](coding.md) apply to
prose too: a sentence must be true of the code it describes, and stand alone.

## Scope

Applies to:

- `docs/**`, `apps/*/docs/**`
- `AGENTS.md`, `CLAUDE.md`, `README.md`
- `.ai/**`
- `features/**`, `apps/*/features/**`

## Layout

`docs/` holds the whole-project documentation. In a monorepo, each app carries its own `docs/` laid
out exactly like the root: a document concerning one app goes in that app's tree, anything spanning
more than one goes in the root. A directory exists only when it has content.

| Directory | Holds | Kind | File name | Template |
| --- | --- | --- | --- | --- |
| `specs/` | Required behaviour, one directory per capability | Normative once Approved | `NNNN-<capability>/{spec,design,tasks}.md` | `spec.md`, `design.md`, `tasks.md` |
| `adr/` | Decisions, numbered per tree | Normative for its decision | `NNNN-<decision>.md` | `adr.md` |
| `conventions/` | Rules for how code is written, the project is run, and each stack is used | Normative | `<topic>.md`, `stack-<name>.md` | `convention.md` |
| `architecture/` | How the system is shaped | Descriptive | `<topic>.md` | `architecture.md` |
| `reference/` | Mechanics, catalogs, registers — the glossary among them | Descriptive | `<topic>.md` | `reference.md` |
| `workflows/` | End-to-end traces through the code | Descriptive | `<workflow>.md` | `workflow.md` |
| `plans/` | Work with no new behaviour — refactors, remediations, upgrades — with its status | Tracking | `<topic>.md` | `plan.md` |
| `audit/` | Living audits, kept current | Tracking | `<topic>.md` | `audit.md` |
| `reports/` | Point-in-time snapshots, never edited after | Evidence | `YYYY-MM-DD-<topic>.md` | `report.md` |
| `features/` | Executable acceptance scenarios, when a Gherkin runner is used | Normative | `NNNN-<capability>.feature`, `flows/<journey>.feature` | `feature.feature` |
| `.ai/prompts/` | Runnable tasks addressed to agents | Instruction | `<task>.md` | `audit-prompt.md` for audits |
| `.ai/rules/` | Path-scoped rules, decisions and traps — the one source every agent's copy is generated from | Normative for its paths | `<area>.md` | Boost's `record-rule`, or by hand |
| `.ai/agents`, `.ai/bin/` | The agents in use; the `sync-rules` and `check` scripts | Tooling | — | — |
| `.ai/specforge.lock` | What the SpecForge installer installed: version, answers, a checksum per file | Generated — never edited; committed | — | Written by the installer |
| `.claude/rules/`, `.cursor/rules/`, `.github/instructions/`, `.windsurf/rules/`, `.agents/rules/`, `.kiro/steering/` | Each agent's native copy of `.ai/rules/`, for the agents in `.ai/agents` | Generated — never edited | `ai-<area>.*` | Written by `.ai/bin/sync-rules` |

`docs/templates/` holds one template per document type and is the only place templates live. Start
every document from its template; a section the template has and the document does not need is
deleted, not left empty.

`docs/reference/glossary.md` is the register of the project's terms — one line per concept, its one
name, and the names it must not be called. Specs, code, schema, API fields and UI copy use only its
terms (see [`coding.md`](coding.md) → *Naming*).

## The three kinds

- **Normative** documents say what must be true. `conventions/`, `.ai/rules/`, an accepted ADR's
  decision, an Approved spec and its `features/` scenarios are normative. Code that disagrees with
  them is wrong.
- **Descriptive** documents say what is true. `architecture/`, `reference/` and `workflows/` describe
  the code as it stands; when they disagree with it, the document is wrong. They never state a rule —
  a "must" or "never" in a descriptive page is either a convention that belongs in `conventions/` or
  drift.
- **Tracking and evidence** documents say where things stand. `audit/`, `plans/` and a spec's
  `tasks.md` change as work lands; `reports/` record what was true on a date and never change.

## Lifecycle

| Kind | Created when | Changes when | Ends when |
| --- | --- | --- | --- |
| Spec | A capability is wanted | Before the code, for every behaviour change; status per [`specs.md`](specs.md) | Superseded by a later spec, which it then names, or Withdrawn |
| ADR | A decision with alternatives is taken | Only its **Status** line, once accepted | Superseded by a later ADR, which it then names |
| Convention | A rule is agreed | A rule is added, sharpened or retired — in the same change as the code it governs | Never; rules are retired individually |
| Architecture, reference, workflow | A subsystem is built | Any change that makes it untrue, **in that same change** | The subsystem is removed |
| Plan | Non-behavioural work is scoped before it starts | Its **Status** line moves in the change that completes a phase | **Status** reads Done, and its outcome is captured in architecture/reference/ADR; it may then be deleted |
| Living audit | Findings need tracking to closure | A row's status changes in the change that fixes it | Every row is closed or accepted into the backlog |
| Report | An audit or investigation is run | Never | Never; it is superseded by a newer report |

A change that makes a descriptive document untrue and does not fix it has introduced drift; the
documentation-drift audit exists to find what slipped through. A change that alters behaviour without
its spec has introduced overreach; the spec-conformance audit finds that.

## Writing

- The answer comes first. A report opens with the finding, a plan with the change, an ADR with the
  context that forced it, a spec with the problem it solves.
- Every concrete identifier — class, method, path, route name, config key, env var, command, table,
  column — is in backticks, exactly as it appears in code. That is what lets the drift audit grep
  every claim. Specs are the exception: they name no identifiers at all.
- Locations are `path:line`, relative to the root the document names in its first paragraph.
- Dates are absolute, `YYYY-MM-DD`. "Recently", "last week" and "the new" rot on the day they are
  written.
- Diagrams are Mermaid, in the document, so they diff and render where the document does.
- No directory indexes and no prev/next navigation footers; a closing `Related:` line carries the
  links a reader needs next.
- No ticket IDs, phase numbers or plan references inside conventions, architecture or reference
  pages; those belong in plans, tasks and audits.
- Agent-facing material (`.ai/`) is written for an agent with no conversation history: it names
  the files to read, the output to produce and the condition that means done.

## Exceptions

- A file a tool generates (`CLAUDE.md`'s Boost block, `.ai/rules/boost/`, `.ai/rules/index.md`, the
  agents' `ai-*` rule files) keeps the tool's format; edit the source the tool reads, not its output.
- An agent's rule file the project wrote itself, outside the `ai-*` names, is the project's own and
  is never generated over; a rule meant for every agent moves into `.ai/rules/`.

---

Related: [`specs.md`](specs.md) · [`auditing.md`](auditing.md) · [`lifecycle.md`](lifecycle.md)
