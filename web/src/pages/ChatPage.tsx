import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Navigate } from "react-router-dom";
import {
  deleteConversation,
  getMessages,
  listConversations,
  streamChat,
  type ChatMessage,
  type Conversation,
} from "../lib/api";
import { useAuth } from "../lib/auth";

export function ChatPage() {
  const { user, loading, logout } = useAuth();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [loadingThread, setLoadingThread] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const streamingId = useRef<string>("streaming");

  const activeTitle = useMemo(
    () => conversations.find((c) => c.id === activeId)?.title ?? "New conversation",
    [conversations, activeId],
  );

  const refreshList = useCallback(async () => {
    const res = await listConversations();
    setConversations(res.conversations);
  }, []);

  useEffect(() => {
    if (!user) return;
    refreshList().catch((err) => setError(err instanceof Error ? err.message : "Failed to load chats"));
  }, [user, refreshList]);

  useEffect(() => {
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  async function openConversation(id: string) {
    setActiveId(id);
    setSidebarOpen(false);
    setLoadingThread(true);
    setError(null);
    try {
      const res = await getMessages(id);
      setMessages(res.messages);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load messages");
    } finally {
      setLoadingThread(false);
    }
  }

  function newChat() {
    setActiveId(null);
    setMessages([]);
    setSidebarOpen(false);
  }

  async function removeConversation(id: string) {
    await deleteConversation(id);
    setConversations((prev) => prev.filter((c) => c.id !== id));
    if (activeId === id) {
      setActiveId(null);
      setMessages([]);
    }
  }

  async function send() {
    const text = draft.trim();
    if (!text || busy) return;
    setDraft("");
    setBusy(true);
    setError(null);

    const tempUserId = crypto.randomUUID();
    streamingId.current = "streaming";
    setMessages((prev) => [
      ...prev,
      { id: tempUserId, role: "user", content: text },
      { id: "streaming", role: "assistant", content: "" },
    ]);

    try {
      await streamChat({ conversationId: activeId ?? undefined, message: text }, (event) => {
        if (event.type === "meta") {
          streamingId.current = event.assistantMessageId;
          setActiveId(event.conversationId);
          setMessages((prev) =>
            prev.map((m) => {
              if (m.id === tempUserId) return { ...m, id: event.userMessageId };
              if (m.id === "streaming") return { ...m, id: event.assistantMessageId };
              return m;
            }),
          );
        }
        if (event.type === "delta") {
          const id = streamingId.current;
          setMessages((prev) => prev.map((m) => (m.id === id ? { ...m, content: m.content + event.text } : m)));
        }
        if (event.type === "done") {
          setActiveId(event.conversationId);
          const id = streamingId.current;
          setMessages((prev) =>
            prev.map((m) =>
              m.id === id || m.id === event.assistantMessageId
                ? { ...m, id: event.assistantMessageId, content: event.content || m.content }
                : m,
            ),
          );
        }
        if (event.type === "error") {
          setError(event.message);
        }
      });
      await refreshList();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send message");
      setMessages((prev) => prev.filter((m) => m.id !== "streaming"));
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return <div className="flex min-h-full items-center justify-center text-muted">Loading…</div>;
  }
  if (!user) return <Navigate to="/login" replace />;

  return (
    <div className="flex h-full bg-ink text-cream">
      <aside
        className={`fixed inset-y-0 left-0 z-20 w-72 border-r border-line bg-panel transition-transform md:static md:translate-x-0 ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex h-full flex-col">
          <div className="flex items-center justify-between px-4 py-4">
            <div>
              <p className="font-display text-xl">Harbor</p>
              <p className="truncate text-xs text-muted">{user.email}</p>
            </div>
            <button
              className="rounded-md border border-line px-2 py-1 text-xs md:hidden"
              onClick={() => setSidebarOpen(false)}
            >
              Close
            </button>
          </div>
          <button
            onClick={newChat}
            className="mx-4 mb-3 rounded-lg bg-accent py-2 text-sm font-medium text-ink"
          >
            New chat
          </button>
          <div className="flex-1 space-y-1 overflow-y-auto px-2 pb-4">
            {conversations.map((conv) => (
              <div
                key={conv.id}
                className={`group flex items-center rounded-lg px-2 ${
                  conv.id === activeId ? "bg-line" : "hover:bg-ink"
                }`}
              >
                <button
                  className="min-w-0 flex-1 truncate px-2 py-2 text-left text-sm"
                  onClick={() => openConversation(conv.id)}
                >
                  {conv.title}
                </button>
                <button
                  className="hidden px-2 text-xs text-muted group-hover:block"
                  onClick={() => removeConversation(conv.id)}
                  aria-label="Delete conversation"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
          <button onClick={() => logout()} className="m-4 rounded-lg border border-line py-2 text-sm text-muted">
            Log out
          </button>
        </div>
      </aside>

      {sidebarOpen ? (
        <button className="fixed inset-0 z-10 bg-black/50 md:hidden" onClick={() => setSidebarOpen(false)} />
      ) : null}

      <main className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center gap-3 border-b border-line px-4 py-3">
          <button className="rounded-md border border-line px-2 py-1 text-sm md:hidden" onClick={() => setSidebarOpen(true)}>
            Menu
          </button>
          <h2 className="truncate font-medium">{activeTitle}</h2>
        </header>

        <div ref={scroller} className="flex-1 overflow-y-auto px-4 py-6">
          {loadingThread ? <p className="text-center text-muted">Loading messages…</p> : null}
          {!loadingThread && messages.length === 0 ? (
            <div className="mx-auto mt-24 max-w-lg text-center">
              <h3 className="font-display text-3xl">Ask anything</h3>
              <p className="mt-2 text-muted">Messages stream in as they are generated. History is stored in D1 for your account only.</p>
            </div>
          ) : null}
          <div className="mx-auto flex max-w-3xl flex-col gap-4">
            {messages.map((m) => (
              <article
                key={m.id}
                className={`max-w-[85%] rounded-2xl px-4 py-3 leading-relaxed whitespace-pre-wrap ${
                  m.role === "user"
                    ? "ml-auto bg-accent-2/20 border border-accent-2/30"
                    : "bg-panel border border-line"
                }`}
              >
                <p className="mb-1 text-[11px] tracking-wide text-muted uppercase">{m.role}</p>
                {m.content || (busy && m.role === "assistant") ? m.content : null}
                {busy && m.role === "assistant" && messages[messages.length - 1]?.id === m.id && !m.content ? (
                  <span className="text-muted">Thinking…</span>
                ) : null}
              </article>
            ))}
          </div>
        </div>

        <div className="border-t border-line p-4">
          {error ? <p className="mx-auto mb-3 max-w-3xl text-sm text-red-300">{error}</p> : null}
          <form
            className="mx-auto flex max-w-3xl gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              void send();
            }}
          >
            <textarea
              className="h-20 flex-1 resize-none rounded-xl border border-line bg-panel px-3 py-2 outline-none focus:border-accent"
              placeholder="Write a message"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void send();
                }
              }}
            />
            <button
              type="submit"
              disabled={busy || !draft.trim()}
              className="self-end rounded-xl bg-accent px-4 py-2 font-medium text-ink disabled:opacity-50"
            >
              {busy ? "…" : "Send"}
            </button>
          </form>
        </div>
      </main>
    </div>
  );
}
