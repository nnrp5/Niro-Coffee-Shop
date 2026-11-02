import { createInsertSchema } from "drizzle-zod";
import { pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { z } from "zod/v4";

export const accountProfilesTable = pgTable("account_profiles", {
  userId: text("user_id").primaryKey(),
  fullName: text("full_name").notNull().default(""),
  phone: text("phone"),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export const insertAccountProfileSchema = createInsertSchema(
  accountProfilesTable,
).omit({ updatedAt: true });
export type InsertAccountProfile = z.infer<typeof insertAccountProfileSchema>;
export type AccountProfile = typeof accountProfilesTable.$inferSelect;
