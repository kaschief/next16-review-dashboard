import {
  REVIEW_STATUSES,
  type Review,
  type ReviewStatus,
} from "@/app/types/review";

export type MaxRating = 1 | 2 | 3 | 4 | 5;

export type SortOption =
  | "date-desc"
  | "date-asc"
  | "rating-desc"
  | "rating-asc";

export const SORT_OPTIONS: readonly SortOption[] = [
  "date-desc",
  "date-asc",
  "rating-desc",
  "rating-asc",
] as const;

export const SORT_LABEL = {
  "date-desc": "Newest first",
  "date-asc": "Oldest first",
  "rating-desc": "Highest rating",
  "rating-asc": "Lowest rating",
} as const satisfies Record<SortOption, string>;

export const DEFAULT_SORT: SortOption = "date-desc";

export interface ReviewFilters {
  status: ReviewStatus | "all";
  maxRating: MaxRating | "all";
  city: string | "all";
  search: string;
  sort: SortOption;
}

export const DEFAULT_FILTERS: ReviewFilters = {
  status: "all",
  maxRating: "all",
  city: "all",
  search: "",
  sort: DEFAULT_SORT,
};

// URL query keys — single source of truth so client and server agree.
export const FILTER_KEYS = {
  status: "status",
  maxRating: "rating",
  city: "city",
  search: "q",
  sort: "sort",
} as const;

export function parseFilters(
  search: Record<string, string | string[] | undefined>,
): ReviewFilters {
  const status = pickFirst(search[FILTER_KEYS.status]);
  const rating = pickFirst(search[FILTER_KEYS.maxRating]);
  const city = pickFirst(search[FILTER_KEYS.city]);
  const query = pickFirst(search[FILTER_KEYS.search]);
  const sort = pickFirst(search[FILTER_KEYS.sort]);

  return {
    status:
      status && (REVIEW_STATUSES as readonly string[]).includes(status)
        ? (status as ReviewStatus)
        : "all",
    maxRating: parseMaxRating(rating),
    city: city && city.length > 0 ? city : "all",
    search: query?.trim() ?? "",
    sort: parseSort(sort),
  };
}

export function applyFilters(
  reviews: readonly Review[],
  filters: ReviewFilters,
): Review[] {
  const needle = filters.search.toLowerCase();
  const filtered = reviews.filter((r) => {
    if (filters.status !== "all" && r.status !== filters.status) return false;
    if (filters.maxRating !== "all" && r.rating > filters.maxRating) {
      return false;
    }
    if (filters.city !== "all" && r.city !== filters.city) return false;
    if (
      needle.length > 0 &&
      !`${r.text} ${r.guestName} ${r.propertyName}`
        .toLowerCase()
        .includes(needle)
    ) {
      return false;
    }
    return true;
  });

  return sortReviews(filtered, filters.sort);
}

function sortReviews(reviews: Review[], sort: SortOption): Review[] {
  // .sort mutates; we already have a fresh filtered array so this is safe.
  switch (sort) {
    case "date-desc":
      return reviews.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    case "date-asc":
      return reviews.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    case "rating-desc":
      return reviews.sort((a, b) => b.rating - a.rating);
    case "rating-asc":
      return reviews.sort((a, b) => a.rating - b.rating);
  }
}

// ---- helpers ---------------------------------------------------------------

function pickFirst(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function parseMaxRating(value: string | undefined): MaxRating | "all" {
  if (!value) return "all";
  const n = Number(value);
  if (n === 1 || n === 2 || n === 3 || n === 4 || n === 5) return n;
  return "all";
}

function parseSort(value: string | undefined): SortOption {
  return value && (SORT_OPTIONS as readonly string[]).includes(value)
    ? (value as SortOption)
    : DEFAULT_SORT;
}
