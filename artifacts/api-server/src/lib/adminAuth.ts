import { type Request, type Response, type NextFunction } from "express";
import { eq, gt } from "drizzle-orm";
import { db, adminSessionsTable } from "@workspace/db";

export interface AuthedRequest extends Request {
  adminSession: {
    token: string;
    discordUserId: string;
    username: string;
    avatarUrl: string | null;
  };
}

/** Express middleware: verifies the admin_token cookie and attaches session to req. */
export async function requireAdmin(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const token = req.cookies?.admin_token as string | undefined;
  if (!token) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  const [session] = await db
    .select()
    .from(adminSessionsTable)
    .where(eq(adminSessionsTable.token, token));

  if (!session || session.expiresAt < new Date()) {
    if (session) {
      // Clean up expired session
      await db.delete(adminSessionsTable).where(eq(adminSessionsTable.token, token));
    }
    res.clearCookie("admin_token");
    res.status(401).json({ error: "Session expired" });
    return;
  }

  (req as AuthedRequest).adminSession = {
    token: session.token,
    discordUserId: session.discordUserId,
    username: session.username,
    avatarUrl: session.avatarUrl ?? null,
  };
  next();
}

/** Create a new admin session and return the token. */
export async function createSession(opts: {
  discordUserId: string;
  username: string;
  avatarUrl: string | null;
}): Promise<string> {
  // Session lasts 7 days
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

  const [row] = await db
    .insert(adminSessionsTable)
    .values({
      discordUserId: opts.discordUserId,
      username: opts.username,
      avatarUrl: opts.avatarUrl,
      expiresAt,
    })
    .returning({ token: adminSessionsTable.token });

  return row.token;
}

/** Destroy a session by token. */
export async function destroySession(token: string): Promise<void> {
  await db.delete(adminSessionsTable).where(eq(adminSessionsTable.token, token));
}
