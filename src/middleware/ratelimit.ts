import { createMiddleware } from "hono/factory";
import type { AppEnv } from "../env";
import { RATE_LIMIT_PER_MINUTE } from "../env";
import { jsonError } from "../lib/errors";

export const rateLimitMessages = createMiddleware<AppEnv>(async (c, next) => {
  const userId = c.get("userId");
  const window = Math.floor(Date.now() / 60_000);
  const key = `ratelimit:${userId}:${window}`;
  const current = Number.parseInt((await c.env.SESSIONS.get(key)) ?? "0", 10);

  if (current >= RATE_LIMIT_PER_MINUTE) {
    return jsonError(
      c,
      429,
      "RATE_LIMITED",
      `Too many messages. Limit is ${RATE_LIMIT_PER_MINUTE} per minute.`,
    );
  }

  await c.env.SESSIONS.put(key, String(current + 1), { expirationTtl: 120 });
  await next();
});
