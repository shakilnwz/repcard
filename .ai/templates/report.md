# <Topic>: <the finding, in one line>

| | |
| --- | --- |
| **Taken** | YYYY-MM-DD |
| **Branch** | `<branch>` |
| **Commit** | `<short sha>` — *<subject>* |
| **Scope** | <what was read: apps, modules, paths; what was excluded and why> |
| **Method** | <how it was read: full read, grep sweep with patterns, tool and settings, diff, parallel passes and their split> |
| **Verification** | <how Critical and High were re-read; what was spot-checked> |
| **Prompt** | <`.ai/prompts/audits/<type>.md`, or "ad hoc"> |
| **Supersedes** | <the earlier report on this subject, or "none"> |
| **Working tree** | Clean <!-- or exactly what was dirty --> |
| **Status** | <Inventory only. Nothing moved, nothing edited.> |

The answer before the evidence: what was found, how much of it matters, and what to do
first.

Severity — <the calibration used, or "default scale in `conventions/auditing.md`">.

## Summary

| # | Finding | Severity | Location |
| --- | --- | --- | --- |
| 1 | <finding> | <Critical · High · Medium · Low> | `<path>:<line>` |

## 1. <Finding>

- **Location:** `<path>:<line>`
- **Evidence:** <the code, query or count that shows it>
- **Impact:** <what goes wrong, for whom, under which trigger>
- **Fix:** <the change, or the plan in `plans/` that owns it>
- **Prior:** <where it was first recorded, if anywhere — delete otherwise>

## Recommended order

1. <the first change, and why it goes first>
2. <the next>

## Not checked

- <what the scope or method could not reach>
