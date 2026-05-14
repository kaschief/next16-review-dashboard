"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import {
  DEFAULT_SORT,
  FILTER_KEYS,
  SORT_LABEL,
  SORT_OPTIONS,
  type MaxRating,
  type ReviewFilters,
  type SortOption,
} from "@/app/lib/filters";
import { REVIEW_STATUSES, STATUS_LABEL } from "@/app/types/review";

interface FiltersProps {
  cities: readonly string[];
  /** Current parsed filters, passed from the server so SSR + first paint agree. */
  current: ReviewFilters;
}

const MAX_RATING_OPTIONS: readonly { value: MaxRating; label: string }[] = [
  { value: 1, label: "1 star only" },
  { value: 2, label: "2 stars or below" },
  { value: 3, label: "3 stars or below" },
  { value: 4, label: "4 stars or below" },
];

const SEARCH_DEBOUNCE_MS = 300;

export function Filters({ cities, current }: FiltersProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  // Local search state — input stays responsive on every keystroke, URL only
  // updates after the debounce window elapses without further typing.
  const [searchInput, setSearchInput] = useState(current.search);

  useEffect(() => {
    const trimmed = searchInput.trim();
    if (trimmed === current.search) return;
    const timer = setTimeout(() => {
      setFilter(FILTER_KEYS.search, trimmed);
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- setFilter is stable enough; we explicitly want this to fire on input change only
  }, [searchInput, current.search]);

  // Keep local state in sync if the URL changes externally (e.g. clear filters).
  useEffect(() => {
    setSearchInput(current.search);
  }, [current.search]);

  function setFilter(key: string, value: string | null) {
    const next = new URLSearchParams(searchParams.toString());
    if (value === null || value === "all" || value === "" || value === DEFAULT_SORT) {
      next.delete(key);
    } else {
      next.set(key, value);
    }
    const queryString = next.toString();
    const href = queryString ? `${pathname}?${queryString}` : pathname;
    startTransition(() => {
      router.replace(href, { scroll: false });
    });
  }

  function clearAll() {
    setSearchInput("");
    startTransition(() => {
      router.replace(pathname, { scroll: false });
    });
  }

  const hasActiveFilter =
    current.status !== "all" ||
    current.maxRating !== "all" ||
    current.city !== "all" ||
    current.search.length > 0 ||
    current.sort !== DEFAULT_SORT;

  return (
    <section
      aria-label="Filter reviews"
      data-pending={isPending ? "" : undefined}
      className="mb-6 grid gap-3 rounded-lg border border-zinc-200 bg-white p-4 data-[pending]:opacity-60 sm:grid-cols-2 lg:flex lg:flex-wrap lg:items-end"
    >
      <FilterField label="Search">
        <input
          type="search"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          placeholder="Search reviews, guests, properties…"
          aria-label="Search reviews"
          className="w-full rounded-md border border-zinc-300 bg-white px-2 py-1.5 text-sm text-zinc-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-zinc-900 lg:w-64"
        />
      </FilterField>

      <FilterSelect
        label="Status"
        value={current.status}
        onChange={(v) => setFilter(FILTER_KEYS.status, v)}
        widthClass="lg:w-40"
      >
        <option value="all">All statuses</option>
        {REVIEW_STATUSES.map((s) => (
          <option key={s} value={s}>
            {STATUS_LABEL[s]}
          </option>
        ))}
      </FilterSelect>

      <FilterSelect
        label="Rating"
        value={String(current.maxRating)}
        onChange={(v) => setFilter(FILTER_KEYS.maxRating, v)}
        widthClass="lg:w-48"
      >
        <option value="all">All ratings</option>
        {MAX_RATING_OPTIONS.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </FilterSelect>

      <FilterSelect
        label="City"
        value={current.city}
        onChange={(v) => setFilter(FILTER_KEYS.city, v)}
        widthClass="lg:w-44"
      >
        <option value="all">All cities</option>
        {cities.map((c) => (
          <option key={c} value={c}>
            {c}
          </option>
        ))}
      </FilterSelect>

      <FilterSelect
        label="Sort"
        value={current.sort}
        onChange={(v) => setFilter(FILTER_KEYS.sort, v as SortOption)}
        widthClass="lg:w-44"
      >
        {SORT_OPTIONS.map((s) => (
          <option key={s} value={s}>
            {SORT_LABEL[s]}
          </option>
        ))}
      </FilterSelect>

      <button
        type="button"
        onClick={clearAll}
        disabled={!hasActiveFilter}
        className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm text-zinc-700 transition-opacity hover:bg-zinc-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-zinc-900 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent sm:col-span-2 lg:ml-auto lg:col-span-1"
      >
        Clear filters
      </button>
    </section>
  );
}

// ---- subcomponents ---------------------------------------------------------

interface FilterFieldProps {
  label: string;
  children: React.ReactNode;
  widthClass?: string;
}

function FilterField({ label, children, widthClass = "" }: FilterFieldProps) {
  return (
    <label
      className={`flex flex-col gap-1 text-xs font-medium text-zinc-600 ${widthClass}`}
    >
      {label}
      {children}
    </label>
  );
}

interface FilterSelectProps {
  label: string;
  value: string;
  onChange: (next: string) => void;
  children: React.ReactNode;
  /** Tailwind width class applied only at lg+ to fix horizontal layout. */
  widthClass: string;
}

function FilterSelect({
  label,
  value,
  onChange,
  children,
  widthClass,
}: FilterSelectProps) {
  return (
    <FilterField label={label} widthClass={widthClass}>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-md border border-zinc-300 bg-white px-2 py-1.5 text-sm text-zinc-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-zinc-900"
      >
        {children}
      </select>
    </FilterField>
  );
}
