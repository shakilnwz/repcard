# React Profile

How [`frontend.md`](frontend.md) is realised in React with TypeScript, and the rules only React
needs. Normative for every frontend the **Stacks** table in `AGENTS.md` assigns to React — a Vite
SPA, typically the panels of a Laravel or .NET app — and the base of
[`stack-nextjs.md`](stack-nextjs.md): a Next.js app follows this profile too, except where the
Next.js profile names its own mechanism. The stack is React with TypeScript strict, TanStack Query,
TailwindCSS v4 and Vite; the router (React Router or TanStack Router), any client store and the
versions are fixed by the stack ADR.

## Scope

Applies to:

- every `*.tsx` and `*.jsx` file, and the `*.ts` and `*.css` files of a React SPA
- workspace packages consumed by React apps
- the components, hooks and client code of a Next.js app, beneath its own profile

## The tree

```
<spa>/src/
├── app/                    wiring only: providers, router root, query client
├── shared/                 cross-feature and domain-agnostic
│   ├── ui/                 base-button.tsx, base-modal.tsx: the design system
│   ├── hooks/              use-breakpoint.ts, use-clipboard.ts
│   ├── lib/                http client, formatters
│   └── types/
├── features/
│   └── <feature>/          kebab-case, one per domain, mirroring the server module
│       ├── pages/          route-level components
│       │   ├── list-page.tsx
│       │   ├── save-page.tsx
│       │   └── save-page/  files used only by save-page.tsx
│       │       ├── basic-info.tsx
│       │       └── use-basic-info-form.ts
│       ├── components/     used by more than one page of this feature
│       ├── hooks/
│       ├── api/            this feature's requests, query keys and query options
│       ├── schemas.ts      Zod schemas
│       ├── routes.tsx      merged by app/router
│       ├── types.ts
│       └── index.ts        what other features may import
└── main.tsx
```

A Next.js app keeps its own layout — `src/app/` for routing, `src/modules/` for features
([`stack-nextjs.md`](stack-nextjs.md) → *Layout*); the rules below hold inside it.

## Pages and their partials

- Route-level components live under `pages/` as `<name>-page.tsx`, even when the feature has only
  one page.
- Files exclusive to a page live in a directory named after it: `pages/save-page.tsx` owns
  `pages/save-page/`. A file used only by another partial belongs to the same page.
- Never `pages/partials/` or `pages/components/`, and never a shared component inside a page
  directory.

## Components and hooks

- Function components only, with a named props type (`type ProductCardProps = { … }`) and a named
  export. A default export only where a tool requires one: Next.js routing files, `React.lazy`
  targets.
- The rules of hooks hold, enforced by `eslint-plugin-react-hooks` as errors and never silenced. A
  dependency you want to leave out of an effect means the effect is wrong, not the linter.
- An effect synchronises with something outside React — a subscription, the DOM, a non-React
  widget. A value derived from props or state is computed during render; the consequence of an
  event runs in its handler; data is loaded through the data layer, never by `useEffect` and
  `setState`.
- A list's keys are stable identities from the data, never the index of a list that reorders,
  filters or inserts.
- State lives in the nearest component that owns it and is lifted only as far as the nearest common
  owner. Context carries values many layers need and that rarely change — session, theme, locale —
  never frequently changing server data.
- Memoisation (`memo`, `useMemo`, `useCallback`) only where a measurement or a referential-identity
  requirement justifies it; with the React Compiler enabled, none by hand.
- Every route renders inside an error boundary that shows a designed error state.

## Naming

- Files and folders are kebab-case (`product-card.tsx`); components and types are PascalCase
  (`ProductCard`); hooks are `use-<thing>.ts` exporting `use<Thing>`. One exported component per
  file, named for the file.
- Base components begin with `Base` (`BaseButton` in `base-button.tsx`); domain components are
  multi-word.
- Zod schemas end in `Schema`, and the inferred type drops the suffix: `ProductSchema` →
  `type Product`.
- No TypeScript `enum`: an `as const` object and its union type. No `I` prefix on interfaces.
- Icons end in `Icon`.

## Routing

- Each feature exports its routes from `routes.tsx`, lazy-loaded; `app/router` merges them and owns
  nothing else.
- Navigation never builds a path from strings. With TanStack Router, its typed routes; with React
  Router, the app's one route helper module (`paths.users.edit(id)`) — never a literal path in a
  component.

  | Path | Page |
  | --- | --- |
  | `/users` | `list-page.tsx` |
  | `/users/create` | `save-page.tsx` |
  | `/users/:id` | `show-page.tsx` |
  | `/users/:id/edit` | `save-page.tsx` |

## State and data

- Server state lives in TanStack Query. Each feature's `api/` exports its query-option factories and
  mutation hooks over the shared HTTP client, with keys from one factory per feature
  (`userKeys.detail(id)`); a mutation invalidates the keys it made stale. Server data is never
  copied into component state or a client store.
- State shared across pages, or surviving navigation, goes in the one store mechanism the ADR names;
  one page's state stays in the page or its hook.
- State a user can share or reload — filters, sort, page, the selected tab — lives in the URL's
  search parameters, parsed with Zod.
- Server types are imported from the generated declarations (Spatie TypeScript transformer, or the
  OpenAPI client for a .NET backend).

## Forms

- A form validates with the Zod schema that mirrors the server's rules, through React Hook Form and
  its resolver; in Next.js, the action's own schema ([`stack-nextjs.md`](stack-nextjs.md)).
- Server validation errors map back onto their fields.

## Raw HTML and URLs

- `dangerouslySetInnerHTML` is the raw-HTML sink: only on HTML sanitized server-side for that
  purpose.
- A URL that comes from data is checked to be `http:` or `https:` before it reaches `href` or `src`;
  a `javascript:` URL is a script.

## Tooling

- `lint` runs ESLint — `typescript-eslint` strict, `eslint-plugin-react-hooks`,
  `eslint-plugin-jsx-a11y` — then Prettier with `prettier-plugin-tailwindcss`; `lint:fix` writes.
  `tsc --noEmit` is a CI gate.
- Tests: Vitest with Testing Library, querying by role and accessible name and acting through
  `user-event`; MSW at the HTTP boundary. Titled with the requirement ID
  (`it('[0012.R3] …')`, run one with `-t 0012.R3`); Playwright for journeys, tagged
  `{ tag: '@0012.R3' }`.
- Complexity: ESLint's `complexity` rule at 10. Dead code: `knip`. Bundles:
  `rollup-plugin-visualizer`.

---

Related: [`frontend.md`](frontend.md) · [`stack-nextjs.md`](stack-nextjs.md) · [`security.md`](security.md)
