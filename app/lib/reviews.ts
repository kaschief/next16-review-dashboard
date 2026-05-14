import { desc, eq } from "drizzle-orm";
import { db, schema } from "@/app/lib/db/client";
import type { Review, ReviewStatus } from "@/app/types/review";

/**
 * Server-side read of the reviews collection.
 *
 * Reads the database directly — no self-fetch through the local API route.
 * (The /api/reviews route still exists for external HTTP callers; it now
 * delegates to this function.) Ordered newest-first so default rendering
 * matches the default `date-desc` sort.
 */
export async function getReviews(): Promise<Review[]> {
  return db.select().from(schema.reviews).orderBy(desc(schema.reviews.createdAt));
}

export class ReviewNotFoundError extends Error {
  constructor(id: number) {
    super(`Review ${id} not found`);
    this.name = "ReviewNotFoundError";
  }
}

/**
 * Mutate a review's status.
 *
 * Single source of truth for status writes — called by both the PATCH route
 * handler (external HTTP) and the `updateReviewStatus` server action
 * (dashboard UI). Validation of the status union lives at the callers
 * (HTTP body validation / typed action arg), since each has its own error
 * channel.
 */
export async function mutateReviewStatus(
  id: number,
  nextStatus: ReviewStatus,
): Promise<Review> {
  const [updated] = await db
    .update(schema.reviews)
    .set({ status: nextStatus })
    .where(eq(schema.reviews.id, id))
    .returning();

  if (!updated) throw new ReviewNotFoundError(id);
  return updated;
}
