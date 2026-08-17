import { pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";

export const inviteTargetsTable = pgTable("invite_targets", {
  id: serial("id").primaryKey(),
  guildId: text("guild_id").notNull().unique(),
  label: text("label"),
  addedAt: timestamp("added_at", { withTimezone: true }).notNull().defaultNow(),
});

export type InviteTarget = typeof inviteTargetsTable.$inferSelect;
