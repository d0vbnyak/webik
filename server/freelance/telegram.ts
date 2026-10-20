/**
 * Отправка заказов в Telegram через Bot API.
 *
 * С прод-сервера Timeweb api.telegram.org недоступен (deploy/README.md), поэтому
 * бот запускается там, где Telegram открыт: на рабочем компьютере или другом хосте.
 */
import type { Job } from "./sources";

const DESCRIPTION_LIMIT = 500;

const escapeHtml = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

function cut(s: string, limit: number): string {
  if (s.length <= limit) return s;
  const head = s.slice(0, limit);
  const space = head.lastIndexOf(" ");
  return `${(space > limit * 0.7 ? head.slice(0, space) : head).trimEnd()}…`;
}

/** Сообщение о заказе, parse_mode HTML. */
export function formatJob(job: Job, topics: string[]): string {
  const meta = [job.budget ?? "бюджет не указан", job.source, job.category].filter(Boolean).join(" · ");
  const lines = [
    `<b>${escapeHtml(job.title)}</b>`,
    escapeHtml(meta),
    `#${topics.map((t) => t.replace(/[^\p{L}\p{N}]+/gu, "_")).join(" #")}`,
  ];
  if (job.description) lines.push("", escapeHtml(cut(job.description, DESCRIPTION_LIMIT)));
  lines.push("", `<a href="${escapeHtml(job.url)}">Открыть заказ</a>`);
  return lines.join("\n");
}

export type Telegram = { send: (html: string) => Promise<void> };

/**
 * Ошибка Telegram. permanent — повтор не поможет: не принято само сообщение
 * (разметка, длина). «chat not found» и прочие 400 — не permanent: это
 * настройка, и заказы должны дождаться, пока её исправят.
 */
export class TelegramError extends Error {
  readonly permanent: boolean;
  constructor(message: string, permanent: boolean) {
    super(message);
    this.permanent = permanent;
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export function telegram(token: string, chatId: string, fetchImpl: typeof fetch = fetch): Telegram {
  return {
    async send(html) {
      for (let attempt = 0; ; attempt++) {
        const res = await fetchImpl(`https://api.telegram.org/bot${token}/sendMessage`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ chat_id: chatId, text: html, parse_mode: "HTML", link_preview_options: { is_disabled: true } }),
          signal: AbortSignal.timeout(15_000),
        });
        if (res.ok) return;
        const body = (await res.json().catch(() => ({}))) as { description?: string; parameters?: { retry_after?: number } };
        // Слишком часто — Telegram говорит, сколько подождать
        if (res.status === 429 && attempt < 3) {
          await sleep(((body.parameters?.retry_after ?? 5) + 1) * 1000);
          continue;
        }
        // В тексте ошибки нет токена: он только в URL
        throw new TelegramError(`Telegram ответил ${res.status}: ${body.description ?? ""}`.trim(), res.status === 400 && /can't parse|too long|text is empty/i.test(body.description ?? ""));
      }
    },
  };
}

/** chat_id тех, кто писал боту, — чтобы узнать свой при настройке. */
export async function recentChats(token: string, fetchImpl: typeof fetch = fetch): Promise<{ id: number; name: string }[]> {
  const res = await fetchImpl(`https://api.telegram.org/bot${token}/getUpdates`, { signal: AbortSignal.timeout(15_000) });
  const body = (await res.json()) as {
    ok: boolean;
    description?: string;
    result?: { message?: { chat: { id: number; first_name?: string; username?: string; title?: string } } }[];
  };
  if (!body.ok) throw new Error(`Telegram ответил ${res.status}: ${body.description ?? ""}`);
  const chats = new Map<number, string>();
  for (const u of body.result ?? []) {
    const c = u.message?.chat;
    if (c) chats.set(c.id, c.title ?? (c.username ? `@${c.username}` : (c.first_name ?? "")));
  }
  return [...chats].map(([id, name]) => ({ id, name }));
}
