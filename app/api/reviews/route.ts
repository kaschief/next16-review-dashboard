import { NextResponse } from "next/server";
import { getReviews } from "@/app/lib/reviews";

export async function GET() {
  const reviews = await getReviews();
  return NextResponse.json({ status: "success", result: reviews });
}
