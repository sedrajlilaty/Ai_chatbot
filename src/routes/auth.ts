import { Hono } from "hono";
import { getCookie } from "hono/cookie";
import { ZodError } from "zod";
import type { AppEnv } from "../env";
import { SESSION_COOKIE, SESSION_TTL_SECONDS } from "../env";
import { hashPassword, randomToken, verifyPassword } from "../lib/crypto";
import { clearSessionCookie, setSessionCookie } from "../lib/cookies";
import { ApiError, fromZod, jsonError } from "../lib/errors";
import { loginSchema, registerSchema } from "../lib/validation";
import { findUserByEmail, findUserById, insertUser } from "../db/queries";

export const authRoutes = new Hono<AppEnv>();

authRoutes.post("/register", async (c) => {
  try {
    const body = registerSchema.parse(await c.req.json());
    const existing = await findUserByEmail(c.env.DB, body.email);
    if (existing) {
      throw new ApiError(409, "EMAIL_TAKEN", "An account with this email already exists");
    }

    const id = crypto.randomUUID();
    const { salt, hash } = await hashPassword(body.password);
    await insertUser(c.env.DB, {
      id,
      email: body.email,
      passwordHash: hash,
      passwordSalt: salt,
    });

    const token = randomToken();
    await c.env.SESSIONS.put(`session:${token}`, JSON.stringify({ userId: id }), {
      expirationTtl: SESSION_TTL_SECONDS,
    });
    setSessionCookie(c, token);

    return c.json({ user: { id, email: body.email } }, 201);
  } catch (err) {
    return handleAuthError(c, err);
  }
});

authRoutes.post("/login", async (c) => {
  try {
    const body = loginSchema.parse(await c.req.json());
    const user = await findUserByEmail(c.env.DB, body.email);
    if (!user) {
      throw new ApiError(401, "INVALID_CREDENTIALS", "Invalid email or password");
    }

    const ok = await verifyPassword(body.password, user.password_salt, user.password_hash);
    if (!ok) {
      throw new ApiError(401, "INVALID_CREDENTIALS", "Invalid email or password");
    }

    const token = randomToken();
    await c.env.SESSIONS.put(`session:${token}`, JSON.stringify({ userId: user.id }), {
      expirationTtl: SESSION_TTL_SECONDS,
    });
    setSessionCookie(c, token);

    return c.json({ user: { id: user.id, email: user.email } });
  } catch (err) {
    return handleAuthError(c, err);
  }
});

authRoutes.post("/logout", async (c) => {
  const token = getCookie(c, SESSION_COOKIE);
  if (token) {
    await c.env.SESSIONS.delete(`session:${token}`);
  }
  clearSessionCookie(c);
  return c.json({ ok: true });
});

authRoutes.get("/me", async (c) => {
  const token = getCookie(c, SESSION_COOKIE);
  if (!token) {
    return jsonError(c, 401, "UNAUTHORIZED", "Authentication required");
  }

  const raw = await c.env.SESSIONS.get(`session:${token}`);
  if (!raw) {
    return jsonError(c, 401, "UNAUTHORIZED", "Invalid or expired session");
  }

  let userId: string;
  try {
    userId = (JSON.parse(raw) as { userId: string }).userId;
  } catch {
    return jsonError(c, 401, "UNAUTHORIZED", "Invalid session");
  }

  const user = await findUserById(c.env.DB, userId);
  if (!user) {
    return jsonError(c, 401, "UNAUTHORIZED", "Invalid session");
  }

  return c.json({
    user: { id: user.id, email: user.email, createdAt: user.created_at },
  });
});

function handleAuthError(c: Parameters<typeof jsonError>[0], err: unknown) {
  if (err instanceof ZodError) {
    const apiErr = fromZod(err);
    return jsonError(c, apiErr.status, apiErr.code, apiErr.message, apiErr.details);
  }
  if (err instanceof ApiError) {
    return jsonError(c, err.status, err.code, err.message, err.details);
  }
  if (err instanceof SyntaxError) {
    return jsonError(c, 400, "INVALID_JSON", "Request body must be valid JSON");
  }
  console.error(err);
  return jsonError(c, 500, "INTERNAL_ERROR", "Something went wrong");
}
