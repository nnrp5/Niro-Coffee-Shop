import { createInsertSchema } from "drizzle-zod";
import { integer, pgTable, serial, text, timestamp, unique } from "drizzle-orm/pg-core";
import { z } from "zod/v4";

export const customerLoyaltyTable = pgTable(
  "customer_loyalty",
  {
    id: serial("id").primaryKey(),
    userId: text("user_id").notNull(),
    orderNumber: text("order_number").notNull(),
    kind: text("kind").notNull().default("earned"),
    points: integer("points").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [unique("customer_loyalty_user_order_kind_unique").on(table.userId, table.orderNumber, table.kind)],
);

export const insertCustomerLoyaltySchema = createInsertSchema(
  customerLoyaltyTable,
).omit({ id: true, createdAt: true });
export type InsertCustomerLoyalty = z.infer<typeof insertCustomerLoyaltySchema>;
export type CustomerLoyaltyEntry = typeof customerLoyaltyTable.$inferSelect;
