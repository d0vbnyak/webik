import { useCallback, useEffect, useState } from "react";
import Card from "./Card";
import { btnGhost, btnPrimary } from "./controls";
import { API_HEADERS } from "../lib/db";
import { formatDate } from "../lib/dates";

type Info = { created_at: string; last_used_at: string | null } | null;

/**
 * Токен плагина webik. Сам токен виден один раз — сразу после выпуска; в базе
 * только его хеш. Перевыпуск заменяет старый: старый перестаёт работать.
 * Протокол — docs/webik-plugin-sync.md.
 */
export default function PluginTokenCard() {
  const [info, setInfo] = useState<Info>(null);
  const [loading, setLoading] = useState(true);
  const [fresh, setFresh] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/webik/token", { credentials: "same-origin" });
      const body = (await res.json()) as { info?: Info; error?: string };
      if (!res.ok) throw new Error(body.error ?? `Сервер ответил ${res.status}`);
      setInfo(body.info ?? null);
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function call(method: "POST" | "DELETE") {
    if (method === "POST" && info && !window.confirm("Старый токен перестанет работать. Выпустить новый?")) return;
    if (method === "DELETE" && !window.confirm("Отозвать токен? Плагин перестанет обновлять проекты.")) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/webik/token", { method, credentials: "same-origin", headers: API_HEADERS, body: "{}" });
      const body = (await res.json()) as { token?: string; error?: string };
      if (!res.ok) throw new Error(body.error ?? `Сервер ответил ${res.status}`);
      setFresh(method === "POST" ? (body.token ?? null) : null);
      await load();
    } catch (e) {
      setError((e as Error).message);
    }
    setBusy(false);
  }

  const snippet = fresh
    ? JSON.stringify({ admin: { url: window.location.origin, token: fresh } }, null, 2)
    : "";

  return (
    <Card>
      <h2 className="font-display text-base font-semibold">Плагин webik</h2>
      <p className="mt-1 text-sm text-zinc-400">
        После каждого этапа плагин присылает state.json проекта — проект создаётся и двигается по этапам сам.
      </p>

      <div className="mt-4 text-sm">
        {loading ? (
          <span className="text-zinc-500">Проверяю…</span>
        ) : info ? (
          <span className="text-zinc-300">
            Токен выпущен {formatDate(info.created_at.slice(0, 10))}
            <span className="text-zinc-500">
              {" · "}
              {info.last_used_at ? `плагин заходил ${formatDate(info.last_used_at.slice(0, 10))}` : "плагин ещё не заходил"}
            </span>
          </span>
        ) : (
          <span className="text-zinc-500">Токен не выпущен — плагин не может обновлять проекты.</span>
        )}
      </div>

      {fresh && (
        <div className="mt-4 rounded-xl border border-brand-green/30 bg-zinc-950 p-3">
          <p className="mb-2 text-xs text-zinc-400">
            Добавьте в <span className="font-mono">~/.webik/config.json</span> на машине с плагином. Токен показывается один раз.
          </p>
          <pre className="overflow-x-auto font-mono text-xs leading-relaxed text-zinc-200">{snippet}</pre>
          <button
            type="button"
            onClick={() => {
              void navigator.clipboard.writeText(snippet).then(() => {
                setCopied(true);
                setTimeout(() => setCopied(false), 1500);
              });
            }}
            className={`${btnGhost} mt-3`}
          >
            {copied ? "Скопировано" : "Скопировать"}
          </button>
        </div>
      )}

      {error && <p className="mt-3 text-sm text-red-400">{error}</p>}

      <div className="mt-4 flex flex-wrap gap-2">
        <button type="button" disabled={busy || loading} onClick={() => void call("POST")} className={info ? btnGhost : btnPrimary}>
          {info ? "Выпустить новый" : "Выпустить токен"}
        </button>
        {info && (
          <button type="button" disabled={busy} onClick={() => void call("DELETE")} className={btnGhost}>
            Отозвать
          </button>
        )}
      </div>
    </Card>
  );
}
