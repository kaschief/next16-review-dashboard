import type { Review } from "@/app/types/review";

interface SummaryStatsProps {
  reviews: readonly Review[];
}

/**
 * Top-of-page stats bar. Pending count is intentionally the most visually
 * prominent stat — for a property manager, "how many reviews need my
 * attention right now" is the single most important number on the screen.
 *
 * All values derive from the same `reviews` array the cards render, so they
 * stay consistent without a separate fetch.
 */
export function SummaryStats({ reviews }: SummaryStatsProps) {
  const stats = computeStats(reviews);

  return (
    <section
      aria-label="Review summary"
      className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4"
    >
      <Stat label="Total reviews" value={stats.total} />
      <Stat
        label="Average rating"
        value={
          stats.averageRating === null
            ? "—"
            : `${stats.averageRating.toFixed(1)} / 5`
        }
      />
      <Stat
        label="Pending"
        value={stats.pending}
        tone={stats.pending > 0 ? "attention" : "neutral"}
        emphasis
      />
      <Stat
        label="Flagged"
        value={stats.flagged}
        tone={stats.flagged > 0 ? "warning" : "neutral"}
      />
    </section>
  );
}

interface ReviewStatsAggregate {
  total: number;
  averageRating: number | null;
  pending: number;
  flagged: number;
}

function computeStats(reviews: readonly Review[]): ReviewStatsAggregate {
  if (reviews.length === 0) {
    return { total: 0, averageRating: null, pending: 0, flagged: 0 };
  }

  let ratingSum = 0;
  let pending = 0;
  let flagged = 0;

  for (const r of reviews) {
    ratingSum += r.rating;
    if (r.status === "pending") pending++;
    else if (r.status === "flagged") flagged++;
  }

  return {
    total: reviews.length,
    averageRating: ratingSum / reviews.length,
    pending,
    flagged,
  };
}

// ---- stat cell -------------------------------------------------------------

type StatTone = "neutral" | "attention" | "warning";

interface StatProps {
  label: string;
  value: number | string;
  tone?: StatTone;
  /** When true, render with a slightly larger value font for visual weight. */
  emphasis?: boolean;
}

function Stat({ label, value, tone = "neutral", emphasis = false }: StatProps) {
  return (
    <div
      className={`rounded-lg border px-4 py-3 ${TONE_STYLES[tone]}`}
    >
      <p className="text-xs font-medium uppercase tracking-wide opacity-70">
        {label}
      </p>
      <p
        className={`mt-1 font-semibold tabular-nums ${
          emphasis ? "text-2xl" : "text-xl"
        }`}
      >
        {value}
      </p>
    </div>
  );
}

const TONE_STYLES = {
  neutral: "border-zinc-200 bg-white text-zinc-900",
  attention: "border-amber-200 bg-amber-50 text-amber-900",
  warning: "border-rose-200 bg-rose-50 text-rose-900",
} as const satisfies Record<StatTone, string>;
