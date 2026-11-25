# Operations Audit

Find what will hurt in production that the code alone does not show: deploy steps that do the wrong
thing, workers and schedulers that are not running, failures that land nowhere, configuration that
degrades silently, backups never restored, nothing alerting when it breaks.

**Mode:** Read-only, under [`auditing.md`](../../../docs/conventions/auditing.md). Environments are
not touched; a claim about a deployed environment is written as "not checked — look for <sign>"
unless the caller provides read access.
**Output:** `docs/reports/YYYY-MM-DD-operations.md` from
[`report.md`](../../templates/report.md).
**Inputs:** environments in scope (default: the repository's description of all of them).

## Before you start

1. Pin the tree.
2. Read [`architecture.md`](../../../docs/conventions/architecture.md) → *Asynchronous work*, the
   **Configuration** section of [`coding.md`](../../../docs/conventions/coding.md), and
   [`lifecycle.md`](../../../docs/conventions/lifecycle.md) G1 and G3–G4 criteria.
3. Read prior operations reports.

## Scope

- **Default:** `.github/workflows/`, `docker/`, `compose.yml`, `Dockerfile`s, process-manager and
  cron configuration, `scripts/`, the task runner, every app's configuration (queue, cache, session,
  logging, mail, storage, database), example environment files, health and status endpoints.
- **Excluded:** cloud resources defined outside the repository — list them under **Not checked**.

## Bar

A finding is a path by which production silently loses work, data or visibility, or by which a
deploy can leave it broken or inconsistent.

## Method

1. **Deploy:** walk each workflow step by step — what it builds, which database each migrate step
   hits, what happens when a step fails (`|| true`, `continue-on-error`), how it rolls back, whether
   caches are rebuilt, whether workers restart on new code.
2. **Workers and schedules:** every queue named in code has a worker in every environment; every
   scheduled command is registered and the scheduler runs; timeouts shorter than the queue's
   `retry_after`.
3. **Failure sinks:** failed jobs land in a table that exists on the configured connection; exceptions
   reach error tracking; logs are structured, rotated and shipped.
4. **Configuration:** every configuration read has an example-environment key; required values stop
   the start;
   cache store supports locks; session and cookie settings per environment.
5. **Data safety:** backups configured, with retention; a documented and performed restore.
6. **Observability:** health endpoint; alerts on error rate, queue depth, failed jobs, scheduler
   heartbeat.
7. **Environment parity:** development, CI and production run the same major versions of runtime,
   database and cache.
8. Re-read every High finding.

## Checklist

- [ ] Deploy migrates the right databases and fails loudly.
- [ ] Rollback exists and is documented.
- [ ] Every queue has a worker; every schedule runs; workers restart on deploy.
- [ ] Failed jobs and exceptions land somewhere watched.
- [ ] Config complete, loud on missing values, lock-capable cache.
- [ ] Backups configured and a restore performed.
- [ ] Health checks and alerts exist.
- [ ] Versions match across environments.

## Stack notes

| Stack | Notes |
| --- | --- |
| Laravel | Supervisor programs per queue; `schedule:run` cron or `schedule:work`; `queue:restart` on deploy; `retry_after` above every job `$timeout`; `failed_jobs` on the configured connection |
| .NET | Hosted services and their restart policy; health checks (`MapHealthChecks`) for readiness and liveness; idempotent migration scripts or bundles applied by the pipeline, not at startup; Data Protection keys shared across instances |
| Next.js | Where it runs (container, Node server, managed platform) and what that implies for long work — no job outlives a request without a job host; `NEXT_PUBLIC_` values baked at build time per environment; cache persistence across instances |

## Severity

| Severity | In this audit |
| --- | --- |
| Critical | A deploy that corrupts or misroutes data; work lost with no record |
| High | A queue or schedule with no worker in production; failures recorded nowhere; no backup, or one never restored |
| Medium | No alerting; silent degradation on missing config; environment version drift |
| Low | Logging format, cache rebuild steps, documentation of runbooks |

## Done when

- Every workflow, container and config file in scope was read, or is listed under **Not checked**.
- Every claim about a deployed environment is marked checked or not checked.
