/**
 * One-shot DB bootstrap: apply migrations, then seed if the table is empty.
 *
 * Wired into `predev`, `prebuild`, and `pretest` so cloning the repo and
 * running any of those commands "just works" — no manual migrate/seed step.
 * Idempotent: running it twice is a no-op once the seed has been inserted.
 */
import { migrate } from "drizzle-orm/libsql/migrator";
import { db, schema } from "../app/lib/db/client";
import { seedReviews } from "../app/lib/db/seed-data";

async function main() {
  await migrate(db, { migrationsFolder: "./drizzle" });

  const existing = await db.select({ id: schema.reviews.id }).from(schema.reviews).limit(1);
  if (existing.length > 0) {
    console.log("[db] seed skipped — reviews table already populated");
    return;
  }

  await db.insert(schema.reviews).values(seedReviews);
  console.log(`[db] seeded ${seedReviews.length} reviews`);
}

main().catch((err) => {
  console.error("[db] setup failed:", err);
  process.exit(1);
});
