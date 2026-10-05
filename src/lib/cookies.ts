import type { Context } from "hono";
import { deleteCookie, setCookie } from "hono/cookie";
import { SESSION_COOKIE, SESSION_TTL_SECONDS } from "../env";

function cookieOpts(c: Context) {
  const secure = new URL(c.req.url).protocol === "https:";
  return {
    httpOnly: true,
    secure,
    sameSite: "Lax" as const,
    path: "/",
  };
}

export function setSessionCookie(c: Context, token: string) {
  setCookie(c, SESSION_COOKIE, token, {
    ...cookieOpts(c),
    maxAge: SESSION_TTL_SECONDS,
  });
}

export function clearSessionCookie(c: Context) {
  deleteCookie(c, SESSION_COOKIE, cookieOpts(c));
}
