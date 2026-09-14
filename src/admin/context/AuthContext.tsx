import { createContext, useCallback, useEffect, useState } from "react";
import type { ReactNode } from "react";
import { API_HEADERS, sessionExpired } from "../lib/db";

export interface User {
  id: string;
  email: string;
}

interface AuthValue {
  /** Текущий пользователь; null — не вошёл. Поле session оставлено для совместимости со страницами. */
  session: { user: User } | null;
  user: User | null;
  loading: boolean;
  signIn: (email: string, password: string, totp?: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
}

export const AuthContext = createContext<AuthValue | null>(null);

/**
 * Вход через свой API (server/api/app.ts). Сессия — httpOnly-cookie: из JS её
 * не прочитать, поэтому состояние узнаём запросом /api/auth/session.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/auth/session", { credentials: "same-origin" })
      .then((r) => (r.ok ? r.json() : { user: null }))
      .then((body: { user: User | null }) => {
        if (!cancelled) setUser(body.user);
      })
      .catch(() => {
        if (!cancelled) setUser(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    // Любой запрос к базе получил 401 — сессия истекла, возвращаем на вход
    const onExpired = () => setUser(null);
    sessionExpired.addEventListener("expired", onExpired);
    return () => {
      cancelled = true;
      sessionExpired.removeEventListener("expired", onExpired);
    };
  }, []);

  const signIn = useCallback(async (email: string, password: string, totp?: string) => {
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        credentials: "same-origin",
        headers: API_HEADERS,
        body: JSON.stringify({ email, password, totp }),
      });
      const body = (await res.json().catch(() => ({}))) as { user?: User; error?: string };
      if (!res.ok || !body.user) return { error: body.error ?? `Сервер ответил ${res.status}` };
      setUser(body.user);
      return { error: null };
    } catch {
      return { error: "Нет связи с сервером" };
    }
  }, []);

  const signOut = useCallback(async () => {
    await fetch("/api/auth/logout", { method: "POST", credentials: "same-origin", headers: API_HEADERS }).catch(() => {});
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ session: user ? { user } : null, user, loading, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}
