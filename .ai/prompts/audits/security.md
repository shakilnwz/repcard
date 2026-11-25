# Security Audit

Measure every surface against [`security.md`](../../../docs/conventions/security.md) and find what
an outside party, a malicious tenant or a concurrent request can do that they should not. Where the
bug audit asks "what goes wrong", this audit asks "what can be made to go wrong, on purpose".

**Mode:** Read-only, under [`auditing.md`](../../../docs/conventions/auditing.md). No exploit is run
against any environment; a trigger is demonstrated by reading the code path, not by attacking.
**Output:** `docs/audit/security.md` from [`audit.md`](../../templates/audit.md), updated in
place on re-runs. Findings must not include working exploit payloads — describe the class and the
path.
**Inputs:** the surfaces in scope (default: all), and whether dependency advisories are included
(default: yes, summarised from the dependencies audit).

## Before you start

1. Pin the tree.
2. Read [`security.md`](../../../docs/conventions/security.md) end to end; it is the checklist's
   spine. Read the authorization ADR.
3. Read the bugs living audit — its Critical findings are usually security findings too; link rather
   than duplicate.
4. Enumerate the attack surface per app (see *Stack notes* for how): every entry point, every
   webhook and signed route, every unauthenticated entry point, every file upload, every outbound
   HTTP client. Read the stack profile's security mechanisms table.

## Scope

- **Default:** every entry point and its surface, validators, policies, Actions on money or state,
  webhook handlers, outbound HTTP clients, templates and components rendering external data,
  configuration, example environment files, seeders, CI and deploy workflows, lockfiles.
- **Excluded:** infrastructure outside the repository (network, WAF, host hardening) — list under
  **Not checked**.

## Bar

A finding is a rule in `security.md` broken on a reachable path, or a control that exists but is
silently void. A rule broken only on an unreachable path is a Low hardening note.

## Method

1. Walk the entry-point list. For each: who can call it, what authorizes the record, what is
   throttled. Mark every entry point whose authorization is only the surface's authentication.
2. Grep for the stack's sinks (see *Stack notes*) — raw HTML, raw SQL, binding requests to models,
   deserialisation, shell execution, public URLs to private files, disabled middleware, CSRF
   exclusions. Read each hit.
3. Find every value the client controls that the server reuses — prices, totals, tax, eligibility,
   ownership read back from a session or hidden field — and check it is re-derived.
4. Trace every outbound HTTP client: the base URL's source, the credentials it carries, and whether
   any part of the host comes from user or tenant input.
5. Trace every money and state transition for locking, transactions and idempotency.
6. Trace every token a user can present: scope, expiry, single use, comparison.
7. Re-read every Critical and High finding with an independent pass.

## Checklist

- [ ] Every route authorizes the record, not only the caller; every permission key is enforced.
- [ ] Tenant isolation holds by construction; caches and queues are keyed per tenant.
- [ ] No unsanitized user HTML reaches a template, especially an admin one.
- [ ] No interpolated input in raw SQL; no mass assignment from the raw request.
- [ ] No credential sent to a host derived from input; base URLs pinned in config.
- [ ] Webhooks: signature checked first, idempotent on event id, throttled; a provider token
      approves one thing once.
- [ ] Money and state transitions: atomic, locked in a consistent order, ledger-backed.
- [ ] Cache store supports atomic locks; app refuses to boot otherwise.
- [ ] Auth endpoints throttled; password and 2FA changes invalidate other sessions; cookie flags.
- [ ] Tokens scoped per subject and purpose, single use, expiring, constant-time compared.
- [ ] Uploads validated by content, size-capped, stored privately, served through authorization.
- [ ] No secret in the repository or its history (`git log -p -S` for key prefixes); `.env`
      ignored; seeders create no usable credential.
- [ ] CSRF exemptions each backed by an ADR.
- [ ] Error pages and logs leak no stack traces, secrets or personal data in production config.
- [ ] Dependency advisories: open advisories affecting reachable code (from the dependencies audit).

## Severity

| Severity | In this audit |
| --- | --- |
| Critical | Account takeover, cross-tenant or cross-customer data access, admin access, money minted or stolen, credential exfiltration — by an outside party |
| High | The same by an authenticated low-privilege user; a security control silently void; stored XSS anywhere |
| Medium | Abuse that costs the platform (unthrottled endpoints, notification floods); information disclosure of non-sensitive data |
| Low | Hardening gaps with no reachable exploit path |

## Stack notes

| Stack | Notes |
| --- | --- |
| Laravel | Surface: `php artisan route:list --json`. Sinks: `{!!`, `v-html`, `DB::raw`, `selectRaw`, `whereRaw`, `orderByRaw`, `$request->all()`, `unserialize`, `exec`, `shell_exec`, `Storage::url` on private disks, `withoutMiddleware`, CSRF `except` entries |
| .NET | Surface: the OpenAPI document plus every `Map*` and controller. Sinks: `[AllowAnonymous]`, endpoints outside a group with a policy, `FromSqlRaw` with concatenation, `@Html.Raw`, `MarkupString`, entities as request bodies (over-posting), `BinaryFormatter` and `TypeNameHandling` deserialisation, `Process.Start`, missing antiforgery on cookie-authenticated forms, `HttpClient` with absolute URLs from input |
| Next.js | Surface: every exported server action, every `route.ts`, every `page.tsx`. Sinks: unwrapped actions, authorization only in `proxy.ts`/`middleware.ts` or layouts, `dangerouslySetInnerHTML`, secrets behind `NEXT_PUBLIC_`, server modules without `server-only`, raw SQL through `$queryRawUnsafe` or string building, ids trusted from closures or hidden fields |
| React | `dangerouslySetInnerHTML`; `javascript:` URLs from data in `href` or `src`; tokens in `localStorage`; API base URLs built from input |
| Vue | `v-html`; tokens in `localStorage`; API base URLs built from input |

## Output

- IDs severity-prefixed, never reused. Each finding names the `security.md` rule it breaks.
- An **Attack surface** appendix: counts of routes per surface, unauthenticated routes, webhooks,
  outbound clients — so the next run can diff it.

## Done when

- Every route in the route list was classified, or is listed under **Not checked**.
- Every sink hit was read; every outbound client traced.
- Every Critical and High was re-read by an independent pass.
