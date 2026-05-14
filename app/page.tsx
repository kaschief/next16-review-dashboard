import { EmptyState } from "@/app/components/empty-state";
import { Filters } from "@/app/components/filters";
import { ReviewCard } from "@/app/components/review-card";
import { SummaryStats } from "@/app/components/summary-stats";
import { applyFilters, parseFilters } from "@/app/lib/filters";
import { getReviews } from "@/app/lib/reviews";

interface HomeProps {
  // In Next 16, route-level searchParams arrive as a Promise.
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function Home({ searchParams }: HomeProps) {
  const [reviews, rawSearch] = await Promise.all([
    getReviews(),
    searchParams,
  ]);

  const filters = parseFilters(rawSearch);
  const visible = applyFilters(reviews, filters);

  // Cities come from the full dataset, not the filtered view — otherwise the
  // city dropdown would shrink as you filter, which is confusing UX.
  const cities = Array.from(new Set(reviews.map((r) => r.city))).sort();

  return (
    <main className="mx-auto w-full max-w-4xl px-6 py-12">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">
          Guest Reviews
        </h1>
        <p className="text-sm text-zinc-500">
          Showing {visible.length} of {reviews.length} reviews
        </p>
      </header>

      {/* Stats reflect the FULL dataset, not the filtered view — managers need
          to know absolute counts ("8 pending across the portfolio"), not "8
          pending matching whatever I happened to filter for". */}
      <SummaryStats reviews={reviews} />

      <Filters cities={cities} current={filters} />

      {visible.length === 0 ? (
        <EmptyState filters={filters} totalReviews={reviews.length} />
      ) : (
        <ul className="space-y-3">
          {visible.map((review) => (
            <li key={review.id}>
              <ReviewCard review={review} />
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
