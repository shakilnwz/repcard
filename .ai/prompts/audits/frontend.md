# Frontend Audit

Measure every SPA and server-rendered screen against
[`frontend.md`](../../../docs/conventions/frontend.md), and find what a user meets that they should
not: untranslated strings, inaccessible controls, console errors, duplicated components, screens
that diverge between apps for the same thing.

**Mode:** Read-only, under [`auditing.md`](../../../docs/conventions/auditing.md). `lint` and the
type checker may be run, writing nothing; a browser may be driven against a local environment only
if the caller allows it.
**Output:** `docs/reports/YYYY-MM-DD-frontend.md` from
[`report.md`](../../../docs/templates/report.md).
**Inputs:** SPAs and themes in scope (default: all), whether a browser pass is allowed (default: no).

## Before you start

1. Pin the tree.
2. Read [`frontend.md`](../../../docs/conventions/frontend.md), the frontend rules in
   [`security.md`](../../../docs/conventions/security.md), and every app convention bound to the
   frontend paths in `AGENTS.md`, and each app's frontend profile
   ([`stack-vue.md`](../../../docs/conventions/stack-vue.md),
   [`stack-react.md`](../../../docs/conventions/stack-react.md),
   [`stack-nextjs.md`](../../../docs/conventions/stack-nextjs.md)).
3. Read prior frontend and localisation reports.

## Scope

- **Default:** every frontend app — Vue SPAs, React SPAs, Next.js apps — every workspace UI package,
  every server-rendered template, every translation file.
- **Excluded:** bundle performance (performance audit); backend behaviour behind an endpoint.

## Bar

A finding is a rule in `frontend.md` broken at a named location, a user-visible defect (missing
translation, inaccessible control, console error), or the same screen built twice.

## Method

1. **Structure:** tree against the convention and the profile — route-private colocation,
   cross-feature deep imports, domain code in `shared/`, naming per kind.
2. **Localisation:** literal strings in templates (`>[A-Za-z][^<{]*<` and attribute text);
   translation keys used but missing per locale; keys defined but unused; locale files out of step.
3. **Accessibility:** form fields without labels; icon-only buttons without `aria-label`; click
   handlers on non-interactive elements without keyboard handling; images without `alt`; focus
   styles removed; colour contrast where tokens make it checkable. Use WCAG 2.1 AA as the bar.
4. **Safety:** every raw-HTML sink (`v-html`, `dangerouslySetInnerHTML`, `innerHTML`) traced to its
   source; popups opened after `await`; secrets or server-only data reaching the client.
5. **Data:** hand-written interfaces for backend shapes; URLs built by hand; re-implemented
   paging/sorting; stores holding one view's state.
6. **Duplication:** components with the same purpose across features or apps; a second button,
   modal or table outside the design system.
7. **Runtime (if allowed):** each route loaded once, console errors and warnings recorded.
8. Run `lint` and the type checker; record their output.

## Checklist

- [ ] Structure, naming and routing follow `frontend.md`.
- [ ] No literal user-visible strings; every key present in every locale.
- [ ] Every control labelled, keyboard-operable, visibly focused.
- [ ] No unsanitized raw HTML; no secret or server-only data in client code.
- [ ] Types generated, not hand-written; URLs never hand-built.
- [ ] One component per purpose; design system used.
- [ ] Lint and type check clean; no console errors on any route visited.

## Severity

| Severity | In this audit |
| --- | --- |
| High | Unsanitized user HTML rendered; a main flow unusable by keyboard or screen reader; a main flow untranslated in a shipped locale |
| Medium | Console errors on load; missing labels on forms; hand-written backend types; duplicated components with diverging behaviour |
| Low | Naming and structure drift; cosmetic duplication |

## Stack notes

| Stack | Notes |
| --- | --- |
| Vue | `vue-tsc --noEmit`; named routes only; `views/partials/`; Pinia stores holding one view's state |
| Next.js | `tsc --noEmit`; `'use client'` on layouts or pages; server modules missing `server-only`; ORM objects or secrets in client props; `NEXT_PUBLIC_` values that are secret; missing `error.tsx`, `loading.tsx`, `not-found.tsx` per surface; hydration warnings |
| React | `tsc --noEmit`; `eslint-plugin-react-hooks` disabled anywhere; `useEffect` fetching data or deriving state; pages outside `pages/`, or `pages/partials/`; index keys; server data held in a client store |
| Server templates | Blade, Razor, Twig: literal strings and raw-HTML sinks (`{!! !!}`, `@Html.Raw`, `|raw`) |

## Output

- IDs prefixed per SPA (`A` admin, `C` customer, `S` storefront — or the project's surfaces).
- A **Localisation coverage** table per locale: keys used, missing, unused.

## Done when

- Every SPA and template tree in scope was swept, or is listed under **Not checked**.
- Lint and type-check results are recorded, or the reason they could not run.
