/**
 * Route-level loading skeleton. Shown while the page's Server Component
 * fetches data — Next renders this as the Suspense fallback.
 *
 * Skeleton shape mirrors the real layout: stats grid, filter bar, list of
 * cards. Identical box geometry prevents layout jump on first paint.
 */
export default function Loading() {
  return (
    <main className="mx-auto w-full max-w-4xl px-6 py-12">
      <div className="mb-6">
        <div className="h-7 w-44 animate-pulse rounded bg-zinc-200" />
        <div className="mt-2 h-4 w-56 animate-pulse rounded bg-zinc-100" />
      </div>

      {/* Stats skeleton */}
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="h-20 animate-pulse rounded-lg border border-zinc-200 bg-white"
          />
        ))}
      </div>

      {/* Filter bar skeleton */}
      <div className="mb-6 h-20 animate-pulse rounded-lg border border-zinc-200 bg-white" />

      {/* Card list skeleton */}
      <ul className="space-y-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <li key={i}>
            <div className="animate-pulse rounded-lg border border-zinc-200 bg-white p-5">
              <div className="flex items-start gap-3">
                <div className="h-10 w-10 rounded-full bg-zinc-200" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 w-32 rounded bg-zinc-200" />
                  <div className="h-3 w-48 rounded bg-zinc-100" />
                </div>
              </div>
              <div className="mt-4 h-3 w-3/4 rounded bg-zinc-100" />
              <div className="mt-2 h-3 w-2/3 rounded bg-zinc-100" />
            </div>
          </li>
        ))}
      </ul>
    </main>
  );
}
