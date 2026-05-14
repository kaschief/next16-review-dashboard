"use server";

import { revalidatePath } from "next/cache";
import { mutateReviewStatus } from "@/app/lib/reviews";
import type { Review, ReviewStatus } from "@/app/types/review";

export type UpdateReviewStatusResult =
  | { ok: true; review: Review }
  | { ok: false; error: string };

/**
 * Update a review's status from the dashboard.
 *
 * Returns a discriminated union instead of throwing — server actions cross
 * the network boundary, and a typed result is easier to handle on the
 * client than a generic Error.
 */
/**
 * Simulated network latency for local development. The in-memory mutation
 * is otherwise sub-millisecond, which makes optimistic loading states
 * invisible and the UX feel weirdly instant. Production removes this.
 */
const SIMULATED_LATENCY_MS = process.env.NODE_ENV === "production" ? 0 : 400;

export async function updateReviewStatus(
  id: number,
  status: ReviewStatus,
): Promise<UpdateReviewStatusResult> {
  if (SIMULATED_LATENCY_MS > 0) {
    await new Promise((resolve) => setTimeout(resolve, SIMULATED_LATENCY_MS));
  }

  try {
    const review = await mutateReviewStatus(id, status);
    // Revalidate so any other RSC consumers (filters, summary stats) see
    // the new state on next navigation/refresh.
    revalidatePath("/");
    return { ok: true, review };
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Unknown server error";
    return { ok: false, error: message };
  }
}
