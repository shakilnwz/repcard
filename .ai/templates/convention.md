# <Area> Conventions

What these rules govern and where they stop. Normative: a change that breaks a rule here is
wrong even if it works. [`architecture.md`](../conventions/architecture.md) governs which layer
may talk to which, [`coding.md`](../conventions/coding.md) how code inside a layer is written;
this file governs <area>.

## Scope

Applies to:

- `<path or glob>`

Bind the scope in `AGENTS.md`'s path table and in an `.ai/rules/` file whose `paths:` cover the
same globs, so an agent touching those paths is sent here.

## <Topic>

- <A rule, stated as an imperative.> <Its reason, when the reason is not obvious.>
- <A rule.>

```<language>
<the smallest correct example, when a rule needs one>
```

## Enforcement

- <The arch test, lint rule or static-analysis check that fails a violation — or why the rule
  cannot be checked mechanically.>

## Exceptions

- <A case the rules do not cover, and what to do instead.>

---

Related: [<page>](<path>) · [<page>](<path>)
