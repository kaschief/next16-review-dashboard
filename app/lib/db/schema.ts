import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import type {
  ChannelSource,
  Review,
  ReviewStatus,
} from "@/app/types/review";

/**
 * Reviews table.
 *
 * Schema mirrors the public `Review` type. Enum-like columns (`status`,
 * `channelSource`, `rating`) are typed via `$type<>()` so Drizzle hands us
 * the union, not raw `string` / `number`. Runtime validation still lives at
 * the boundary (the PATCH route and the server action) — the DB doesn't
 * enforce union membership, the application layer does.
 *
 * `createdAt` is stored as an ISO-8601 TEXT column to keep the JSON wire
 * format identical to the original in-memory shape — no client-side
 * date-parsing changes when we swapped storage.
 */
export const reviews = sqliteTable("reviews", {
  id: integer("id").primaryKey(),
  guestName: text("guest_name").notNull(),
  guestAvatar: text("guest_avatar").notNull(),
  propertyName: text("property_name").notNull(),
  city: text("city").notNull(),
  channelSource: text("channel_source").$type<ChannelSource>().notNull(),
  rating: integer("rating").$type<Review["rating"]>().notNull(),
  text: text("text").notNull(),
  status: text("status").$type<ReviewStatus>().notNull(),
  createdAt: text("created_at").notNull(),
  response: text("response"),
});

export type ReviewRow = typeof reviews.$inferSelect;
export type NewReviewRow = typeof reviews.$inferInsert;
