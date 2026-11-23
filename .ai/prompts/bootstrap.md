# Bootstrap a Project

Take a project that has just received these rules, and has no application code yet, to the close of
gate G0 in [`lifecycle.md`](../../docs/conventions/lifecycle.md): every decision the rest of the
project rests on written down, each app bound to its stack profile, the agents in use configured,
the capabilities in scope listed for specification, every placeholder filled. A project that already
has code is taken through [`adopt.md`](adopt.md) instead.

**Mode:** Writes the rules' documents only — ADRs, the context page, the glossary, `AGENTS.md`,
`.ai/agents` — and runs `.ai/bin/sync-rules`. It creates no application code and no project
infrastructure (ignore files, environment files, CI workflows, a README): where a G0 criterion needs
one, it reports what is missing and writes it only if the owner asks.
**Output:** filled `AGENTS.md`; `docs/adr/0001-*.md`, `docs/adr/0002-*.md`; a context page in
`docs/architecture/`; `docs/reference/glossary.md`; `.ai/agents` and the generated agent rule files;
the rules trimmed to the stacks in use; updated G0 rows in `docs/audit/readiness.md`; a G0 gate
report.
**Inputs:** the owner, who answers the questions below. Never invent an answer the owner did not
give; a placeholder left open is better than a fabricated fact.

## Before you start

1. Confirm the rules are present: `AGENTS.md`, `CLAUDE.md`, `.ai/rules/`, `.ai/prompts/`,
   `.ai/agents`, `.ai/bin/`, `docs/conventions/` (core conventions and `stack-*.md` profiles),
   `docs/templates/`, `docs/audit/readiness.md`.
2. List every placeholder: `grep -rn '<!-- bootstrap:' AGENTS.md docs .ai .github`.
3. Read `lifecycle.md` → G0, [`documentation.md`](../../docs/conventions/documentation.md) and
   [`specs.md`](../../docs/conventions/specs.md).

## Ask the owner

Ask in one round, grouped, with a recommended default for each where one exists:

1. **Product:** what it does, in two sentences; who uses it (each kind of person); what is out of
   scope.
2. **Capabilities:** the things each kind of person must be able to do, one line each — the
   candidate specs. Mark which are needed for a first release.
3. **Vocabulary:** the domain's core nouns and verbs as the owner says them, and the synonyms in use
   that should be retired.
4. **External systems:** payment, mail, storage, DNS, identity, search — each with its provider if
   chosen.
5. **Stack, per app:** Laravel, .NET or Next.js for the server; Vue, React or Next.js for the
   frontend — any combination, each with the path it lives in (a frontend inside a server app, such
   as `resources/js` or `ClientApp`, has its own path); the major versions; database; cache and
   queue; hosting. The rules ship profiles for
   [Laravel](../../docs/conventions/stack-laravel.md), [.NET](../../docs/conventions/stack-dotnet.md),
   [Next.js](../../docs/conventions/stack-nextjs.md) (built on React),
   [React](../../docs/conventions/stack-react.md) and [Vue](../../docs/conventions/stack-vue.md).
   For Next.js, also: full-stack, or a frontend over another app's API.
6. **Shape:** single app or monorepo; which apps; which surfaces each app has (who is on the other
   end, which host, which authentication); modular or not — and if modular, the modules, the shared
   kernel and the modularity level (1 code, 2 data, 3 service) from
   [`architecture.md`](../../docs/conventions/architecture.md) → *Modules*. Default: Level 1 unless a
   reason for more is given.
7. **Agents:** which coding agents will work in the project — Claude Code, Codex, Cursor, Copilot,
   Windsurf, Antigravity, Gemini CLI, Kiro.
8. **Constraints:** compliance, data residency, accessibility and performance targets, deadlines,
   team size.

## Steps

1. Write **ADR-0001** (stack per app) and **ADR-0002** (shape, surfaces, modules and modularity
   level) from [`adr.md`](../../docs/templates/adr.md), status Proposed, with the alternatives the
   owner weighed.
2. Write the context page `docs/architecture/context.md` from
   [`architecture.md`](../../docs/templates/architecture.md): the people (the actors specs will
   name), every external system in one diagram, and the **capabilities in scope** — one line each,
   numbered in the order they will be specified, each to become `docs/specs/NNNN-<capability>/`.
3. Seed `docs/reference/glossary.md` from [`reference.md`](../../docs/templates/reference.md): one
   row per concept — the term, its one-line meaning, and the names it must not be called.
4. Fill `AGENTS.md`: the **Stacks** table — one row per path with its own profiles, a frontend
   inside a server app on a row of its own, since the most specific path wins; **Architecture
   Overview** from the ADRs; **Common Commands**, **Local Endpoints** and **Database** once the
   environment exists (otherwise leave the placeholder and say so).
5. **Trim the rules to the stacks in use**, once the owner approves ADR-0001: list the profiles, the
   `.ai/rules/` stack files and the PR-template lines no app uses, and remove them with the owner's
   approval. Never remove a core convention.
6. Leave the stack rule files' globs as installed: they match by file type, and the **Stacks** table
   decides which stack binds which path (`.ai/rules/general.md`). Adjust a core rule file's `paths:`
   only where the layout needs it — module directories when modular — keeping the frontmatter in the
   form Laravel Boost writes back.
7. **Configure the agents:** confirm `.ai/agents` lists each agent the owner named — the installer
   fills it from its answers — then run `.ai/bin/sync-rules` after any change. It generates every
   agent's rule files and regenerates `.ai/rules/index.md`; a `conflict:` line names a file it will
   not overwrite.
8. Fill the surface-declaration table in `architecture.md` from ADR-0002, leaving the mechanism
   column to the profile.
9. **Check, do not create, what G0 asks of the project:** ignore files and `.editorconfig` (G0.6),
   example environment files with no real values, secrets in history where the project is under
   version control, a one-command local boot (G0.7), CI running each app's lint, format check, type
   check, test and build plus `.ai/bin/check` (G0.8). Report each gap with the smallest change that
   closes it; write it only if the owner asks.
10. Pull-request templates (G0.9) are installed in `.github/PULL_REQUEST_TEMPLATE/`. If the project
    is hosted elsewhere, port their checklists to the host's templates.
11. Run `.ai/bin/check`, then update the G0 rows of `docs/audit/readiness.md` you can evidence and
    set **Opened** to today.
12. Run the [`phase-gate`](audits/phase-gate.md) audit for G0 and file its report.

## Done when

- Every placeholder is filled, or listed in the hand-off with the question it waits on.
- The ADRs are written and awaiting the owner's acceptance.
- Every agent the owner named has its rule files generated, and `.ai/bin/check` passes.
- Every capability in scope is on the context page; the first one is ready to be specified at G1.
- The G0 gate report says plainly whether G0 can close.
- `AGENTS.md`'s **Phase** line is unchanged — advancing it is the owner's decision.
