export type ReviewStatus = "pending" | "approved" | "flagged";

export type ChannelSource = "airbnb" | "booking.com" | "direct";

export interface Review {
  id: number;
  guestName: string;
  guestAvatar: string;
  propertyName: string;
  city: string;
  channelSource: ChannelSource;
  rating: 1 | 2 | 3 | 4 | 5;
  text: string;
  status: ReviewStatus;
  createdAt: string;
  response: string | null;
}

export interface ApiSuccess<T> {
  status: "success";
  result: T;
}

export interface ApiError {
  status: "error";
  message: string;
}

export type ApiResponse<T> = ApiSuccess<T> | ApiError;

// ---- display tokens (co-located with the union they describe) --------------

export const STATUS_LABEL = {
  pending: "Pending",
  approved: "Approved",
  flagged: "Flagged",
} as const satisfies Record<ReviewStatus, string>;

export const REVIEW_STATUSES: readonly ReviewStatus[] = [
  "pending",
  "approved",
  "flagged",
] as const;
