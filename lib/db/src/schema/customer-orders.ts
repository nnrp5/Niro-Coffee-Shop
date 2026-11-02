import { createInsertSchema } from "drizzle-zod";
import { integer, jsonb, numeric, pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";
import { z } from "zod/v4";

export const customerOrdersTable = pgTable("customer_orders", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull(),
  orderNumber: text("order_number").notNull().unique(),
  status: text("status").notNull().default("order_placed"),
  placedAt: timestamp("placed_at", { withTimezone: true }).notNull().defaultNow(),
  total: numeric("total", { precision: 10, scale: 3, mode: "number" }).notNull().default(0),
  currency: text("currency").notNull().default("KWD"),
  trackingNumber: text("tracking_number"),
  itemsSummary: jsonb("items_summary").$type<string[]>().notNull().default([]),
});

export const insertCustomerOrderSchema = createInsertSchema(
  customerOrdersTable,
).omit({ id: true, placedAt: true });
export type InsertCustomerOrder = z.infer<typeof insertCustomerOrderSchema>;
export type CustomerOrder = typeof customerOrdersTable.$inferSelect;
