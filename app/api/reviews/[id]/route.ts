import { NextResponse } from "next/server";
import {
  ReviewNotFoundError,
  mutateReviewStatus,
} from "@/app/lib/reviews";
import type { ReviewStatus } from "@/app/types/review";

const ALLOWED_STATUSES: ReadonlySet<ReviewStatus> = new Set([
  "pending",
  "approved",
  "flagged",
]);

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const reviewId = Number(id);

  if (!Number.isFinite(reviewId)) {
    return NextResponse.json(
      { status: "error", message: "Invalid review id" },
      { status: 400 },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { status: "error", message: "Invalid JSON body" },
      { status: 400 },
    );
  }

  const nextStatus =
    typeof body === "object" && body !== null && "status" in body
      ? (body as { status: unknown }).status
      : undefined;

  if (
    typeof nextStatus !== "string" ||
    !ALLOWED_STATUSES.has(nextStatus as ReviewStatus)
  ) {
    return NextResponse.json(
      {
        status: "error",
        message: "Body must include status: pending | approved | flagged",
      },
      { status: 400 },
    );
  }

  try {
    const updated = await mutateReviewStatus(reviewId, nextStatus as ReviewStatus);
    return NextResponse.json({ status: "success", result: updated });
  } catch (err) {
    if (err instanceof ReviewNotFoundError) {
      return NextResponse.json(
        { status: "error", message: err.message },
        { status: 404 },
      );
    }
    throw err;
  }
}
