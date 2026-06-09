# Notes

## Approach

I built this as a tool someone uses every day, and that shaped most of the UI. Pending count sits at the top of the page. The rating filter surfaces low-rated pending reviews quickly. Approve and flag give immediate feedback. A flagged view with no results reads as good news.

I started with the core flow (list, filter, approve, flag), then added sort, search, the loading skeleton, and responsive layout, plus a Vitest suite for the filter logic. Server Components handle data and layout. The filter row and the review card are the only client components.

## State

There's no client store. State falls into three categories, each with a natural home:

- Reviews: read in a Server Component, written through a Server Action, refreshed with `revalidatePath`. One write path, automatic re-render.
- Filters, search, sort: the URL, through `useSearchParams`. Views are shareable, the back button works, and the first paint is already filtered.
- Per-card status, pending action, and error: `useOptimistic` and `useState`, scoped to the card. Mutations stay within a card, so the state stays there too.

A Zustand store would have cost the URL shareability and added nothing at this size.

## Exhaustive types

`Review.status` is `pending | approved | flagged`. Every lookup keyed on it (labels, badge styles, consequence copy, radio styles) is declared `as const satisfies Record<ReviewStatus, X>`. Adding a status makes the compiler fail on every map at once, so none gets missed.

## Optimistic writes

The PATCH route is the public contract, and the dashboard goes through a Server Action. Both call `mutateReviewStatus`, so there's a single write path. The action runs in `startTransition` with `useOptimistic`, so the badge and status chips flip on click and settle when the server confirms.

One thing I spent time on was keeping the copy in step with the server state. During the write the UI says "Publishing to property listing…". Once the write returns, it shows "Visible on property listing". The product effect is a server-side fact, so the UI waits for confirmation before stating it. On failure `useOptimistic` reverts and an inline error shows.

I added 400ms of latency to the action in dev only. The write returns in about a millisecond otherwise, which hides the in-flight state. Production sets it to zero.

## Why the status control is a radiogroup

My first version used two toggle buttons. The problem was that "press to approve" and "already approved" looked too similar. `aria-pressed` has the right semantics but a weak visual signal. I moved to a two-option radiogroup. The selected radio reads as the current state, with a filled chip and a check. The unselected radio reads as an available action, with an outlined verb chip. A pending review leaves both unselected, and the row keeps its shape.

Reset-to-pending became an "Undo" link on the consequence line. Undo belongs to the action that just happened, so it sits with that line. The keyboard model is roving tabindex with arrow-key selection, matching native radios.

## Context-aware empty states

A single "no results" panel would have worked, but the zero cases mean different things. A flagged view with no matches is good news, so it renders green ("No flagged reviews — nice work."). A multi-filter combination with no matches is a dead end, so it stays neutral and prompts the operator to clear a filter.

## A layout-shift bug

The cards shifted sideways when a filter narrowed the list. I first suspected the scrollbar gutter, which was wrong. A console measurement showed `<main>` itself shrinking from 896px to 795px when the content got short. It's a flex item, and it was shrinking toward its content. Setting `w-full` made `<main>` fill the body up to `max-w-4xl`, and `overflow-y: scroll` with `scrollbar-gutter: stable` keeps the scrollbar lane fixed across browsers.

## Accessibility

- Semantic `<article>`, `<time dateTime>`, and real `<button>` elements for actions
- `radiogroup` / `radio` / `aria-checked` for the status control, `aria-busy` during a write
- The consequence line uses `role="status"` and `aria-live="polite"`, so screen readers announce changes
- Star rating renders stars plus an `aria-label="N out of 5 stars"`, so the rating is available without colour
- `prefers-reduced-motion` disables the animations
- `focus-visible:` rings for keyboard focus

## With more time

- Authentication and per-operator scoping. Every review is currently visible to every viewer.
- Bulk actions: multi-select with a sticky action bar. Cross-card selection state is the first feature here that would justify a client store.
- Realtime updates over SSE, so two operators on the same dashboard see each other's actions land.
- More tests. The filter logic is covered. I'd add a Playwright run for the approve/flag flow and a component test for the optimistic UI.
- Telemetry. The error boundary currently logs to the console. Production would forward to Sentry/DataDog with `error.digest`.

## Assumptions

- Operators run 50–200 properties and check the dashboard several times a day. That drove the pending-first, scan-first layout.
- Desktop-first. Mobile works (the filter row stacks, the stats reflow) but it's a secondary target.
- en-GB dates (`13 May 2026`), since I had EU operators in mind. A production version would add an i18n boundary.
- The seed includes some concerning reviews (bedbugs, hair in the bathroom, a mislabeled non-smoking unit) so the low-rating and pending path has something to show.
- Approve and flag are a single per-operator action. There's no vote or multi-step workflow.

## Architecture map

```
app/
├── api/reviews/
│   ├── route.ts            GET collection (delegates to lib)
│   └── [id]/route.ts       PATCH single (validates id + status, delegates to lib)
├── actions/reviews.ts      Server Action for dashboard mutations
├── lib/
│   ├── reviews.ts          getReviews + mutateReviewStatus (shared by API + action)
│   ├── filters.ts          parseFilters, applyFilters (pure, tested)
│   ├── filters.test.ts     14 Vitest cases
│   └── db/
│       ├── schema.ts       Drizzle table + status enum
│       ├── client.ts       memoised libSQL/Drizzle singleton
│       └── seed-data.ts    seed rows (mixed statuses, some concerning)
├── types/review.ts         Review, status union, display tokens
├── components/
│   ├── review-card.tsx     card + radiogroup status control (Client)
│   ├── filters.tsx         URL-driven filter row (Client)
│   ├── summary-stats.tsx   stats grid (Server)
│   └── empty-state.tsx     context-aware empty state (Server)
├── page.tsx                fetch + filter + render (Server)
├── error.tsx               route-level error boundary
├── loading.tsx             Suspense skeleton
├── layout.tsx              root layout, fonts, metadata
└── globals.css             tokens, animations, scrollbar-gutter
```

Components import from `lib/`, `types/`, and `actions/`. Only `lib/reviews.ts` and `scripts/setup-db.ts` reach into `lib/db/`.
