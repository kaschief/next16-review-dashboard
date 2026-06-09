# Guest Review Dashboard

A dashboard for short-stay property operators to triage guest reviews. They can approve a review onto the public listing or flag it for the operations team.

I built it to work through one Next.js pattern end to end: Server Components for data and layout, client components limited to the interactive pieces, view state in the URL, and optimistic mutations with server revalidation.

![Next.js](https://img.shields.io/badge/Next.js-16-black) ![React](https://img.shields.io/badge/React-19-149eca) ![TypeScript](https://img.shields.io/badge/TypeScript-5-3178c6) ![Tailwind](https://img.shields.io/badge/Tailwind-4-38bdf8)

## What it does

An operator opens the dashboard, sees how many reviews are waiting, filters down to the ones that matter (low rating, a given city, still pending), and approves or flags each one. Pending count sits at the top of the page because that's the number operators act on. Filtered views live in the URL, so a set like the flagged Berlin reviews is a link you can send someone.

## Stack

- Next.js 16 with the App Router, async `searchParams`, Server Actions, and `revalidatePath`
- React 19 with `useOptimistic`, `useTransition`, and Server Components
- TypeScript 5 in strict mode, using discriminated unions and `as const satisfies` for exhaustive maps
- Tailwind CSS v4 with a CSS-first `@theme` and no JS config
- SQLite and Drizzle ORM over libSQL. A local file in dev, one env var away from Turso in prod
- Vitest for the filter logic

## Getting started

```bash
npm install
npm run dev          # http://localhost:3000 (runs migrations + seeds on first start)
npm test             # 14 unit tests
npm run build        # production build
```

The `predev`, `prebuild`, and `pretest` hooks run `scripts/setup-db.ts`, which applies the Drizzle migrations and seeds the `reviews` table when it's empty. It's idempotent, so a second run does nothing. The local database (`local.db`) is gitignored.

To deploy against Turso or another libSQL host, set `DATABASE_URL=libsql://...` and `DATABASE_AUTH_TOKEN=...`. The client URL is the only deployment seam, so no code changes are needed.

## How state is split

State falls into three categories, each with a natural home. There's no client store because nothing here needs to live above the component tree.

| State | Where it lives | Why |
| --- | --- | --- |
| Reviews collection | Server Component read, Server Action write, `revalidatePath` | One source of truth, re-renders on mutation |
| Filters, search, sort | URL via `useSearchParams` | Shareable links, working back button, first paint already filtered |
| Per-card optimistic status and error | `useOptimistic` and `useState` | Mutations stay within a card, so the state stays there too |

## Status as an exhaustive type

`Review.status` is `pending | approved | flagged`. Every lookup keyed on it is declared this way:

```ts
const STATUS_LABEL = {
  pending: "Pending",
  approved: "Approved",
  flagged: "Flagged",
} as const satisfies Record<ReviewStatus, string>;
```

Adding a fourth status makes the compiler fail on every map at once, so none gets missed. Invalid states stay unrepresentable.

## Optimistic mutations

The PATCH route and the dashboard's Server Action both call `mutateReviewStatus`, so the HTTP API and the UI stay in sync. The action runs inside a transition with `useOptimistic`, so the badge and status chips flip as soon as you click.

The copy tracks the server state. During a write the UI shows "Approving…" and "Publishing to property listing…". Once the server confirms, it switches to "Visible on property listing". The product effect is a server-side fact, so the UI waits for confirmation before stating it. If the write fails, `useOptimistic` reverts and an inline error appears.

Dev adds 400ms of artificial latency so the in-flight state is visible. Production sets it to zero.

## The status control is a radiogroup

Approve and Flag are mutually exclusive, so the control is a two-option radiogroup. My first version used two toggle buttons, but "press to approve" and "already approved" looked too similar. With radios, the selected option reads as the current state (a filled tinted chip with a check) and the unselected option reads as an available action (an outlined verb chip). When the review is pending, both options sit unselected and the row keeps its shape.

Reset-to-pending is an "Undo" link on the consequence line. Undo belongs to the action that just happened, so it sits with that line. The keyboard model is roving tabindex with arrow-key selection, matching native radios.

## Accessibility

- Semantic `<article>`, `<time dateTime>`, and real `<button>` elements for actions
- `radiogroup` / `radio` / `aria-checked` for the status control, `aria-busy` during a write
- The consequence line uses `role="status"` and `aria-live="polite"`, so screen readers announce changes
- Star rating renders stars plus an `aria-label="N out of 5 stars"`, so the rating is available without colour
- `prefers-reduced-motion` disables the animations
- `focus-visible:` rings for keyboard focus

## Project layout

```
app/
├── api/reviews/             public HTTP API (GET collection, PATCH item)
├── actions/reviews.ts       Server Action for dashboard mutations
├── lib/
│   ├── reviews.ts           getReviews + mutateReviewStatus (shared by API + action)
│   ├── filters.ts           parseFilters, applyFilters (pure, tested)
│   ├── filters.test.ts      14 Vitest cases
│   └── db/
│       ├── schema.ts        Drizzle table + status enum
│       ├── client.ts        memoised libSQL/Drizzle singleton
│       └── seed-data.ts     seed rows (mixed statuses, some concerning)
├── types/review.ts          Review, status union, display tokens
├── components/
│   ├── review-card.tsx      card + radiogroup status control (Client)
│   ├── filters.tsx          URL-driven filter row (Client)
│   ├── summary-stats.tsx    stats grid (Server)
│   └── empty-state.tsx      context-aware empty state (Server)
├── page.tsx                 fetch + filter + render (Server)
├── error.tsx                route-level error boundary
├── loading.tsx              Suspense skeleton
├── layout.tsx               root layout, fonts, metadata
└── globals.css              tokens, animations, scrollbar-gutter

drizzle/                     generated SQL migrations (committed)
scripts/setup-db.ts          migrate + seed-if-empty (run by the pre-* hooks)
drizzle.config.ts            drizzle-kit config
```

Components import from `lib/`, `types/`, and `actions/`. Only `lib/reviews.ts` and `scripts/setup-db.ts` reach into `lib/db/`, so the rest of the app stays storage-agnostic.

## What I'd add next

- Authentication and per-operator scoping. Every review is currently visible to every viewer.
- Bulk actions: multi-select with a sticky action bar. Cross-card selection state is the first feature here that would justify a client store.
- Realtime sync over SSE, so two operators watching the dashboard see each other's actions land.
- More tests: a Playwright run for the approve/flag flow and a component test for the optimistic UI.
- Telemetry: wire the error boundary to Sentry/DataDog using `error.digest`.

See [`NOTES.md`](./NOTES.md) for the longer write-up on the decisions and a layout bug that took a second look to pin down.
