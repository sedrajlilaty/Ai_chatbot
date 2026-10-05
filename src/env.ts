export type AppEnv = {
  Bindings: Env;
  Variables: {
    userId: string;
    userEmail: string;
  };
};

export const SESSION_COOKIE = "session";
export const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7;
export const RATE_LIMIT_PER_MINUTE = 20;
export const LLM_MODEL = "@cf/meta/infire-llama-3.1-8b-instruct";
export const SYSTEM_PROMPT =
  "You are a helpful, concise assistant. Answer clearly. If you are unsure, say so. Do not invent facts.";
