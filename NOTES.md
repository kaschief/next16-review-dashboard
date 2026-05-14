# Notes

## Approach

I treated the dashboard as a tool a property operator uses **every day**, not a content site. That single framing drove every UI decision: pending count is the most prominent stat on the page, low-rated pending reviews surface naturally via the rating filter, "Approve" and "Flag" feel decisive (instant feedback, clear consequences), and empty states celebrate when something *good* happened ("No flagged reviews — nice work.").

I built core requirements 1–5 in full, then layered stretch goals (sort, search, skeleton loading, mobile responsive) and one Vitest test suite for the pure filter logic. The architecture biases toward **Server Components first**, with thin client islands for interactivity.

## Key decisions

### State lives in the right place — never higher than it needs to be

I deliberately did **not** introduce a client-side store. Every piece of state lives in its natural home:

- **Server state** (the reviews array): Server Component + server action + `revalidatePath`. Single source of truth, automatic re-render on mutation, no manual sync.
- **URL state** (filters, search, sort): `useSearchParams`. Views are shareable — "send me the link to flagged Berlin reviews" works. Back button is meaningful. First paint is already filtered (no flash of unfiltered content).
- **Component-local state** (per-card optimistic status, pending action, toast, error): `useOptimistic` + `useState`. Each card owns its own UI state because mutations don't interact across cards. Lifting would be over-engineering.

A Zustand store would have actively *removed* the senior-level URL-shareability signal — the prep work flagged that as the top differentiator.

### Types model states exhaustively

`Review.status` is a discriminated string union (`pending | approved | flagged`). Every lookup table that maps from it (`STATUS_LABEL`, `STATUS_STYLES`, `STATUS_CONSEQUENCE`, `STATUS_TOAST_MESSAGE`, button modes) uses `as const satisfies Record<ReviewStatus, X>`. If a fourth status is added next sprint, the compiler fails on every map at once. Invalid states cannot be represented.

### Mutations are optimistic with rollback

The PATCH endpoint is the public contract, but the dashboard goes through a server action (`updateReviewStatus`) that shares the same `mutateReviewStatus` function under the hood. One source of truth, two interfaces. The action runs inside `startTransition` with `useOptimistic` driving the UI — the badge, consequence line, and button state all flip the moment the user clicks, then settle when the server confirms. On failure, `useOptimistic` auto-reverts and an inline error appears.

I added a 400ms simulated latency to the action **in dev only** (`process.env.NODE_ENV !== "production"`). Without it the in-memory store mutates in ~1ms and you can't see the loading state — production would have real network latency and this practice repo should feel like production.

### Mutual exclusivity is visual, not just semantic

When a review is approved, the Flag button goes **fully muted (zinc gray)**, not just "less highlighted." The current state owns the row. This was iteration: my first pass colored both buttons (just at different intensities), which read as "both kind of active." Real fix was three distinct button modes (`active` / `offer` / `muted`) instead of two.

### Empty states are context-aware

A single "no results" panel is fine; context-aware copy is better. `?status=flagged` returning zero is **good news** ("No flagged reviews — nice work.") and renders green. A multi-filter combo returning zero is a UX problem and stays neutral, nudging the operator to clear a filter. Three subtle product signals in one component.

### Layout shift was a real bug, properly diagnosed

The cards moved sideways when filters narrowed the result set. My first guess was scrollbar gutter — wrong. A console diagnostic showed `<main>` itself shrinking from 896 → 795px when content got short, because it's a flex item that defaults to shrink-toward-content. Fix: `w-full` so `<main>` always takes 100% of body width, capped by `max-w-4xl`. Plus `overflow-y: scroll` + `scrollbar-gutter: stable` to lock the scrollbar lane for cross-browser stability.

### Accessibility, baked in

- Semantic `<article>`, `<time dateTime>`, `<button>`-not-`<div>`
- `aria-pressed` on toggle buttons, `aria-busy` while loading, `aria-labelledby` linking card to guest name
- `role="status"` + `aria-live="polite"` on success toasts so screen readers announce changes without interruption
- Star rating: visual stars + `aria-label="N out of 5 stars"` — color and shape are not the only signals
- `prefers-reduced-motion` respected — animations disabled when the OS asks for it
- Focus rings via `focus-visible:` not `focus:` — keyboard users see them, mouse users don't

## What I'd do with more time

- **Authentication + per-operator scoping** — currently all reviews are visible to every viewer
- **Bulk actions** — multi-select cards + a sticky action bar for approve/flag in batch. This is where a Zustand store would finally be the right tool (cross-component selection state)
- **Real persistence** — the in-memory store resets on server restart. SQLite + Drizzle, or a real DB
- **Realtime updates** — Server-Sent Events from the API so two operators viewing the same dashboard see each other's actions
- **More tests** — I covered the pure filter logic. With more time I'd add Playwright e2e for the approve/flag flow and a component test for the optimistic UI
- **Telemetry** — `console.error` in the error boundary is a placeholder. Production would forward to Sentry/DataDog with the `error.digest`

## Assumptions

- **Operators manage 50–200 properties**, scanning the dashboard several times a day. Drove pending-count prominence and the "scan-first" card layout.
- **Desktop-first.** Operators work at desks. Mobile is supported (filter row stacks, summary stats reflow) but not the primary canvas.
- **English locale.** Date formatting uses `en-GB` (`13 May 2026`) — closer to the EU operator market the screenshots suggest. Would add an `i18n` boundary in production.
- **Mock data is representative.** The seed deliberately includes obviously-concerning reviews (bedbugs, hair in bathroom, mislabeled non-smoking) so the "pending + low rating" surface story has something to show.
- **Approval / flagging is a per-operator action**, not a vote or workflow. Single-step state transitions, no review-of-the-review.

## Architecture map

```
app/
├── api/reviews/                 — public HTTP API (route handlers)
│   ├── route.ts                 — GET collection
│   ├── _data.ts                 — in-memory seed store
│   └── [id]/route.ts            — PATCH single (validates, delegates to lib)
├── actions/
│   └── reviews.ts               — server action for dashboard mutations
├── lib/
│   ├── reviews.ts               — getReviews + mutateReviewStatus (shared by API + action)
│   ├── filters.ts               — parseFilters, applyFilters (pure, tested)
│   └── filters.test.ts          — vitest unit tests (14 cases)
├── types/
│   └── review.ts                — Review, status union, display tokens
├── components/
│   ├── review-card.tsx          — card + inline actions (Client)
│   ├── filters.tsx              — URL-driven filter row (Client)
│   ├── summary-stats.tsx        — stats grid (Server)
│   └── empty-state.tsx          — context-aware empty state (Server)
├── page.tsx                     — Server Component, fetches + filters + renders
├── error.tsx                    — route-level error boundary
├── loading.tsx                  — Suspense fallback / skeleton
├── layout.tsx                   — root layout, fonts, metadata
└── globals.css                  — tokens, animations, scrollbar-gutter
```

Public boundaries: components import from `lib/`, `types/`, `actions/`. The API's `_data.ts` is shared with `lib/reviews.ts` only — it's not a public symbol elsewhere.
