/**
 * Отправка заявок с сайта в Telegram — общая для формы (/api/order) и для
 * ИИ-ассистента (инструмент send_order в server/chat.ts).
 *
 * Переменные окружения:
 *   TELEGRAM_BOT_TOKEN  токен бота, от имени которого приходят заявки
 *   TELEGRAM_CHAT_ID    куда слать (ваш личный чат с ботом)
 *
 * Бот может писать только тому, кто хоть раз нажал у него «Старт».
 * Имя ADMIN_CHAT_ID от support-bot сознательно не подхватывается: иначе любая
 * проверка формы в `npm run dev` слала бы настоящее сообщение.
 */
import { formatOrder, type Order, type OrderSource } from "../shared/order";
import { limiterIpKey } from "./api/auth";

export type OrderNotifier = (text: string) => Promise<void>;

type Env = Record<string, string | undefined>;

/** Отправитель в Telegram или null, если он не настроен. */
export function telegramNotifierFromEnv(env: Env, fetchImpl: typeof fetch = fetch): OrderNotifier | null {
  const token = env.TELEGRAM_BOT_TOKEN?.trim();
  const chatId = env.TELEGRAM_CHAT_ID?.trim();
  if (!token || !chatId) return null;

  return async (text) => {
    const res = await fetchImpl(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text, link_preview_options: { is_disabled: true } }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) {
      // Текст ответа Telegram без токена: в URL он есть, в теле ответа — нет
      const detail = await res.text().catch(() => "");
      throw new Error(`Telegram ответил ${res.status}: ${detail.slice(0, 200)}`);
    }
  };
}

/**
 * Лимиты на заявки: чтобы скрипт не завалил ваш Telegram.
 * Живому человеку хватает с запасом — заявку оставляют один раз.
 */
export const ORDER_RATE = {
  /** Заявок с одного адреса за окно */
  perIp: 3,
  windowMs: 60 * 60 * 1000,
  /** Всего заявок в сутки */
  perDay: 40,
} as const;

export class OrderLimiter {
  private hits = new Map<string, number[]>();
  private day = { stamp: "", count: 0 };

  constructor(private now: () => number = Date.now) {}

  /** Занимает место под заявку. false — лимит исчерпан. */
  take(ip: string): boolean {
    const now = this.now();
    const stamp = new Date(now).toDateString();
    if (stamp !== this.day.stamp) this.day = { stamp, count: 0 };
    if (this.day.count >= ORDER_RATE.perDay) return false;

    const fresh = (this.hits.get(ip) ?? []).filter((t) => now - t < ORDER_RATE.windowMs);
    if (fresh.length >= ORDER_RATE.perIp) {
      this.hits.set(ip, fresh);
      return false;
    }
    fresh.push(now);
    this.hits.set(ip, fresh);
    this.day.count += 1;
    // Протухшие адреса не копятся
    if (this.hits.size > 5000) {
      for (const [key, list] of this.hits) {
        if (list.every((t) => now - t >= ORDER_RATE.windowMs)) this.hits.delete(key);
      }
    }
    return true;
  }
}

export type SubmitResult = { ok: true } | { ok: false; reason: "not_configured" | "rate_limited" | "failed" };

/** Отправляет проверенную заявку. Ошибки не бросает — возвращает причину. */
export async function submitOrder(
  order: Order,
  source: OrderSource,
  ip: string,
  deps: { notify: OrderNotifier | null; limiter: OrderLimiter },
): Promise<SubmitResult> {
  if (!deps.notify) return { ok: false, reason: "not_configured" };
  // IPv6 — по подсети /64: иначе один хост обходит лимит сменой адреса
  if (!deps.limiter.take(limiterIpKey(ip))) return { ok: false, reason: "rate_limited" };
  try {
    await deps.notify(formatOrder(order, source));
    return { ok: true };
  } catch (e) {
    console.error("[order] не удалось отправить заявку в Telegram:", (e as Error).message);
    return { ok: false, reason: "failed" };
  }
}
