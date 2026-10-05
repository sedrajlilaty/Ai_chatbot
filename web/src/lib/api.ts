export type User = {
  id: string;
  email: string;
  createdAt?: string;
};

export type Conversation = {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
};

export type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt?: string;
};

export type ApiError = {
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
};

async function parseJson<T>(res: Response): Promise<T> {
  const data = (await res.json()) as T | ApiError;
  if (!res.ok) {
    const err = data as ApiError;
    throw new Error(err.error?.message ?? `Request failed (${res.status})`);
  }
  return data as T;
}

export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
    ...init,
  });
  return parseJson<T>(res);
}

export function register(email: string, password: string) {
  return api<{ user: User }>("/api/auth/register", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
}

export function login(email: string, password: string) {
  return api<{ user: User }>("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
}

export function logout() {
  return api<{ ok: boolean }>("/api/auth/logout", { method: "POST" });
}

export function me() {
  return api<{ user: User }>("/api/auth/me");
}

export function listConversations() {
  return api<{ conversations: Conversation[] }>("/api/conversations");
}

export function getMessages(id: string) {
  return api<{ conversation: Conversation; messages: ChatMessage[] }>(
    `/api/conversations/${id}/messages`,
  );
}

export function deleteConversation(id: string) {
  return api<{ ok: boolean }>(`/api/conversations/${id}`, { method: "DELETE" });
}

export type StreamEvent =
  | { type: "meta"; conversationId: string; userMessageId: string; assistantMessageId: string }
  | { type: "delta"; text: string }
  | { type: "done"; conversationId: string; assistantMessageId: string; content: string }
  | { type: "error"; message: string };

export async function streamChat(
  payload: { conversationId?: string; message: string },
  onEvent: (event: StreamEvent) => void,
) {
  const res = await fetch("/api/chat", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const err = (await res.json()) as ApiError;
    throw new Error(err.error?.message ?? `Chat failed (${res.status})`);
  }

  if (!res.body) throw new Error("No response stream");

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const chunks = buffer.split("\n\n");
    buffer = chunks.pop() ?? "";
    for (const chunk of chunks) {
      const line = chunk.trim();
      if (!line.startsWith("data:")) continue;
      const json = line.slice(5).trim();
      if (!json) continue;
      onEvent(JSON.parse(json) as StreamEvent);
    }
  }
}
