import type { ReviewFilters } from "@/app/lib/filters";

interface EmptyStateProps {
  filters: ReviewFilters;
  totalReviews: number;
}

/**
 * Context-aware empty state. The copy explicitly addresses what the operator
 * filtered for — "no flagged reviews" is good news, "no pending reviews" is
 * great news, "no matches" with multiple filters is suggesting they clear one.
 */
export function EmptyState({ filters, totalReviews }: EmptyStateProps) {
  const { title, body, tone } = pickCopy(filters, totalReviews);

  return (
    <div
      role="status"
      className={`rounded-lg border border-dashed px-6 py-12 text-center ${TONE_STYLES[tone]}`}
    >
      <p className="text-sm font-medium">{title}</p>
      <p className="mt-1 text-sm opacity-80">{body}</p>
    </div>
  );
}

type Tone = "positive" | "neutral" | "informational";

const TONE_STYLES = {
  positive: "border-emerald-200 bg-emerald-50 text-emerald-900",
  informational: "border-zinc-200 bg-white text-zinc-900",
  neutral: "border-zinc-300 bg-zinc-50 text-zinc-900",
} as const satisfies Record<Tone, string>;

function pickCopy(
  filters: ReviewFilters,
  totalReviews: number,
): { title: string; body: string; tone: Tone } {
  // Dataset is empty — likely the API returned nothing, not a filter issue.
  if (totalReviews === 0) {
    return {
      title: "No reviews yet",
      body: "Reviews will appear here as guests submit them.",
      tone: "informational",
    };
  }

  // Single-dimension filter "successes" — operator filtered for something
  // negative and there's nothing. That's a positive product signal.
  if (filters.status === "flagged" && isStatusOnlyFilter(filters)) {
    return {
      title: "No flagged reviews — nice work.",
      body: "Nothing has been escalated to operations.",
      tone: "positive",
    };
  }
  if (filters.status === "pending" && isStatusOnlyFilter(filters)) {
    return {
      title: "Inbox zero on pending reviews.",
      body: "Every review has been triaged. Great job.",
      tone: "positive",
    };
  }
  if (filters.maxRating !== "all" && isRatingOnlyFilter(filters)) {
    return {
      title: "No low-rated reviews match.",
      body: `Nothing at ${filters.maxRating} ${filters.maxRating === 1 ? "star" : "stars"} or below in this dataset.`,
      tone: "positive",
    };
  }

  // Multi-dimension filter with no matches — the operator probably over-
  // constrained. Nudge them to relax a filter.
  return {
    title: "No reviews match these filters.",
    body: "Try clearing one of the filters above to widen the results.",
    tone: "neutral",
  };
}

function isStatusOnlyFilter(filters: ReviewFilters): boolean {
  return filters.maxRating === "all" && filters.city === "all";
}

function isRatingOnlyFilter(filters: ReviewFilters): boolean {
  return filters.status === "all" && filters.city === "all";
}
