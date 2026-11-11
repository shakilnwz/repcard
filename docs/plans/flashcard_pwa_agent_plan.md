# System Design & AI Flashcard PWA — Engineering & Agent Implementation Plan

## 1. Project Overview & Core Objectives

Build a fast, distraction-free, mobile-first Progressive Web App (PWA) for reviewing complex AI/ML and Computer Science system design flashcards multiple times a day.

- **Zero-Backend / Read-Only Remote Sync:** The app fetches card libraries over read-only HTTP `GET` requests (such as our custom [Google Apps Script Content Service](https://developers.google.com/apps-script/guides/content) endpoint bound to the [System Design & AI Learning Tracker](https://docs.google.com/spreadsheets/d/1Zu7kv_GckC3RemSLoJAFlNnHEFr9yb5IAX1YxPfM5ZU/edit)). It never sends `POST`, `PUT`, or `DELETE` requests.
- **Multi-Library ("Bring Your Own Endpoint") Privacy:** No API URLs or Google Sheet endpoints are hardcoded in the source repository or environment variables. Users add, edit, toggle, or remove library URLs directly in the UI (persisted in `localStorage`), keeping personal Google Apps Script URLs private.
- **Local-First Spaced Repetition & Practice:** All card scheduling (`Again`, `Hard`, `Good`, `Easy`), review logs, and cram counters live strictly in the browser (`localStorage`) powered by [ts-fsrs](https://open-spaced-repetition.github.io/ts-fsrs/) ([Open Spaced Repetition](https://github.com/open-spaced-repetition)).
- **Static Edge Deployment:** Built with [Vite](https://v4.vitejs.dev/guide/static-deploy) + React + TypeScript and deployed as a static bundle to [Cloudflare Pages](https://v4.vitejs.dev/guide/static-deploy).

## 2. Tech Stack & Libraries

| Layer | Package / Tool | Purpose & Documentation |
| :--- | :--- | :--- |
| **Framework & Build** | `react`, `react-dom`, `typescript`, `vite` | Fast SPA bundle with strict TypeScript types ([Vite Static Deploy Guide](https://v4.vitejs.dev/guide/static-deploy)). |
| **UI Primitives** | [shadcn/ui](https://ui.shadcn.com/docs/installation/vite) + [Tailwind CSS](https://ui.shadcn.com/docs/tailwind-v4) | Accessible Radix-based components (`Dialog`, `Sheet`, `Button`, `Badge`, `Tabs`, `Switch`, `Progress`). |
| **Spaced Repetition** | [`ts-fsrs`](https://open-spaced-repetition.github.io/ts-fsrs/) | Client-side Free Spaced Repetition Scheduler calculating `Again`, `Hard`, `Good`, and `Easy` intervals. |
| **Schema Validation** | `zod` | Validates external library JSON payloads at the network boundary before caching. |
| **PWA & Offline** | [`vite-plugin-pwa`](https://vite-pwa-org.netlify.app/guide/) | Generates Web App Manifest and Workbox Service Worker for offline study and home-screen installation. |
| **Icons** | `lucide-react` | Minimal, sharp iconography (`Layers`, `RotateCcw`, `CheckCircle2`, `Plus`, `RefreshCw`, `ExternalLink`). |

## 3. Visual Design System, Color Palette & Typography

The interface must feel calm, focused, and comfortable for multi-session daily reading on mobile screens.

### Strict Aesthetic Rules
- **Zero Gradients:** Do **not** use `bg-gradient-*` or `linear-gradient()` anywhere in the UI. Rely strictly on flat, solid surfaces, soft tactile shadows, and high-contrast typography.
- **Strict Two-Color Palette (Zero Diffused Colors, No In-Between):**
  - **Color 1 (Deep Navy):** `#071a52`
  - **Color 2 (Mint Lime):** `#a7ff83`
  - No diffused or intermediary colors (`#05133d`, `#0b246e`, `#143594`, `#f8fafc`, `#a3b8e0`, `#ff6b6b` are strictly prohibited). Every UI element, surface, button, text, and icon is rendered exclusively in `#071a52` or `#a7ff83`.
- **Zero Borders & Tactile Elevation:** No structural `1px` borders anywhere (`border-0`). Depth, card elevation, and visual hierarchy are established solely through subtle shadows (`shadow-sm`, `shadow-md`).
- **Navy Canvas Default Theme (Switched Flashcard):**
  - **Viewport Background (Deep Navy):** `#071a52`
  - **Flashcard Surface (Mint Lime):** `#a7ff83`
  - **Flashcard Typography (Deep Navy):** `#071a52`
  - **Viewport Controls & Top Header (Mint Lime):** `#a7ff83`
  - Delivers a pristine `12.6:1` contrast ratio (WCAG AAA) with zero diffused colors.

### Single-Font Typography & CSS Variables (`src/index.css`)

The whole UI uses one typeface: **Google Sans** (loaded from Google Fonts, weights 400–700), with **Open Sans** as the closest local fallback. Space Grotesk was dropped (2026-11) — hierarchy comes from size and weight, not a second family.

- **`--font-sans` (Tailwind `@theme`):** `'Google Sans', 'Open Sans', system-ui stack`. Tailwind's preflight applies it to `html`, so every element inherits it; no per-element font utilities are needed.
- **Weights:** Google Sans tops out at 700 — use `font-bold` for the heaviest emphasis.
- **Text Justification (`text-justify`):** Card explanatory paragraphs are styled with `text-justify hyphens-auto leading-relaxed` and `[text-align-last:left]` to give clean, editorial, symmetrical card blocks without loose spacing rivers on mobile.

```css
/* Fonts are loaded via <link> in index.html (not a render-blocking CSS @import) */
@import "tailwindcss";

@theme {
  --font-sans: 'Google Sans', 'Open Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
}

:root {
  /* Strictly 2 Colors — Zero Diffused Colors, No Inbetween */
  --c-navy: #071a52;
  --c-mint: #a7ff83;

  /* Navy Canvas Default Theme */
  --bg-app: var(--c-navy);
  --fg-app: var(--c-mint);
  --bg-card: var(--c-mint);
  --fg-card: var(--c-navy);
  --card-shadow: 0 10px 32px -4px rgba(0, 0, 0, 0.45);
}

body {
  background-color: var(--bg-app);
  color: var(--fg-app);
  font-family: var(--font-sans);
  -webkit-font-smoothing: antialiased;
  overscroll-behavior-y: none;
}
```

/* Card Body Justification Safeguards */
.card-content-justified {
  text-align: justify;
  text-justify: inter-word;
  hyphens: auto;
  text-align-last: left;
}
```

### Mobile Ergonomics
- Constrain the main study viewport to `max-w-lg mx-auto min-h-dvh flex flex-col justify-between px-4 py-3` so all interactive flip and rating actions sit naturally in the lower thumb zone on mobile devices.
- Keep the top bar minimal: active library selector pill, due/cram mode switch, and a single icon button to open the **Libraries & Sync** drawer.

## 4. Data Contracts & `localStorage` Architecture

Inspired by [Mochi Cards API](https://mochi.cards/docs/api/) (named structured fields), [AnkiConnect](https://github.com/amikey/anki-connect) (note content vs. card review state separation), and [Askesis SRS Format](https://github.com/Romflz/askesis-project) (deterministic card IDs merged on import without overwriting local progress).

### A. Remote Library `GET` JSON Schema (`src/types/schema.ts`)

Every user-added library URL must return this JSON shape:

```typescript
import { z } from 'zod';

export const FlashcardItemSchema = z.object({
  id: z.string().min(1),
  dateAdded: z.string(),
  term: z.string().min(1),
  domain: z.string().default('System Design'),
  level: z.string().default('General'),
  fields: z.object({
    whatItIs: z.string(),
    problemSolved: z.string(),
    productionContext: z.string(),
  }),
  referenceUrl: z.string().url().nullable().optional(),
  sheetStatus: z.string().optional(),
  tags: z.array(z.string()).default([]),
});

export const RemoteLibraryPayloadSchema = z.object({
  library: z.object({
    id: z.string(),
    title: z.string(),
    version: z.string().default('1.0.0'),
    updatedAt: z.string().optional(),
    cardCount: z.number().optional(),
  }),
  cards: z.array(FlashcardItemSchema),
});

export type FlashcardItem = z.infer<typeof FlashcardItemSchema>;
export type RemoteLibraryPayload = z.infer<typeof RemoteLibraryPayloadSchema>;
```

### B. Local Storage Keys & State Separation

Store three independent namespaces in `localStorage` so syncing remote cards never wipes local review data:

1. **`srs:libraries:v1`** — Array of configured library sources:
   ```typescript
   export interface LibrarySource {
     id: string;            // UUID or library.id from remote payload
     name: string;          // User-editable label (e.g., "Shakil's AI & CS Tracker")
     url: string;           // Private GAS /exec URL or any static JSON URL
     enabled: boolean;      // Whether included in the active study queue
     lastSyncedAt: string | null;
     cardCount: number;
     lastError?: string | null;
   }
   ```
2. **`srs:cards:v1:<libraryId>`** — Cached `FlashcardItem[]` array for offline PWA access. When syncing, upsert cards by `card.id`.
3. **`srs:progress:v1`** — Dictionary keyed by composite key `"${libraryId}::${cardId}"`:
   ```typescript
   import type { Card as FsrsCard } from 'ts-fsrs';

   export interface LocalCardProgress {
     key: string;           // "${libraryId}::${cardId}"
     fsrs: FsrsCard;        // due, stability, difficulty, elapsed_days, scheduled_days, reps, lapses, state, last_review
     cramCount: number;     // Total extra same-day practice flips
     bookmarked: boolean;   // Starred for quick review
     lastRatedAt: string;
   }
   ```

## 5. Multi-Library Management & Private Endpoint Workflow

To guarantee that our personal Google Sheets API URL is **never exposed** in the public codebase:

1. **Zero Hardcoded Endpoints:** The repo contains no `.env` API URLs and no hardcoded Google Apps Script links.
2. **Built-In Starter Demo Deck (Fallback):** When `srs:libraries:v1` is empty on first visit, display a subtle banner (*"Using built-in 4-card starter deck — Add your Library URL to sync your own cards"*) with a 1-tap **"Add Library"** button (`#a7ff83` fill, `#071a52` text).
3. **CRUD Library Drawer (`shadcn/ui` `Sheet` / `Dialog`):**
   - **Add Library:** Input fields for *Library Name* (optional—auto-populated from `payload.library.title` on first fetch) and *Endpoint URL*. Performs a live validation fetch using `RemoteLibraryPayloadSchema.safeParse()` before saving.
   - **Edit / Toggle / Remove:** Users can edit the URL, toggle a `Switch` to include/exclude a library from the active study session, click **Sync Now** (appends `?refresh=1` when manual sync is triggered), or delete a library (with an option to keep or purge its local progress).
   - ** URL Hash Quick-Import (`#import_lib=<base64>`):** Provide a **"Copy Setup Link"** button in the Library Manager that encodes `{ name, url }` into a URL fragment (`https://your-pwa.pages.dev/#import_lib=...`). Because browsers never send `#hash` fragments to servers, you can open that link on your phone to pre-fill your private Google Apps Script endpoint in one tap without typing the long URL.

## 6. Study Modes & Flashcard UX Specification

Support two seamless ways to read cards multiple times a day:

### Mode 1: Spaced Repetition Queue (`Due Now`)
- Filters enabled libraries for cards where `progress` does not exist (`New`) or `new Date(progress.fsrs.due) <= new Date()`.
- Grading bar at the bottom displays 4 buttons with live next-interval previews calculated via `ts-fsrs` (`scheduler.repeat(card, now)`):
  - **Again** (`<10m` — solid `#071a52` background, `1px` `#ff6b6b` border, `#ff6b6b` label)
  - **Hard** (`~1d` — solid `#0b246e` background, `#f8fafc` label)
  - **Good** (`~3d` — solid `#a7ff83` background, `#071a52` bold label)
  - **Easy** (`~7d` — solid `#0b246e` background, `1px` `#a7ff83` border, `#a7ff83` label)

### Mode 2: Multi-Read / Cram Session (`Practice Anytime`)
- Designed specifically for reading your cards **2–3+ times throughout the day** even after your daily `Due` queue reaches zero.
- Filter pills at the top: `All`, `Today / Recent`, `High-Level`, `Low-Level`, `Bookmarked`, or `Hardest (High Difficulty)`.
- Grading in Cram Mode offers **Got It (Next)** and **Still Shaky (Re-queue in Session)**, incrementing `cramCount` without distorting the multi-day FSRS schedule (unless the user toggles *"Count toward SRS schedule"*).

### Card Anatomy (Distraction-Free Single Card View)
- **Front Face:**
  - Top metadata row: Library badge, Domain pill (`AI Systems / LLM Serving`), and Level badge (`High-Level` in `#a7ff83` text on `#0b246e`).
  - Center focus: Large Google Sans (`text-2xl sm:text-3xl font-bold tracking-tight`) displaying the **Term / Concept**.
  - Prompt: mode-aware gesture hint on the card (*"Tap to reveal the answer — then swipe right for Good, left for Again"*); the bottom bar shows a thumb-reachable **Show answer** button (`Space`).
  - Swipe/arrow keys: right = pass (Good / Got It), left = miss (Again / Still Shaky). A swipe that would change the FSRS schedule only grades a revealed card; on an unrevealed card it flips it.
- **Back Face (Revealed in place with crisp instant/150ms transition):**
  - Keeps the **Term / Concept** anchored at the top; the card keeps a fixed size and the breakdown scrolls inside it, so revealing never shifts the layout.
  - Renders three structured, high-legibility blocks separated by `1px solid #143594` dividers:
    1. **WHAT IT IS** (`text-xs uppercase tracking-wider font-bold`) + concise explanation (`text-sm leading-relaxed card-content-justified`).
    2. **PROBLEM SOLVED** (`text-xs uppercase tracking-wider font-bold`) + bottleneck/trade-off summary (`text-sm leading-relaxed card-content-justified`).
    3. **PRODUCTION CONTEXT** (`text-xs uppercase tracking-wider font-bold`) + real-world framework explanation (`text-sm leading-relaxed card-content-justified`) with clickable external `referenceUrl` chip.

## 7. React Architecture & Best Practices Checklist

```text
src/
├── components/
│   ├── ui/                  # shadcn/ui primitives (button, dialog, sheet, badge, switch, tabs)
│   ├── layout/
│   │   └── AppHeader.tsx    # Minimal top bar (Mode switch, Sync indicator, Library drawer trigger)
│   ├── study/
│   │   ├── FlashcardView.tsx    # Accessible card surface with keyboard (Space, 1-4) & touch handlers
│   │   ├── RatingBar.tsx        # Bottom thumb-zone grading buttons with ts-fsrs interval previews
│   │   └── FilterBar.tsx        # Domain / Level / Recent filter pills for Cram Mode
│   └── libraries/
│       ├── LibraryDrawer.tsx    # Add / Edit / Toggle / Delete JSON endpoints
│       └── BackupModal.tsx      # Export / Import full localStorage state as JSON
├── hooks/
│   ├── useLibraries.ts      # Manages srs:libraries:v1 + parallel fetch & Zod validation
│   ├── useCardProgress.ts   # Wraps ts-fsrs grading and srs:progress:v1 persistence
│   └── useKeyboardShortcuts.ts # Space/Enter to flip, 1/2/3/4 to grade, R to undo last rating
├── lib/
│   ├── fsrs.ts              # Pure ts-fsrs helper functions (createEmptyCard, gradeCard, getIntervals)
│   ├── storage.ts           # Typed localStorage read/write with safe JSON parsing & quota guards
│   └── starterDeck.ts       # 4 offline fallback cards when no user library is connected
├── types/
│   └── schema.ts            # Zod schemas & TypeScript interfaces
├── App.tsx
└── main.tsx
```

- **State & Rendering Discipline:**
  - Compute derived queues (`dueCards`, `filteredCramCards`, `sessionStats`) via `useMemo` from raw cards and progress state rather than mirroring arrays in `useState` + `useEffect`.
  - Support a 1-step **Undo Last Rating** stack in memory so accidental taps on mobile can be reversed immediately.
  - Synchronize all enabled libraries concurrently using `Promise.allSettled()` on app boot (`stale-while-revalidate`: render cached cards from `localStorage` immediately on frame 1, then silently merge any newly fetched cards in the background).

## 8. PWA & Cloudflare Pages Deployment Configuration

### A. `vite.config.ts` with [`vite-plugin-pwa`](https://vite-pwa-org.netlify.app/guide/)
```typescript
import path from 'node:path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'SysDesign & AI Flashcards',
        short_name: 'SysCards',
        description: 'Distraction-free System Design & AI spaced repetition flashcards',
        theme_color: '#071a52',
        background_color: '#05133d',
        display: 'standalone',
        orientation: 'portrait',
        icons: [
          { src: '/pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: '/pwa-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}']
      }
    })
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src')
    }
  }
});
```

### B. Cloudflare Pages Static Routing & Headers (`public/`)
- **`public/_redirects`**:
  ```text
  /*    /index.html   200
  ```
- **`public/_headers`**:
  ```text
  /sw.js
    Cache-Control: no-cache, no-store, must-revalidate
  /manifest.webmanifest
    Content-Type: application/manifest+json
  ```
- **Cloudflare Pages Build Settings:**
  - **Framework preset:** `Vite`
  - **Build command:** `npm run build`
  - **Build output directory:** `dist`

## 9. Step-by-Step Execution Tasks for Coding Agent

1. **Task 1 — Scaffold & Design Tokens:** Initialize Vite + React + TypeScript + Tailwind CSS + [shadcn/ui](https://ui.shadcn.com/docs/installation/vite). Load [Google Sans](https://fonts.google.com/specimen/Google+Sans) from Google Fonts and set it as Tailwind's `--font-sans` (Open Sans as fallback), set up text justification rules (`.card-content-justified`), and apply the solid `#071a52` / `#a7ff83` color tokens in `src/index.css` with zero gradients.
2. **Task 2 — Data Layer & FSRS Engine:** Install `zod` and [`ts-fsrs`](https://open-spaced-repetition.github.io/ts-fsrs/). Implement `src/types/schema.ts`, `src/lib/storage.ts`, and `src/lib/fsrs.ts` with composite keys (`${libraryId}::${cardId}`) and 1-step rating undo.
3. **Task 3 — Multi-Library Sync Manager:** Build `useLibraries.ts` and `LibraryDrawer.tsx` supporting Add, Edit, Enable/Disable toggle, Delete, manual refresh (`?refresh=1`), and `#import_lib=` hash link generation/parsing.
4. **Task 4 — Distraction-Free Study UI:** Build `FlashcardView.tsx`, `RatingBar.tsx`, and `FilterBar.tsx` supporting both **Due Queue (FSRS)** and **Practice Anytime (Cram Mode)** with mobile thumb-zone ergonomics and keyboard shortcuts (`Space`, `1–4`, `←`/`→` to swipe, `U` for undo).
5. **Task 5 — Progress Backup & PWA Packaging:** Add a JSON Export/Import modal for `localStorage` backup, configure [`vite-plugin-pwa`](https://vite-pwa-org.netlify.app/guide/), add `public/_redirects` and `public/_headers` for [Cloudflare Pages](https://v4.vitejs.dev/guide/static-deploy), and verify `npm run build` succeeds cleanly.

## 10. Engineering & Design Justification

### A. Single Typeface: Google Sans
The UI originally paired Space Grotesk (terms, headings) with Google Sans (body). It now uses **Google Sans alone**:
1. **Consistency:** One family keeps the card, rating bar and drawer visually coherent; hierarchy is carried by size (`text-2xl`/`text-3xl` terms vs `text-sm` body) and weight (`font-bold` labels).
2. **Legibility:** Google Sans' open apertures and humanist proportions read well both as large terms and in dense multi-sentence breakdowns on mobile.
3. **Performance:** One fewer web-font download on first load of the PWA.

### B. Text Justification Justification (`card-content-justified`)
1. **Architectural Symmetry:** The back of each flashcard is structured into three distinct compartments separated by `1px solid #143594` borders. Justified text forms neat, solid rectangular text columns flush against both margins, matching the clean architectural geometry of the card container.
2. **Eliminating Mobile Ragged-Right Imbalance:** On mobile viewports (360px–430px wide), left-aligned text often produces ragged, erratic right margins that break the visual rhythm of dense technical cards.
3. **Safeguarded CSS Implementation:** Naive justification (`text-align: justify`) can create awkward "rivers of white space" between words. We prevent this by combining:
   - `text-align: justify`
   - `text-justify: inter-word` (distributes spacing evenly between words only)
   - `hyphens: auto` (breaks long technical compound terms cleanly when needed)
   - `text-align-last: left` (guarantees the concluding line of every paragraph rests naturally on the left edge rather than stretching unnaturally across the width).

### C. Strict Color System Justification (Zero Color Changes & No Gradients)
1. **Exceptional WCAG AAA Contrast (12.6:1):** The primary pairing of `#a7ff83` (Mint Lime) on `#071a52` (Deep Navy) yields a contrast ratio of `12.6:1`, far exceeding the WCAG AAA standard of `7:1`. This guarantees crisp readability under direct sunlight, low-light night study, and dimmed OLED screens.
2. **Reduced Cognitive Load via Zero Gradients:** Gradient backgrounds and glossy glassmorphism induce subconscious visual fatigue when studying flashcards 2–4 times a day. Flat, matte surfaces (`#071a52`, `#0b246e`) with crisp `1px` structural borders (`#143594`) create a calm, distraction-free study environment that directs 100% of the user's attention to card content.
3. **Mnemonic Distinction of Semantic Colors:**
   - `#a7ff83` (Mint Lime) signals success, retention, and primary progression (`Good` rating).
   - `#ff6b6b` (Coral Red) signals lapses (`Again` rating) without harsh garishness.
   - `#f8fafc` (Off-White) provides comfortable, non-blinding reading contrast on navy surfaces.

### D. Architectural Justification (FSRS + Zero-Backend Local Sync)
1. **FSRS vs Legacy SM-2:** Modern FSRS (`ts-fsrs`) models both memory stability and retrievability based on cognitive science. It reduces card over-review by 20–30% compared to Anki's SM-2 algorithm while achieving higher target retention.
2. **Composite Key Isolation (`${libraryId}::${cardId}`):** Review state lives independently from card content in `localStorage`. Adding new cards in Google Sheets or updating existing card text never resets study intervals or cram counts.
3. **Privacy by Design:** By storing library URLs strictly in client-side `localStorage` with optional base64 hash imports (`#import_lib=...`), private Google Apps Script endpoints remain 100% confidential and are never committed to Git or logged on static hosting edges.
