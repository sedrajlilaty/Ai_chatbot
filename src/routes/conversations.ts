import { Hono } from "hono";
import { ZodError } from "zod";
import type { AppEnv } from "../env";
import { ApiError, fromZod, jsonError } from "../lib/errors";
import { conversationIdParam } from "../lib/validation";
import { requireAuth } from "../middleware/auth";
import { deleteConversation, getConversation, listConversations, listMessages } from "../db/queries";

export const conversationRoutes = new Hono<AppEnv>();

conversationRoutes.use("*", requireAuth);

conversationRoutes.get("/", async (c) => {
  const rows = await listConversations(c.env.DB, c.get("userId"));
  return c.json({
    conversations: rows.map((row) => ({
      id: row.id,
      title: row.title,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    })),
  });
});

conversationRoutes.get("/:id/messages", async (c) => {
  try {
    const { id } = conversationIdParam.parse({ id: c.req.param("id") });
    const conversation = await getConversation(c.env.DB, id, c.get("userId"));
    if (!conversation) {
      throw new ApiError(404, "NOT_FOUND", "Conversation not found");
    }
    const messages = await listMessages(c.env.DB, id);
    return c.json({
      conversation: {
        id: conversation.id,
        title: conversation.title,
        createdAt: conversation.created_at,
        updatedAt: conversation.updated_at,
      },
      messages: messages.map((m) => ({
        id: m.id,
        role: m.role,
        content: m.content,
        createdAt: m.created_at,
      })),
    });
  } catch (err) {
    return handleError(c, err);
  }
});

conversationRoutes.delete("/:id", async (c) => {
  try {
    const { id } = conversationIdParam.parse({ id: c.req.param("id") });
    const deleted = await deleteConversation(c.env.DB, id, c.get("userId"));
    if (!deleted) {
      throw new ApiError(404, "NOT_FOUND", "Conversation not found");
    }
    return c.json({ ok: true });
  } catch (err) {
    return handleError(c, err);
  }
});

function handleError(c: Parameters<typeof jsonError>[0], err: unknown) {
  if (err instanceof ZodError) {
    const apiErr = fromZod(err);
    return jsonError(c, apiErr.status, apiErr.code, apiErr.message, apiErr.details);
  }
  if (err instanceof ApiError) {
    return jsonError(c, err.status, err.code, err.message, err.details);
  }
  console.error(err);
  return jsonError(c, 500, "INTERNAL_ERROR", "Something went wrong");
}
