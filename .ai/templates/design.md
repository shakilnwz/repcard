# NNNN: <Capability> — design

How [`spec.md`](spec.md) is built. Written after the spec is Approved; never adds behaviour the
spec does not require. Every section names the requirement IDs it serves.

- **Status:** Draft <!-- Draft | Approved | Superseded -->
- **Stack profile(s):** <[`stack-<name>.md`](../../conventions/stack-<name>.md)>
- **ADRs:** <decisions taken here, or "none">

## Constitution check

Every convention section this design touches, and how the design meets it. A rule the design
cannot meet stops the design: propose an ADR or a convention change first.

| Convention | Section | How this design meets it |
| --- | --- | --- |
| `architecture.md` | <Modules · Surfaces · List endpoints · …> | <…> |
| `security.md` | <Authorization · Money, state and concurrency · …> | <…> |

## Placement

Which module owns each part, and which seams are crossed — published contracts used, events
emitted or consumed. A new seam is named here before it exists in code.

```mermaid
flowchart LR
    A[<module>] -->|<contract or event>| B[<module>]
```

## Entry points and surfaces

| Entry point | Surface | Input → Command | Action or Query | Response | Requirements |
| --- | --- | --- | --- | --- | --- |
| <`POST /api/admin/products/{id}/publish`> | <admin> | <`PublishProductCommand`> | <`PublishProduct`> | <`ProductResponse`> | <R1, R2> |

## Data model

New and changed tables, their owner module, keys, indexes, delete behaviour, and the migration
order. State machines as a diagram when there is one.

## Contracts

The API and event contracts, in `contracts/` when machine-readable. Breaking changes to an existing
contract are listed with their consumers.

## Failure modes

What happens when each dependency fails, times out, or answers twice; which operations are
idempotent and how; what is locked and in what order.

## Risks and alternatives

What could make this design wrong, and the alternatives rejected — briefly; the ADR carries the
full argument.
