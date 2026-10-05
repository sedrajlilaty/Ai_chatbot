export type UserRow = {
  id: string;
  email: string;
  password_hash: string;
  password_salt: string;
  created_at: string;
};

export type ConversationRow = {
  id: string;
  user_id: string;
  title: string;
  created_at: string;
  updated_at: string;
};

export type MessageRow = {
  id: string;
  conversation_id: string;
  role: "user" | "assistant";
  content: string;
  created_at: string;
};

export function titleFromMessage(message: string): string {
  const trimmed = message.replace(/\s+/g, " ").trim();
  if (trimmed.length <= 60) return trimmed || "New conversation";
  return `${trimmed.slice(0, 57)}...`;
}

export async function findUserByEmail(db: D1Database, email: string) {
  return db.prepare("SELECT * FROM users WHERE email = ?").bind(email).first<UserRow>();
}

export async function findUserById(db: D1Database, id: string) {
  return db.prepare("SELECT id, email, created_at FROM users WHERE id = ?").bind(id).first<
    Pick<UserRow, "id" | "email" | "created_at">
  >();
}

export async function insertUser(
  db: D1Database,
  user: { id: string; email: string; passwordHash: string; passwordSalt: string },
) {
  await db
    .prepare("INSERT INTO users (id, email, password_hash, password_salt) VALUES (?, ?, ?, ?)")
    .bind(user.id, user.email, user.passwordHash, user.passwordSalt)
    .run();
}

export async function listConversations(db: D1Database, userId: string) {
  const { results } = await db
    .prepare(
      "SELECT id, user_id, title, created_at, updated_at FROM conversations WHERE user_id = ? ORDER BY updated_at DESC",
    )
    .bind(userId)
    .all<ConversationRow>();
  return results ?? [];
}

export async function getConversation(db: D1Database, id: string, userId: string) {
  return db
    .prepare("SELECT * FROM conversations WHERE id = ? AND user_id = ?")
    .bind(id, userId)
    .first<ConversationRow>();
}

export async function insertConversation(
  db: D1Database,
  row: { id: string; userId: string; title: string },
) {
  await db
    .prepare("INSERT INTO conversations (id, user_id, title) VALUES (?, ?, ?)")
    .bind(row.id, row.userId, row.title)
    .run();
}

export async function touchConversation(db: D1Database, id: string) {
  await db
    .prepare("UPDATE conversations SET updated_at = datetime('now') WHERE id = ?")
    .bind(id)
    .run();
}

export async function deleteConversation(db: D1Database, id: string, userId: string) {
  const result = await db
    .prepare("DELETE FROM conversations WHERE id = ? AND user_id = ?")
    .bind(id, userId)
    .run();
  return result.meta.changes > 0;
}

export async function insertMessage(
  db: D1Database,
  row: { id: string; conversationId: string; role: "user" | "assistant"; content: string },
) {
  await db
    .prepare("INSERT INTO messages (id, conversation_id, role, content) VALUES (?, ?, ?, ?)")
    .bind(row.id, row.conversationId, row.role, row.content)
    .run();
}

export async function listMessages(db: D1Database, conversationId: string) {
  const { results } = await db
    .prepare(
      "SELECT id, conversation_id, role, content, created_at FROM messages WHERE conversation_id = ? ORDER BY created_at ASC",
    )
    .bind(conversationId)
    .all<MessageRow>();
  return results ?? [];
}

export async function listRecentMessages(db: D1Database, conversationId: string, limit: number) {
  const { results } = await db
    .prepare(
      `SELECT id, conversation_id, role, content, created_at
       FROM messages
       WHERE conversation_id = ?
       ORDER BY created_at DESC
       LIMIT ?`,
    )
    .bind(conversationId, limit)
    .all<MessageRow>();
  return (results ?? []).reverse();
}
