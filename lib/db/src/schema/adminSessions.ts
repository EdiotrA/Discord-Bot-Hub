import { pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

export const adminSessionsTable = pgTable("admin_sessions", {
  token: uuid("token").primaryKey().defaultRandom(),
  discordUserId: text("discord_user_id").notNull(),
  username: text("username").notNull(),
  avatarUrl: text("avatar_url"),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type AdminSession = typeof adminSessionsTable.$inferSelect;
