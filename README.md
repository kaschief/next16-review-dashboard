# Guest Review Dashboard

A small, opinionated dashboard for short-stay property operators to triage guest reviews — approve them onto a public listing, or flag them to an operations team.

Built as a focused study in modern Next.js architecture: **Server Components first, thin client islands for interactivity, URL-driven view state, and optimistic mutations with server-side revalidation.**

![Next.js](https://img.shields.io/badge/Next.js-16-black) ![React](https://img.shields.io/badge/React-19-149eca) ![TypeScript](https://img.shields.io/badge/TypeScript-5-3178c6) ![Tailwind](https://img.shields.io/badge/Tailwind-4-38bdf8) ![Vitest](https://img.shields.io/badge/Vitest-passing-6e9f18)

---

## Why this exists

Most "dashboard" demos optimise for surface area — many widgets, shallow interactions. This one optimises for the opposite: **one operator job, done well.** Pending count is the most prominent stat. Approve/Flag feel decisive. Empty states celebrate good outcomes ("No flagged reviews — nice work."). Views are shareable via URL.

## Stack

- **Next.js 16** (App Router, async `searchParams`, Server Actions, `revalidatePath`)
- **React 19** (`useOptimistic`, `useTransition`, Server Components)
- **TypeScript 5** in strict mode (discriminated unions, `as const satisfies` for exhaustive maps)
- **Tailwind CSS v4** (CSS-first `@theme`, no JS config)
- **SQLite + Drizzle ORM** via libSQL — local file in dev, swap one env var for Turso in prod
- **Vitest** for the pure filter logic

## Getting started

```bash
npm install
npm run dev          # http://localhost:3000 — auto-runs migrations + seeds on first start
npm test             # 14 unit tests
npm run build        # production build
```

The `predev` / `prebuild` / `pretest` hooks run `scripts/setup-db.ts`, which applies Drizzle migrations and seeds the `reviews` table if it's empty. Idempotent — running twice is a no-op. The local database file (`local.db`) is gitignored.

**Deploying to Turso (or any libSQL host)**: set `DATABASE_URL=libsql://...` and `DATABASE_AUTH_TOKEN=...` — no code changes. The libSQL client URL is the only deployment seam.

## Architecture highlights

### State lives in the right place — never higher than it needs to be

| State | Home | Why |
| --- | --- | --- |
| Reviews collection | Server Component + Server Action + `revalidatePath` | Single source of truth, automatic re-render on mutation |
| Filters / search / sort | URL (`useSearchParams`) | Shareable links, meaningful back button, no flash of unfiltered content |
| Per-card optimistic status, toast, error | `useOptimistic` + `useState` | Mutations don't cross cards — lifting would be over-engineering |

A client store (Zustand/Redux) was deliberately **not** introduced. There is no piece of state in this app that needs to live above the component tree.

### Types model states exhaustively

`Review.status` is a discriminated string union (`pending | approved | flagged`). Every display map uses:

```ts
const STATUS_LABEL = {
  pending: "Pending",
  approved: "Approved",
  flagged: "Flagged",
} as const satisfies Record<ReviewStatus, string>;
```

Add a fourth status next sprint, and the compiler fails on every map at once. Invalid states cannot be represented.

### Mutations are optimistic with rollback

The PATCH endpoint is the public contract. The dashboard goes through a Server Action that shares the same `mutateReviewStatus` function under the hood — **one source of truth, two interfaces**. The action runs inside `startTransition` with `useOptimistic` driving the UI: badge, consequence line, and button mode all flip instantly, then settle when the server confirms. On failure, `useOptimistic` auto-reverts and an inline error appears.

A 400ms simulated latency is added **in dev only** so the loading state is actually visible.

### Mutual exclusivity is visual, not just semantic

Approve and Flag are mutually exclusive states, so the buttons render in one of three modes:

- `active` — solid colour, currently selected
- `offer` — outlined, available action
- `muted` — flat grey, **not available right now**

When a review is approved, the Flag button doesn't just dim — it goes fully grey. The current state owns the row.

### Accessibility baked in

- Semantic `<article>`, `<time dateTime>`, `<button>`-not-`<div>`
- `aria-pressed` on toggles, `aria-busy` while loading, `aria-labelledby` linking card to guest name
- `role="status"` + `aria-live="polite"` on success toasts
- Star rating: visual stars + `aria-label="N out of 5 stars"` — colour and shape are never the only signals
- `prefers-reduced-motion` respected — animations disabled when the OS asks
- `focus-visible:` not `focus:` — keyboard users see focus rings, mouse users don't

## Project layout

```
app/
├── api/reviews/             public HTTP API (GET collection, PATCH item)
├── actions/reviews.ts       server action for dashboard mutations
├── lib/
│   ├── reviews.ts           getReviews + mutateReviewStatus (shared by API + action)
│   ├── filters.ts           parseFilters, applyFilters (pure, tested)
│   ├── filters.test.ts      14 Vitest cases
│   └── db/
│       ├── schema.ts        Drizzle table definition with branded enum types
│       ├── client.ts        memoised libSQL/Drizzle singleton
│       └── seed-data.ts     hand-crafted seed (mixed statuses + concerning content)
├── types/review.ts          Review, status union, display tokens
├── components/
│   ├── review-card.tsx      card + inline actions (Client)
│   ├── filters.tsx          URL-driven filter row (Client)
│   ├── summary-stats.tsx    stats grid (Server)
│   └── empty-state.tsx      context-aware empty state (Server)
├── page.tsx                 fetches + filters + renders (Server)
├── error.tsx                route-level error boundary
├── loading.tsx              Suspense fallback / skeleton
├── layout.tsx               root layout, fonts, metadata
└── globals.css              tokens, animations, scrollbar-gutter

drizzle/                     generated SQL migrations (committed)
scripts/setup-db.ts          migrate + seed-if-empty (run by pre-* hooks)
drizzle.config.ts            drizzle-kit config
```

Public boundaries: components import from `lib/`, `types/`, `actions/`. Only `lib/reviews.ts` and `scripts/setup-db.ts` touch `lib/db/` — the rest of the app is storage-agnostic.

## What I'd add next

- **Authentication + per-operator scoping** — all reviews are currently visible to every viewer
- **Bulk actions** — multi-select cards + sticky action bar. This is where a client store would finally earn its keep (cross-component selection state).
- **Realtime sync** — SSE so two operators viewing the dashboard see each other's actions land.
- **More tests** — Playwright e2e for the approve/flag flow, component test for the optimistic UI.
- **Telemetry** — wire the error boundary to Sentry/DataDog with the `error.digest`.

See [`NOTES.md`](./NOTES.md) for the longer write-up: decisions, tradeoffs, and a few bugs caught along the way.
