import { z } from "zod";

export const registerSchema = z.object({
  email: z.string().trim().email().max(254).transform((v) => v.toLowerCase()),
  password: z.string().min(8, "Password must be at least 8 characters").max(128),
});

export const loginSchema = z.object({
  email: z.string().trim().email().max(254).transform((v) => v.toLowerCase()),
  password: z.string().min(1).max(128),
});

export const chatSchema = z.object({
  conversationId: z.string().uuid().optional().nullable(),
  message: z.string().trim().min(1, "Message is required").max(8000),
});

export const conversationIdParam = z.object({
  id: z.string().uuid(),
});
