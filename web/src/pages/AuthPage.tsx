import { useState, type FormEvent } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../lib/auth";

export function AuthPage() {
  const { user, loading, login, register } = useAuth();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (loading) {
    return (
      <div className="flex min-h-full items-center justify-center text-muted">Checking session…</div>
    );
  }
  if (user) return <Navigate to="/" replace />;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      if (mode === "login") await login(email, password);
      else await register(email, password);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="relative min-h-full overflow-hidden bg-ink">
      <div className="pointer-events-none absolute -left-24 top-0 h-80 w-80 rounded-full bg-accent-2/20 blur-3xl" />
      <div className="pointer-events-none absolute bottom-0 right-0 h-96 w-96 rounded-full bg-accent/10 blur-3xl" />
      <div className="mx-auto flex min-h-full max-w-md flex-col justify-center px-6 py-16">
        <p className="mb-2 text-sm tracking-[0.2em] text-accent uppercase">Cloudflare-native</p>
        <h1 className="font-display text-4xl text-cream">Harbor</h1>
        <p className="mt-2 text-muted">Sign in to keep conversations private to your account.</p>

        <form onSubmit={onSubmit} className="mt-10 space-y-4 rounded-2xl border border-line bg-panel p-6 shadow-xl">
          <div className="flex rounded-lg bg-ink p-1">
            <button
              type="button"
              className={`flex-1 rounded-md py-2 text-sm ${mode === "login" ? "bg-line text-cream" : "text-muted"}`}
              onClick={() => setMode("login")}
            >
              Log in
            </button>
            <button
              type="button"
              className={`flex-1 rounded-md py-2 text-sm ${mode === "register" ? "bg-line text-cream" : "text-muted"}`}
              onClick={() => setMode("register")}
            >
              Register
            </button>
          </div>
          <label className="block text-sm">
            <span className="text-muted">Email</span>
            <input
              className="mt-1 w-full rounded-lg border border-line bg-ink px-3 py-2 text-cream outline-none focus:border-accent"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </label>
          <label className="block text-sm">
            <span className="text-muted">Password</span>
            <input
              className="mt-1 w-full rounded-lg border border-line bg-ink px-3 py-2 text-cream outline-none focus:border-accent"
              type="password"
              autoComplete={mode === "login" ? "current-password" : "new-password"}
              minLength={mode === "register" ? 8 : undefined}
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </label>
          {error ? (
            <p className="rounded-lg border border-red-900/60 bg-red-950/40 px-3 py-2 text-sm text-red-200">{error}</p>
          ) : null}
          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-lg bg-accent py-2.5 font-medium text-ink disabled:opacity-60"
          >
            {submitting ? "Please wait…" : mode === "login" ? "Enter" : "Create account"}
          </button>
        </form>
      </div>
    </div>
  );
}
