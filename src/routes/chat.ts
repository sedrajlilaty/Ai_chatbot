import { Hono } from "hono";
import { ZodError } from "zod";
import type { AppEnv } from "../env";
import { LLM_MODEL, SYSTEM_PROMPT } from "../env";
import { ApiError, fromZod, jsonError } from "../lib/errors";
import { sseEvent } from "../lib/sse";
import { chatSchema } from "../lib/validation";
import { requireAuth } from "../middleware/auth";
import { rateLimitMessages } from "../middleware/ratelimit";
import {
  getConversation,
  insertConversation,
  insertMessage,
  listRecentMessages,
  titleFromMessage,
  touchConversation,
} from "../db/queries";

export const chatRoutes = new Hono<AppEnv>();

chatRoutes.use("*", requireAuth, rateLimitMessages);

chatRoutes.post("/", async (c) => {
  try {
    const body = chatSchema.parse(await c.req.json());
    const userId = c.get("userId");

    let conversationId = body.conversationId ?? undefined;
    if (conversationId) {
      const existing = await getConversation(c.env.DB, conversationId, userId);
      if (!existing) {
        throw new ApiError(404, "NOT_FOUND", "Conversation not found");
      }
    } else {
      conversationId = crypto.randomUUID();
      await insertConversation(c.env.DB, {
        id: conversationId,
        userId,
        title: titleFromMessage(body.message),
      });
    }

    const userMessageId = crypto.randomUUID();
    await insertMessage(c.env.DB, {
      id: userMessageId,
      conversationId,
      role: "user",
      content: body.message,
    });
    await touchConversation(c.env.DB, conversationId);

    const history = await listRecentMessages(c.env.DB, conversationId, 20);
    const messages = [
      { role: "system" as const, content: SYSTEM_PROMPT },
      ...history.map((m) => ({ role: m.role, content: m.content })),
    ];

    const aiStream = (await c.env.AI.run(LLM_MODEL, {
      messages,
      stream: true,
    })) as unknown as ReadableStream<Uint8Array>;
    const encoder = new TextEncoder();
    const decoder = new TextDecoder();
    const assistantMessageId = crypto.randomUUID();
    const db = c.env.DB;
    const savedConversationId = conversationId;

    let fullText = "";
    let sseBuffer = "";

    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        controller.enqueue(
          encoder.encode(
            sseEvent({
              type: "meta",
              conversationId: savedConversationId,
              userMessageId,
              assistantMessageId,
            }),
          ),
        );

        const reader = aiStream.getReader();
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            sseBuffer += decoder.decode(value, { stream: true });
            const parts = sseBuffer.split("\n");
            sseBuffer = parts.pop() ?? "";

            for (const raw of parts) {
              const line = raw.trim();
              if (!line.startsWith("data:")) continue;
              const payload = line.slice(5).trim();
              if (!payload || payload === "[DONE]") continue;
              try {
                const parsed = JSON.parse(payload) as { response?: string };
                if (typeof parsed.response === "string" && parsed.response.length > 0) {
                  fullText += parsed.response;
                  controller.enqueue(encoder.encode(sseEvent({ type: "delta", text: parsed.response })));
                }
              } catch {
                // skip malformed line
              }
            }
          }

          if (fullText.trim().length > 0) {
            await insertMessage(db, {
              id: assistantMessageId,
              conversationId: savedConversationId,
              role: "assistant",
              content: fullText,
            });
            await touchConversation(db, savedConversationId);
          }

          controller.enqueue(
            encoder.encode(
              sseEvent({
                type: "done",
                conversationId: savedConversationId,
                assistantMessageId,
                content: fullText,
              }),
            ),
          );
          controller.close();
        } catch (err) {
          console.error(err);
          controller.enqueue(
            encoder.encode(sseEvent({ type: "error", message: "Failed to generate a response" })),
          );
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
        "X-Conversation-Id": savedConversationId,
      },
    });
  } catch (err) {
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
});
