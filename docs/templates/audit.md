# <Subject> Audit

Living record of <what is audited> across <scope>, kept current: when an item closes, its
row changes rather than a note being appended. Paths are relative to `<root>`.

| | |
| --- | --- |
| **Opened** | YYYY-MM-DD, on `<branch>` at `<short sha>` |
| **Origin** | <the report this audit was seeded from, or "first run"> |
| **Scope** | <apps, modules, paths read; what was excluded and why> |
| **Method** | <full read, grep sweep with patterns, tool and settings, parallel passes and their split> |
| **Verification** | <how Critical and High were re-read, and by whom or which pass> |
| **Last verified** | YYYY-MM-DD at `<short sha>` |

## What "<done>" means here

The bar an item has to clear, and what is excluded from every verdict. State how an item is
replayed against HEAD to prove it closed.

Severity — **C**ritical: <calibration>. **H**igh: <calibration>. **M**edium: <calibration>.
**L**ow: <calibration>. IDs are <severity-prefixed | area-prefixed>, never reused.

## Status

**<N> <done> · <M> not <done>** — <a> Critical · <b> High · <c> Medium · <d> Low open.

| # | <Item> | Area | Status |
| --- | --- | --- | --- |
| C1 | <name> | <module> | ✅ <Done> — <the change that closed it> |
| H2 | <name> | <module> | ❌ Not <done> |

## <ID>. <Item>

One section per item not yet done, in status order.

- **Location:** `<path>:<line>`
- **Evidence:** <the code, query or count that shows it>
- **Trigger:** <the reachable input or sequence that produces the wrong outcome>
- **Impact:** <what goes wrong, and for whom>
- **Fix:** <the smallest change that clears it, or the plan in `plans/` that owns it>
- **Prior:** <where it was first recorded, if anywhere — delete otherwise>

## Not checked

What this audit's scope or method could not reach, so a reader does not mistake silence for a
clean bill.

## Backlog

Items the owner accepted as open, with the reason.

| Item | Area | Note |
| --- | --- | --- |
| <item> | <module> | <why it stays open, and who accepted it> |
