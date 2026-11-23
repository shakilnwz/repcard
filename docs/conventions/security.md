# Security Conventions

The baseline every surface meets before it ships, in every stack. Normative: a change that breaks a
rule here is wrong even if it works. [`architecture.md`](architecture.md) governs which layer may
talk to which, [`coding.md`](coding.md) how code inside a layer is written; this file governs what
an attacker, a concurrent request or a hostile input must not be able to do. Each stack profile
names the mechanism for every rule and the stack's own sinks and traps.

Each rule below exists because its absence is a recurring class of real defect: a stored XSS
through a support ticket, a platform token sent to a host the customer chose, a withdrawal that
overdraws under concurrency, a rate limiter that silently does nothing, 119 of 174 admin endpoints
with no permission check.

## Scope

Applies to:

- every entry point, validator, Action, Job, Listener and webhook handler
- every template and component that renders data a user or a third party supplied
- configuration, example environment files, seeders, CI and deploy workflows

## Authorization

- **Deny by default.** An authenticated surface authenticates every entry point unless one is
  explicitly, visibly opened (see [`architecture.md`](architecture.md) → *Surfaces*).
- Every entry point is authorized for the record, explicitly. Authentication proves who the caller
  is; it does not prove they may touch *this* record. Ownership and permission are checked by a
  policy or an authorization check inside the Action — never assumed from an id being hard to guess.
- A permission that exists is enforced. A permission the UI offers but no entry point checks is a
  bypass with a label on it; the security audit lists every permission and the check that reads it.
- A record scoped to an owner is fetched through the owner, so a foreign id is a 404, not a leak.
- A tenant boundary is enforced by the connection or a global filter, never by each query
  remembering to filter. Caches, queues, mail transports and storage are tenant-keyed too — a
  long-lived worker must not keep one tenant's configuration for the next.
- Authorization runs where the data is read or written. Edge middleware, route guards and layouts
  are for redirects and user experience; they are never the only check.
- A state an operator imposed — suspended, disabled, banned — is not lifted by an unrelated event.
  Paying an invoice does not undo an admin's disable; only the matching operator action does.
- A gate on a state takes effect when the state changes. A cache that keeps a suspended tenant
  serving for an hour is a bypass with a TTL; invalidate it on the transition.

## Untrusted input

- Validate every field before it reaches a Command: type, format, length, allowed values. A field
  not in the schema does not reach the Command.
- **Never trust a value the client could have changed.** Prices, totals, tax, shipping eligibility,
  discounts, ownership and state are re-derived on the server at the moment they matter, from the
  server's records — never read back from a session the client wrote to, a hidden field, or a
  previous request.
- Never render user-supplied HTML unescaped. Every stack's default interpolation escapes; its
  raw-HTML sink (named in the profile) is allowed only on HTML sanitized server-side with an
  allowlist, at write time, for exactly that purpose. Content shown in an admin panel is the most
  valuable XSS target there is.
- No SQL built from strings with input in it. Parameters or the query builder only.
- Never bind a request directly onto a model or entity. Input reaches persistence through a Command
  whose fields are listed — mass assignment and over-posting are the same defect.
- A value naming a host, a domain or a URL is not trusted to be the platform's. Validate it against
  what it may be, and never let one tenant claim a domain that is a parent, child or duplicate of
  another tenant's.
- Uploads: validate type by content, not extension; cap size; store privately; serve through an
  entry point that authorizes the read.

## Credentials and outbound calls

- **A credential travels only to the host it was issued for.** An HTTP client carrying a platform
  token, an API key or a signed header never sends it to a host derived from user or tenant input.
  Pin the base address in configuration and refuse to send anywhere else.
- Secrets live in the environment and in the deployment's secret store — never in the repository,
  a seeder, a fixture, a log line, an exception message, or a bundle shipped to the browser.
- A stored integration secret is write-only through the API: it is accepted, stored encrypted, and
  never echoed back.
- Seeders never create a credential that works outside local development.
- Tokens a user can present — verification codes, reset links, invitations, signed URLs — are scoped
  to their subject and purpose, single-use, expiring, and compared in constant time. An endpoint
  never mints a signed URL for a subject the caller does not own.

## Webhooks and callbacks

- A webhook is authenticated by its provider's signature, checked on its surface before anything
  reads the body. An unsigned or badly signed call is rejected without side effects and without
  notifying anyone.
- A webhook is idempotent on the provider's event id: the provider retries, so the second delivery
  is a no-op.
- A provider confirmation is bound to exactly what it confirms — the order, the amount, the
  currency — and approves it once. A token that approved one payment is refused for any other.
- A failed status lookup against the provider is *unknown*, not *declined* (see [`coding.md`](coding.md)).
- Unauthenticated entry points that trigger work — notifications, mail, lookups — are throttled and
  deduplicated, so a flood costs the attacker more than it costs the platform.

## Money, state and concurrency

- A transition on money or state is atomic: read, check and write happen under a row lock or an
  atomic conditional update, inside one transaction. Two concurrent withdrawals must not both see
  the balance before either deducts it.
- Locks, rate limiters and idempotency keys require a store with atomic locks. The app refuses to
  start on a store without them rather than running every guard as a no-op.
- Lock rows in a consistent order across code paths that touch more than one, so two payments on
  different invoices cannot deadlock each other.
- A balance is derived from, or reconciled against, an append-only ledger.
- Totals are bounded: a discount never takes a line or an order below zero.

## Sessions and authentication

- Authentication entry points — sign-in, sign-up, reset, 2FA, resend — are throttled per account and
  per IP.
- Changing a password or 2FA invalidates the account's other sessions.
- Session cookies are `HttpOnly`, `Secure` outside local development, and `SameSite=Lax` or
  stricter. Cookie-authenticated state changes are protected against CSRF; an exemption is named in
  an ADR with its compensating control.
- Security headers — Content-Security-Policy, HSTS, frame and referrer policies — are set once per
  app and tested.

## Exceptions

- A rule that cannot hold for a mechanical reason is named in an ADR with the compensating control,
  and the security audit checks the control instead.

---

Related: [`architecture.md`](architecture.md) · [`coding.md`](coding.md) · [`auditing.md`](auditing.md)
