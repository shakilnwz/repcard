# Frontend Conventions

What these rules govern and where they stop. Normative: a change that breaks a rule here is wrong
even if it works. [`architecture.md`](architecture.md) governs the server a frontend talks to,
[`coding.md`](coding.md) how server code is written; this file governs everything that runs in the
browser, whatever the framework.

The framework's profile realises these rules: [`stack-vue.md`](stack-vue.md) for Vue SPAs,
[`stack-react.md`](stack-react.md) for React SPAs, and [`stack-nextjs.md`](stack-nextjs.md), built
on the React profile, for Next.js. A profile names directories and mechanisms; it never relaxes a
rule here.

## Scope

Applies to:

- every `*.vue`, `*.tsx`, `*.jsx`, `*.ts` and `*.css` file that ships to a browser
- workspace UI packages, and server-rendered templates

## Choosing the structure

The structure follows the size and shape of the app, and changes when the shape does:

| Situation | Structure |
| --- | --- |
| One domain, under ~20–30 components | Flat: route-level views, components, composables or hooks, stores |
| Several domains in one app | **Feature folders**, one per domain, plus a `shared/` layer |
| Several deployable apps sharing code | Feature folders in each; shared code in workspace packages |

Do not adopt feature folders on day one; migrate when a second real domain appears, in one change.
A monorepo is for multiple deployables, not for one big app. When the server is modular, frontend
features mirror its modules, so one domain has one name on both sides.

## Ownership and colocation

- **A file exclusive to one route lives with that route.** Route-level views or pages are the only
  thing in the routing layer; what one view alone uses sits beside it, in a directory the profile
  names, and moves out the moment a second view needs it.
- **A file only one feature uses lives inside that feature.** The moment a second feature needs it,
  promote it to `shared/` in the same change. Nothing domain-specific goes in `shared/`.
- **Features do not reach into each other's internals.** A feature exposes what others may use
  through its public entry (an index module); anything else is reached through shared state, a
  route parameter or an event — never a deep import. An import boundary linter enforces it.
- Check the design system before writing a component. A second button, modal or table is a
  design-system defect.
- Prefer semantic component names over generic ones like `Part1`, `Part2`, `Part3`.

## Naming

- Directory names are kebab-case. Component files follow the profile's idiom; whatever it is, it is
  one rule per app.
- Base components of the design system share one prefix (`Base…`, or the package's namespace);
  domain components are multi-word.
- Hooks and composables are named `use<Thing>`.
- Validation schemas are named for what they validate and live with the feature that owns the form.
- Icons live in one shared place, named for what they depict and suffixed `Icon`.
- The names a user reads come from the glossary, as on the server.

## Routing and navigation

- Every route is declared in one place per app (the router, or the file-system routing directory).
- Navigation never builds a URL by string concatenation. It goes through the router's named or
  typed routes, so a moved route fails the build, not the user.
- A CRUD resource uses one route shape: list, create, show, edit. Create and edit share one form
  component; the route says which mode it is in. The edit form loads the record through the API's
  single-record read.

## Data, state and types

- Requests go through one shared HTTP client per app and the feature's API module. A component never
  builds a request by hand. One client means one place for CSRF, authentication headers, error
  normalisation and the 401/419 handling — four clients disagree on all of them.
- Server shapes come from generated types (see [`coding.md`](coding.md)); never hand-write an
  interface for them.
- The same validation schema runs on the client and the server where the stack allows it; where it
  cannot, the server's rules are the authority and the client's are a convenience that must agree.
- Shared state lives in the profile's store mechanism; state one view owns stays in that view.
- Lists render through the shared table component, which reads the project's list envelope. A
  feature does not re-implement paging, sorting or search.

## Behaviour

- Every user-visible string goes through the app's one i18n mechanism, and every shipped locale has
  every key. A literal string in a template is a localisation defect; a second i18n mechanism is a
  consistency defect.
- Every interactive element is reachable and operable by keyboard, has an accessible name, and shows
  focus. A form field has a label; an icon-only button has an accessible label. WCAG 2.1 AA is the
  bar.
- A popup that must open from a user gesture opens synchronously in the gesture's handler; awaiting
  before opening gets it blocked.
- User-supplied HTML is never rendered raw unless it was sanitized on the server for that purpose
  (see [`security.md`](security.md); the profile names the raw-HTML sinks).
- Loading, empty and error states are designed, not incidental: every data-backed view renders all
  three.
- A shipped screen produces no console errors or warnings.

## Tooling

- Lint, format and type-check are three committed configurations and three CI gates; the profile
  names the tools. A frontend nothing type-checks lets type drift pass unnoticed.
- Shared lint and format configuration lives in one workspace package that every app and package
  re-exports.
- TypeScript runs strict.

## Exceptions

- A third-party library that dictates its own file layout (an editor plugin, a theme engine) keeps
  that layout inside its own directory, named in the app's `docs/conventions/`.
- An existing inconsistency is not a precedent. Follow this file in new work unless the change is
  inside a feature that must stay internally consistent until it is migrated whole.

---

Related: [`stack-vue.md`](stack-vue.md) · [`stack-react.md`](stack-react.md) · [`stack-nextjs.md`](stack-nextjs.md) · [`security.md`](security.md)
