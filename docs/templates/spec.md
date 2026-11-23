# NNNN: <Capability, in the actor's words>

- **Status:** Draft <!-- Draft | Clarified | Approved | In progress | Implemented | Superseded by NNNN | Withdrawn -->
- **Owner:** <who approves>
- **App(s) / module(s):** <where it lands — names only, no design>
- **Design:** <[`design.md`](design.md), or "not required: one module, no schema, no contract, no money or state">
- **Acceptance scenarios:** <"below", or [`features/NNNN-<capability>.feature`](../../../features/NNNN-<capability>.feature)>
- **Related:** <specs this depends on or extends, ADRs, the context page>

## Problem

Who has the problem, what it costs them today, and what changes for them when this ships. Two
or three sentences; no solution.

## Actors

- **<Persona from the context page>** — <what they want from this capability>

## Requirements

Each requirement is one observable behaviour, in EARS form, testable from outside. Glossary terms
only; no class, table, route or column names. IDs are never reused — strike a withdrawn one.

### R1 — <short name>

When <trigger>, the system shall <response>.

```gherkin
Scenario: <the case where the requirement is satisfied>
  Given <the starting situation>
  When <the actor does something>
  Then <what is observably true afterwards>

Scenario: <the refusal — the case the rule forbids>
  Given <the starting situation>
  When <the actor does something the rule forbids>
  Then <how the product protects the rule>
```

### R2 — <short name>

If <unwanted condition>, then the system shall <response>.

```gherkin
Scenario: <…>
```

## Non-functional requirements

Quantified, or deleted. Each gets an ID in the same sequence.

| ID | Requirement | Target | How it is measured |
| --- | --- | --- | --- |
| R<n> | <performance · accessibility · localisation · security · availability> | <the number or standard> | <the test, tool or check> |

## Out of scope

- <what this spec deliberately does not do — and where it is tracked if it will be done later>

## Clarifications

Open questions are marked in place as `[NEEDS CLARIFICATION: <question>]`. When the owner answers,
the marker is replaced by the answer and logged here.

| Date | Question | Answer | By |
| --- | --- | --- | --- |

## Change log

Behaviour changes after approval: what changed, which requirement IDs were added, amended or
struck, and who approved.

| Date | Change | Requirements | Approved by |
| --- | --- | --- | --- |
