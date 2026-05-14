import { describe, it, expect } from "vitest";
import { applyFilters, parseFilters, DEFAULT_FILTERS } from "./filters";
import type { Review } from "@/app/types/review";

function makeReview(overrides: Partial<Review>): Review {
  return {
    id: 1,
    guestName: "Test Guest",
    guestAvatar: "",
    propertyName: "Test Property",
    city: "Berlin",
    channelSource: "airbnb",
    rating: 3,
    text: "Generic review text.",
    status: "pending",
    createdAt: "2026-05-10T00:00:00Z",
    response: null,
    ...overrides,
  };
}

const seed: Review[] = [
  makeReview({ id: 1, status: "pending", rating: 5, city: "Berlin" }),
  makeReview({ id: 2, status: "approved", rating: 4, city: "Paris" }),
  makeReview({ id: 3, status: "flagged", rating: 1, city: "Berlin" }),
  makeReview({ id: 4, status: "pending", rating: 2, city: "London" }),
];

describe("parseFilters", () => {
  it("returns defaults for empty input", () => {
    expect(parseFilters({})).toEqual(DEFAULT_FILTERS);
  });

  it("preserves valid values", () => {
    const result = parseFilters({
      status: "flagged",
      rating: "3",
      city: "Berlin",
      q: "  needle  ",
      sort: "rating-asc",
    });
    expect(result.status).toBe("flagged");
    expect(result.maxRating).toBe(3);
    expect(result.city).toBe("Berlin");
    expect(result.search).toBe("needle"); // trimmed
    expect(result.sort).toBe("rating-asc");
  });

  it("falls back gracefully on malformed input — never throws", () => {
    const result = parseFilters({
      status: "🦄",
      rating: "banana",
      sort: "invalid",
    });
    expect(result.status).toBe("all");
    expect(result.maxRating).toBe("all");
    expect(result.sort).toBe("date-desc");
  });

  it("picks the first value when params arrive as arrays", () => {
    const result = parseFilters({ status: ["approved", "pending"] });
    expect(result.status).toBe("approved");
  });
});

describe("applyFilters", () => {
  it("returns all reviews when no filters are active", () => {
    expect(applyFilters(seed, DEFAULT_FILTERS)).toHaveLength(4);
  });

  it("filters by status", () => {
    const result = applyFilters(seed, { ...DEFAULT_FILTERS, status: "pending" });
    expect(result.map((r) => r.id).sort()).toEqual([1, 4]);
  });

  it("filters by max rating (X stars or below)", () => {
    const result = applyFilters(seed, { ...DEFAULT_FILTERS, maxRating: 2 });
    expect(result.map((r) => r.id).sort()).toEqual([3, 4]);
  });

  it("filters by city", () => {
    const result = applyFilters(seed, { ...DEFAULT_FILTERS, city: "Berlin" });
    expect(result.map((r) => r.id).sort()).toEqual([1, 3]);
  });

  it("filters by text search across review, guest, and property", () => {
    const reviews = [
      makeReview({ id: 1, text: "Bedbugs in the room.", guestName: "Anna" }),
      makeReview({ id: 2, text: "Lovely stay.", guestName: "Bob" }),
      makeReview({ id: 3, propertyName: "Bedford Suite" }),
    ];
    const result = applyFilters(reviews, {
      ...DEFAULT_FILTERS,
      search: "bed",
    });
    expect(result.map((r) => r.id).sort()).toEqual([1, 3]);
  });

  it("combines filters with AND semantics", () => {
    const result = applyFilters(seed, {
      ...DEFAULT_FILTERS,
      status: "pending",
      city: "Berlin",
    });
    expect(result.map((r) => r.id)).toEqual([1]);
  });

  it("sorts by rating descending", () => {
    const result = applyFilters(seed, {
      ...DEFAULT_FILTERS,
      sort: "rating-desc",
    });
    expect(result.map((r) => r.rating)).toEqual([5, 4, 2, 1]);
  });

  it("sorts by rating ascending", () => {
    const result = applyFilters(seed, {
      ...DEFAULT_FILTERS,
      sort: "rating-asc",
    });
    expect(result.map((r) => r.rating)).toEqual([1, 2, 4, 5]);
  });

  it("sorts by date descending by default", () => {
    const reviews = [
      makeReview({ id: 1, createdAt: "2026-01-01T00:00:00Z" }),
      makeReview({ id: 2, createdAt: "2026-03-01T00:00:00Z" }),
      makeReview({ id: 3, createdAt: "2026-02-01T00:00:00Z" }),
    ];
    const result = applyFilters(reviews, DEFAULT_FILTERS);
    expect(result.map((r) => r.id)).toEqual([2, 3, 1]);
  });

  it("returns an empty array when nothing matches", () => {
    const result = applyFilters(seed, {
      ...DEFAULT_FILTERS,
      status: "flagged",
      city: "Paris",
    });
    expect(result).toEqual([]);
  });
});
