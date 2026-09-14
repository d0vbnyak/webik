import { useState } from "react";
import type { FormEvent } from "react";
import { Navigate } from "react-router";
import { useAuth } from "../hooks/useAuth";
import Spinner from "../components/Spinner";

export default function Login() {
  const { session, loading, signIn } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [totp, setTotp] = useState("");
  const [needTotp, setNeedTotp] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (loading) return <Spinner full />;
  if (session) return <Navigate to="/admin" replace />;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    const { error: err, needTotp: askCode } = await signIn(email.trim(), password, needTotp ? totp : undefined);
    setSubmitting(false);
    if (askCode) setNeedTotp(true);
    // Сервер сам формулирует понятную ошибку (неверный пароль, лимит попыток)
    if (err) setError(err);
    // при успехе AuthContext обновит пользователя → Navigate выше
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-950 px-4 text-zinc-100">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm rounded-2xl border border-zinc-800 bg-zinc-900 p-6"
      >
        <h1 className="font-display text-xl font-semibold tracking-tight">
          WebIK <span className="text-brand-green">· Статистика</span>
        </h1>
        <p className="mt-1 text-sm text-zinc-400">Вход в панель</p>

        <label className="mt-5 block text-sm text-zinc-300">
          Email
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            required
            className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-zinc-100 outline-none focus:border-brand-green"
          />
        </label>

        <label className="mt-3 block text-sm text-zinc-300">
          Пароль
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            required
            className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-zinc-100 outline-none focus:border-brand-green"
          />
        </label>

        {needTotp && (
          <label className="mt-3 block text-sm text-zinc-300">
            Код из приложения
            <input
              type="text"
              inputMode="numeric"
              pattern="[0-9]{6}"
              maxLength={6}
              value={totp}
              onChange={(e) => setTotp(e.target.value.replace(/\D/g, ""))}
              autoComplete="one-time-code"
              autoFocus
              required
              className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 tracking-[0.3em] text-zinc-100 outline-none focus:border-brand-green"
            />
          </label>
        )}

        {error && <p className="mt-3 text-sm text-red-400">{error}</p>}

        <button
          type="submit"
          disabled={submitting}
          className="mt-5 flex w-full items-center justify-center gap-2 rounded-lg bg-brand-green py-2.5 font-medium text-black transition hover:brightness-95 disabled:opacity-60"
        >
          {submitting ? <Spinner /> : "Войти"}
        </button>
      </form>
    </div>
  );
}
