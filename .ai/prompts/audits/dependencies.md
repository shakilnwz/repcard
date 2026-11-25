# Dependencies Audit

Inventory what the project depends on and what that costs: known vulnerabilities, versions behind
or out of support, packages nothing uses, licences incompatible with distribution, and supply-chain
exposure in CI. A dependency is code the project runs and did not write.

**Mode:** Read-only, under [`auditing.md`](../../../docs/conventions/auditing.md). Each ecosystem's
audit and outdated commands (see *Stack notes*) may be run — they read the manifests and lockfiles
and write nothing. Nothing is installed, upgraded or removed.
**Output:** `docs/reports/YYYY-MM-DD-dependencies.md` from
[`report.md`](../../templates/report.md).
**Inputs:** ecosystems in scope (default: every one present — Composer, NuGet, npm/pnpm — plus
container base images and CI actions).

## Before you start

1. Pin the tree, and the lockfiles' last-changed commits.
2. Read the stack ADR — the versions the project committed to.
3. Read prior dependency reports and any open advisory alerts the caller provides.

## Scope

- **Default:** every manifest and lockfile per app and package — `composer.json`/`composer.lock`,
  `*.csproj`/`Directory.Packages.props`/`packages.lock.json`, `package.json` and its lockfile;
  `Dockerfile` base images; `.github/workflows` actions and their pinning.
- **Excluded:** transitive dependencies' own code; licence review beyond declared licences.

## Bar

A finding is an advisory affecting an installed version, a direct dependency with no use, a
runtime or framework past its support window or more than one major behind, a declared licence
incompatible with the project's distribution, or a CI action pinned to a mutable ref.

## Method

1. Run the audit commands per ecosystem; record their output verbatim in an appendix.
2. For each advisory: the affected package and version, whether the vulnerable code path is
   reachable from the project, the fixed version, and whether upgrading is a patch, minor or major.
3. For each direct dependency: an import or config reference exists (reuse the dead-code audit's
   method); note `require` vs `require-dev` correctness.
4. For runtimes and frameworks: installed version against the support schedule.
5. For CI: every `uses:` pinned to a commit SHA or at least a major tag; secrets passed only to
   steps that need them; `pull_request_target` usage.
6. For images: base image tag mutability and age.

## Checklist

- [ ] Every advisory triaged: reachable or not, fixed version, upgrade size.
- [ ] Every direct dependency used, and in the right section.
- [ ] Runtime (PHP, .NET, Node), framework and database versions inside support.
- [ ] Declared licences compatible.
- [ ] CI actions and base images pinned.
- [ ] Lockfiles committed and in sync with manifests.

## Severity

| Severity | In this audit |
| --- | --- |
| Critical | A known-exploited or critical advisory on a reachable path |
| High | A high advisory on a reachable path; a runtime or framework out of security support |
| Medium | An advisory on an unreachable path; a major version behind; an unpinned CI action with secret access |
| Low | Unused dependencies; minor versions behind; licence notes |

## Stack notes

| Stack | Notes |
| --- | --- |
| Laravel | `composer audit`, `composer outdated --direct`; unused packages with `composer-unused` run from outside the tree; check `require` against `require-dev` |
| .NET | `dotnet list package --vulnerable --include-transitive`, `--outdated`, `--deprecated`; versions central in `Directory.Packages.props`; check the runtime against the .NET support policy (LTS vs STS) |
| Next.js / React / Vue | `pnpm audit` / `npm audit`, `pnpm outdated`; unused packages with `knip`; check `dependencies` against `devDependencies` — a dev tool in `dependencies` ships to production images |

## Output

- Advisories table: package, installed, fixed, severity, reachable, upgrade size.
- Appendix: the raw audit command output.

## Done when

- Every ecosystem in scope was audited, or is listed under **Not checked**.
- Every advisory has a reachability verdict with its reasoning.
