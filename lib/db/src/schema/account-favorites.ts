import { createInsertSchema } from "drizzle-zod";
import { pgTable, serial, text, timestamp, unique } from "drizzle-orm/pg-core";
import { z } from "zod/v4";

export const accountFavoritesTable = pgTable(
  "account_favorites",
  {
    id: serial("id").primaryKey(),
    userId: text("user_id").notNull(),
    productId: text("product_id").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [unique("account_favorites_user_product_unique").on(table.userId, table.productId)],
);

export const insertAccountFavoriteSchema = createInsertSchema(
  accountFavoritesTable,
).omit({ id: true, createdAt: true });
export type InsertAccountFavorite = z.infer<typeof insertAccountFavoriteSchema>;
export type AccountFavorite = typeof accountFavoritesTable.$inferSelect;
