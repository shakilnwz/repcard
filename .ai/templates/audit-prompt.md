<!-- Saved as `.ai/prompts/audits/<type>.md`; the relative links below resolve from there. -->

# <Type> Audit

<What this audit finds, and why it matters — one paragraph an agent with no conversation
history can act on.>

**Mode:** Read-only, under [`auditing.md`](../../../docs/conventions/auditing.md). Change nothing but
the output document.
**Output:** <`docs/reports/YYYY-MM-DD-<topic>.md` from `report.md` | `docs/audit/<topic>.md` from
`audit.md`>.
**Inputs:** <what the caller may narrow — scope, a prior report to diff against — and the default
when they do not>.

## Before you start

1. Pin the tree: date, branch, short commit and subject, working-tree state.
2. Read <the conventions this audit measures against>, and the stack profile of every app in scope
   (`AGENTS.md` → **Stacks**).
3. Search `docs/audit/` and `docs/reports/` for <keywords>. Carry every prior finding still present
   with a **Prior** note.

## Scope

- **Default:** <paths>.
- **Excluded:** `vendor/`, `node_modules/`, build output, <anything else>, and why.

## Bar

A finding is <definition>. Excluded from every verdict: <what belongs to another audit, named>.

## Method

1. <step — with the grep patterns, tool and settings it uses>
2. <step>
3. Re-read every Critical and High finding against the code before writing it.

For a large scope, split into non-overlapping passes by <axis>, then merge, de-duplicate and verify.

## Checklist

- [ ] <a specific question the audit answers for every unit in scope>
- [ ] <another>

## Severity

| Severity | In this audit |
| --- | --- |
| Critical | <calibration> |
| High | <calibration> |
| Medium | <calibration> |
| Low | <calibration> |

## Stack notes

How the method differs per stack — the patterns, tools and mechanisms to look for in each.

| Stack | Notes |
| --- | --- |
| Laravel | <…> |
| .NET | <…> |
| Next.js | <…> |
| React | <…> |
| Vue | <…> |

## Output

- IDs: <scheme>.
- Sections: <anything beyond the template's>.

## Done when

- Every unit in scope was covered, or is listed under **Not checked**.
- Every finding has location, evidence, impact and fix.
- Every Critical and High was re-read at the pinned commit.
