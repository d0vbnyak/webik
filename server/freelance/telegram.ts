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

/** Кнопки под заказом: «Не то», а после нажатия — «Вернуть». */
export const rejectButton = (key: string) => ({ inline_keyboard: [[{ text: "Не то", callback_data: `no:${key}` }]] });
export const undoButton = (key: string) => ({
  inline_keyboard: [[{ text: "Отмечено «Не то» · Вернуть", callback_data: `undo:${key}` }]],
});

/** key — заказ, под которым нужна кнопка «Не то». */
export type Telegram = { send: (html: string, key?: string) => Promise<void> };

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

export type TelegramApi = <T = unknown>(method: string, params?: object, timeoutMs?: number) => Promise<T>;

/** Вызов Bot API. На 429 ждёт, сколько скажет Telegram, до трёх раз. */
export function telegramApi(token: string, fetchImpl: typeof fetch = fetch): TelegramApi {
  return async <T,>(method: string, params: object = {}, timeoutMs = 15_000): Promise<T> => {
    for (let attempt = 0; ; attempt++) {
      const res = await fetchImpl(`https://api.telegram.org/bot${token}/${method}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(params),
        signal: AbortSignal.timeout(timeoutMs),
      });
      const body = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        result?: T;
        description?: string;
        parameters?: { retry_after?: number };
      };
      if (res.ok && body.ok !== false) return body.result as T;
      if (res.status === 429 && attempt < 3) {
        await sleep(((body.parameters?.retry_after ?? 5) + 1) * 1000);
        continue;
      }
      // В тексте ошибки нет токена: он только в URL
      throw new TelegramError(
        `Telegram ответил ${res.status}: ${body.description ?? ""}`.trim(),
        res.status === 400 && /can't parse|too long|text is empty/i.test(body.description ?? ""),
      );
    }
  };
}

export function telegram(api: TelegramApi, chatId: string): Telegram {
  return {
    async send(html, key) {
      await api("sendMessage", {
        chat_id: chatId,
        text: html,
        parse_mode: "HTML",
        link_preview_options: { is_disabled: true },
        ...(key ? { reply_markup: rejectButton(key) } : {}),
      });
    },
  };
}

/** chat_id тех, кто писал боту, — чтобы узнать свой при настройке. */
export async function recentChats(api: TelegramApi): Promise<{ id: number; name: string }[]> {
  const updates = await api<{ message?: { chat: { id: number; first_name?: string; username?: string; title?: string } } }[]>(
    "getUpdates",
  );
  const chats = new Map<number, string>();
  for (const u of updates) {
    const c = u.message?.chat;
    if (c) chats.set(c.id, c.title ?? (c.username ? `@${c.username}` : (c.first_name ?? "")));
  }
  return [...chats].map(([id, name]) => ({ id, name }));
}
