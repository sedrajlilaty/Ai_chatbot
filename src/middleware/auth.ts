import { createMiddleware } from "hono/factory";
import { getCookie } from "hono/cookie";
import type { AppEnv } from "../env";
import { SESSION_COOKIE } from "../env";
import { jsonError } from "../lib/errors";
import { findUserById } from "../db/queries";

type SessionRecord = { userId: string };

export const requireAuth = createMiddleware<AppEnv>(async (c, next) => {
  const token = getCookie(c, SESSION_COOKIE);
  if (!token) {
    return jsonError(c, 401, "UNAUTHORIZED", "Authentication required");
  }

  const raw = await c.env.SESSIONS.get(`session:${token}`);
  if (!raw) {
    return jsonError(c, 401, "UNAUTHORIZED", "Invalid or expired session");
  }

  let session: SessionRecord;
  try {
    session = JSON.parse(raw) as SessionRecord;
  } catch {
    return jsonError(c, 401, "UNAUTHORIZED", "Invalid session");
  }

  const user = await findUserById(c.env.DB, session.userId);
  if (!user) {
    await c.env.SESSIONS.delete(`session:${token}`);
    return jsonError(c, 401, "UNAUTHORIZED", "Invalid session");
  }

  c.set("userId", user.id);
  c.set("userEmail", user.email);
  await next();
});
