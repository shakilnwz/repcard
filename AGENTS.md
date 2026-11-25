### Important
No need to lint and test unless asked. Say so in the hand-off when a change was not verified.
Talk to me in advanced and sophisticated language of the software engineering domain or industry.

<!--
  Bootstrap: every "bootstrap:" marker below is filled when these rules are installed into a
  project, and the marker removed. Until then the section is a placeholder, not a fact.
-->

## Phase

**Phase 0 — Bootstrap.** <!-- owner: advance this line when a gate closes -->
The phases, their gates and what each gate requires are in
[`docs/conventions/lifecycle.md`](docs/conventions/lifecycle.md); progress against them is tracked
in [`docs/audit/readiness.md`](docs/audit/readiness.md). Work that belongs to a later phase is not
started before the current gate closes unless the user asks for it.

## Stacks

Each app is bound to the stack profiles that realise the core conventions for it. This table is the
authority for which profile binds which path: the stack rule files in `.ai/rules/` match by file
type, and bind only where a row assigns their stack — a frontend inside a server app is its own row,
and the most specific path wins. A profile never relaxes a core rule; where the two seem to
disagree, the core wins and the profile is a defect.

| App / path | Stack | Profiles |
| --- | --- | --- |
| `.` | React <!-- bootstrap: versions --> | [`stack-react.md`](docs/conventions/stack-react.md) |

<!-- specforge:begin -->
<!-- Maintained by SpecForge: its update replaces everything up to specforge:end. Write project
     text outside this block; an edit inside it turns the next update into a manual merge. -->

## Rules for every agent

This file is the one every coding agent reads. The path-scoped rules live once, in `.ai/rules/`;
for each agent listed in `.ai/agents`, `.ai/bin/sync-rules` generates that agent's native copies
(the `ai-*` files under `.claude/rules/`, `.cursor/rules/`, `.github/instructions/`,
`.windsurf/rules/`, `.agents/rules/`, `.kiro/steering/`). An agent that loads none of them follows
the index by hand — **Before writing anything**, step 2. Never edit a generated copy: edit
`.ai/rules/`, then run `.ai/bin/sync-rules`.

Instructions guide an agent; they do not stop one. What enforces the rules, whoever wrote the
change, is CI: `.ai/bin/check` (generated copies in sync, placeholders gone after Phase 0, every
Implemented requirement cited by a test) beside the stack's own lint, type check, tests and arch
tests.

## Spec-driven development

Behaviour is specified before it is built, under [`specs.md`](docs/conventions/specs.md): a spec in
`docs/specs/NNNN-<capability>/` with numbered EARS requirements, approved by the owner, then a
design, then ordered tasks, then code proved by tests tagged with requirement IDs. No behaviour
without an Approved spec; no behaviour beyond it. Work that changes no behaviour is a plan in
`docs/plans/`.

## Authority

When two sources disagree, the higher one wins and the lower one is a defect to report:

1. The user's explicit instruction in the current session.
2. `docs/conventions/*` — normative. A change that breaks a rule there is wrong even if it works.
3. `.ai/rules/*` — path-scoped rules, decisions and traps. They bind the paths in their `paths:`
   frontmatter and never contradict a convention; a rule that does is stale. The per-agent copies
   generated from them are not a source.
4. Accepted ADRs in `docs/adr/` — for the decision they record; Approved specs in `docs/specs/`
   and their `features/` scenarios — for the behaviour they require. A spec that needs a convention
   broken is a defect in the spec until an ADR changes the convention.
5. Generated framework guidelines (Laravel Boost's `<laravel-boost-guidelines>` block and its
   `.ai/rules/boost/`) — they describe the framework, not this project, and yield to 1–4. Where
   they conflict with the line under **Important** above, the line above wins.
6. Existing code. Sibling files show the local shape; they are evidence, not authority.

Descriptive documents (`architecture/`, `reference/`, `workflows/`) never override a normative
one. When a descriptive page contradicts the code or a convention, the page is wrong: fix it in
the same change, or report it.

## Before writing anything

1. For a behaviour change, find the spec and the task it serves in `docs/specs/`. If there is none,
   or the spec is not Approved, stop: draft or amend the spec and ask the owner.
2. Open [`.ai/rules/index.md`](.ai/rules/index.md), and read every rule file whose globs cover the
   paths in scope.
3. Run `grep -rin '<keyword>' .ai/rules docs/conventions` for the subject of the change, to catch
   what a path match misses.
4. Read the conventions those rule files bind, and the profile of the app's stack (**Stacks**
   above). [`architecture.md`](docs/conventions/architecture.md) and
   [`coding.md`](docs/conventions/coding.md) bind all backend code;
   [`frontend.md`](docs/conventions/frontend.md) binds all frontend code.
5. Check `docs/audit/` for an open finding on the code being touched. A change that closes one
   updates its row in the same change.

Record a durable rule — a settled decision, a non-obvious trap, a standing constraint — in
`.ai/rules/` (Boost's `record-rule` tool where it is installed), then run `.ai/bin/sync-rules`;
never in a personal or session-scoped memory, nor in one agent's own rules directory: only
`.ai/rules/` reaches every agent and the team.

## Rules (CRITICAL)

| Convention | Governs |
| --- | --- |
| [`architecture.md`](docs/conventions/architecture.md) | The one-way flow, what each layer may and may not do, surfaces, list endpoints, modules and modularity levels, asynchronous work |
| [`coding.md`](docs/conventions/coding.md) | How code inside a layer is written: types, models, queries, entry points, Commands and Responses, errors, configuration, database, formatting, size, naming, comments |
| [`frontend.md`](docs/conventions/frontend.md) | Frontend structure, ownership and colocation, naming, routing, data and state, behaviour |
| [`specs.md`](docs/conventions/specs.md) | Spec-driven development: artifacts, statuses, EARS requirements, traceability, Definitions of Ready and Done |
| [`security.md`](docs/conventions/security.md) | The baseline every surface meets: authorization, untrusted input, credentials, concurrency on money and state |
| [`testing.md`](docs/conventions/testing.md) | What gets a test, which kind, how conventions are enforced mechanically |
| [`documentation.md`](docs/conventions/documentation.md) | Where every document goes, its template, its lifecycle |
| [`auditing.md`](docs/conventions/auditing.md) | How an audit is scoped, run, verified and written |
| [`lifecycle.md`](docs/conventions/lifecycle.md) | The phases from installing these rules — in a new or an existing project — to release, and the gate closing each |

Stack profiles realise the core conventions per stack; the **Stacks** table binds them to apps:

| Profile | Realises the core for |
| --- | --- |
| [`stack-laravel.md`](docs/conventions/stack-laravel.md) | Laravel: modules, routes and surfaces, DataTables lists, models, PHP idiom, Pest |
| [`stack-dotnet.md`](docs/conventions/stack-dotnet.md) | ASP.NET Core: solution layout, module visibility, minimal APIs, EF Core, C# idiom, xUnit |
| [`stack-nextjs.md`](docs/conventions/stack-nextjs.md) | Next.js App Router, on top of the React profile: full-stack or frontend mode, server/client boundary, server actions, caching |
| [`stack-react.md`](docs/conventions/stack-react.md) | React SPAs, and the base of the Next.js profile: the feature tree, pages and their partials, hooks and effects, server state in TanStack Query |
| [`stack-vue.md`](docs/conventions/stack-vue.md) | Vue 3 SPAs: the feature tree, views and partials, named routes, Pinia |

## Audits

An audit is read-only. It changes nothing but its own document: no code, no migration, no
database write, no dependency change. Run one from its prompt in
[`.ai/prompts/audits/`](.ai/prompts/audits/), under the protocol in
[`auditing.md`](docs/conventions/auditing.md); write a new audit type from
[`.ai/templates/audit-prompt.md`](.ai/templates/audit-prompt.md).

<!-- specforge:end -->

## App conventions

An app's own `docs/conventions/` binds the paths it covers; read the matching file before touching
them:

| Path | Convention |
| --- | --- |
| <!-- bootstrap: `<glob>` --> | <!-- bootstrap: [`<file>.md`](<path>) --> |

## Architecture Overview

<!-- bootstrap: the stack, its versions, and the top-level layout, one bullet per directory.
     Name the ADR that chose the stack. Example shape:

- **Stack:** Laravel <N> on PHP <N>, Vue 3 + TypeScript, TailwindCSS v4, Pinia, Vite — ADR-0001
- **apps/<app>** or **app/**: <what it is>
- **modules/**: one directory per bounded module; see docs/conventions/architecture.md
- **packages/**: shared workspace packages, one line each
-->

- **docs/**: whole-project documentation, laid out by
  [`documentation.md`](docs/conventions/documentation.md) — specs, ADRs, conventions and stack
  profiles, architecture, reference (the glossary among it), workflows, plans, audits, reports
- **features/**: executable acceptance scenarios, tagged with requirement IDs, when a Gherkin
  runner is used
- **.ai/**: material addressed to AI agents rather than people — `rules/` (path-scoped, indexed by
  `rules/index.md`), `prompts/` (runnable tasks, the audits among them), `templates/` (one
  template per document type and the only templates in the repo), `agents` (the agents in use)
  and `bin/` (`sync-rules`, `check`). Laravel Boost reads `.ai/{guidelines,skills,rules}`

## Common Commands

<!-- bootstrap: the commands an agent needs and cannot guess — boot, test, lint, build, and
     where each runs (host or container). Name the CI gates: whatever CI fails on is listed here. -->

## Local Endpoints

<!-- bootstrap: every local URL and port, and the single source of truth for each domain. -->

## Database

<!-- bootstrap: engine and version, connection, credentials for local only, how the test
     database is isolated from the dev database. -->

## Important Notes

- The project prioritizes clean final design over backward compatibility — refactor aggressively.
  Until the first release there are no consumers to stay compatible with; after it, a breaking
  change needs an ADR.
- Never create a documentation file the user did not ask for, except the one a rule above
  requires: an audit's own document, a drift fix, or a status line moved by the change.
