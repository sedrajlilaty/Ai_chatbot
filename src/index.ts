import { Hono } from "hono";
import type { AppEnv } from "./env";
import { jsonError } from "./lib/errors";
import { authRoutes } from "./routes/auth";
import { chatRoutes } from "./routes/chat";
import { conversationRoutes } from "./routes/conversations";

const app = new Hono<AppEnv>();

app.onError((err, c) => {
  console.error(err);
  return jsonError(c, 500, "INTERNAL_ERROR", "Something went wrong");
});

app.notFound((c) => jsonError(c, 404, "NOT_FOUND", "Route not found"));

app.get("/api/health", (c) => c.json({ ok: true }));

app.route("/api/auth", authRoutes);
app.route("/api/chat", chatRoutes);
app.route("/api/conversations", conversationRoutes);

export default app;
