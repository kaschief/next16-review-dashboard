"use client";

import { useEffect } from "react";

/**
 * Route-level error boundary. Renders when `getReviews()` (or anything else
 * during the page's RSC render) throws. Keeps the operator on the page
 * instead of showing the Next default crash screen.
 */
export default function PageError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // In production this would forward to Sentry / DataDog. Console for now.
    console.error("Dashboard render failed:", error);
  }, [error]);

  return (
    <main className="mx-auto w-full max-w-4xl px-6 py-12">
      <div
        role="alert"
        className="rounded-lg border border-rose-200 bg-rose-50 px-6 py-12 text-center"
      >
        <h1 className="text-lg font-semibold text-rose-900">
          Couldn't load the dashboard
        </h1>
        <p className="mt-2 text-sm text-rose-800">
          The reviews service is unreachable. This is usually transient.
        </p>
        {error.digest && (
          <p className="mt-1 font-mono text-xs text-rose-700/70">
            Reference: {error.digest}
          </p>
        )}
        <button
          type="button"
          onClick={reset}
          className="mt-6 rounded-md bg-rose-900 px-4 py-2 text-sm font-medium text-white hover:bg-rose-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-900"
        >
          Try again
        </button>
      </div>
    </main>
  );
}
