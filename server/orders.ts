/**
 * Заявки с сайта — общие для формы (/api/order) и для ИИ-ассистента
 * (инструмент send_order в server/chat.ts).
 *
 * Куда уходит заявка:
 *   1. **CRM админки** — главный путь. Лид на этапе «Ответили» с шагом «Ответить и
 *      квалифицировать» на сегодня, как входящее обращение, заведённое вручную
 *      (src/admin/pages/Crm.tsx). Текст заявки — касанием «Сообщение».
 *   2. **Telegram** — уведомление, если заданы переменные. С прод-сервера Timeweb
 *      api.telegram.org недоступен (проверено 15.09.2026), поэтому там его нет.
 *
 * Заявка принята, если сработал хотя бы один путь.
 *
 * Переменные окружения для Telegram:
 *   TELEGRAM_BOT_TOKEN  токен бота, от имени которого приходят заявки
 *   TELEGRAM_CHAT_ID    куда слать (ваш личный чат с ботом)
 *
 * Бот может писать только тому, кто хоть раз нажал у него «Старт».
 * Имя ADMIN_CHAT_ID от support-bot сознательно не подхватывается: иначе любая
 * проверка формы в `npm run dev` слала бы настоящее сообщение.
 */
import { formatOrder, type Order, type OrderSource } from "../shared/order";
import { limiterIpKey } from "./api/auth";
import type { Db } from "./db/db";

export type OrderNotifier = (text: string) => Promise<void>;
/** Сохраняет заявку. Бросает, если сохранить не удалось. */
export type OrderSaver = (order: Order, source: OrderSource) => Promise<void>;

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

/** Источник лида в CRM — из списка SOURCES в src/admin/lib/crm.ts. */
const CRM_SOURCE: Record<OrderSource, string> = { form: "Сайт", assistant: "Бот" };

type ContactFields = {
  email: string | null;
  phone: string | null;
  telegram_username: string | null;
  other_channels: string | null;
};

/**
 * Раскладывает контакт посетителя по полям карточки лида: почта, телефон, ник
 * Telegram. Непонятное — в «другие каналы», чтобы ничего не потерять.
 */
export function splitContact(contact: string): ContactFields {
  const empty: ContactFields = { email: null, phone: null, telegram_username: null, other_channels: null };
  const c = contact.trim();
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(c)) return { ...empty, email: c };
  const tg = c.match(/^(?:@|(?:https?:\/\/)?t\.me\/)([A-Za-z][A-Za-z0-9_]{4,31})\/?$/);
  if (tg) return { ...empty, telegram_username: tg[1] };
  if (/^\+?[\d\s()-]+$/.test(c) && c.replace(/\D/g, "").length >= 7) return { ...empty, phone: c };
  return { ...empty, other_channels: c };
}

/**
 * Пишет заявку в CRM. Одним запросом: лид и касание с текстом появляются вместе
 * или не появляются вовсе.
 *
 * Владелец — первый пользователь админки (она на одного человека). Дата шага —
 * текущая дата по UTC: для любого часового пояса России она не бывает «завтра»,
 * так что заявка гарантированно попадает в «Сегодня».
 */
export function crmOrderSaver(db: Db): OrderSaver {
  return async (order, source) => {
    const contact = splitContact(order.contact);
    const company = order.name ? `${order.name} — заявка с сайта` : "Заявка с сайта";
    const rows = await db.query<{ id: string }>(
      `with owner as (select id from users order by created_at limit 1),
       lead as (
         insert into leads (user_id, company, contact_name, email, phone, telegram_username,
                            other_channels, business, source, stage, reached_stage,
                            next_step, next_step_date)
         select id, $1::text, $2::text, $3::text, $4::text, $5::text, $6::text, $7::text, $8::text, 'replied', 'replied',
                'Ответить и квалифицировать', current_date
         from owner
         returning id, user_id
       )
       insert into lead_touches (user_id, lead_id, type, date, comment)
       select user_id, id, 'message', current_date, $9::text from lead
       returning lead_id as id`,
      [
        company,
        order.name || null,
        contact.email,
        contact.phone,
        contact.telegram_username,
        contact.other_channels,
        order.task,
        CRM_SOURCE[source],
        formatOrder(order, source),
      ],
    );
    if (rows.length === 0) throw new Error("в админке нет пользователя — заявку некому записать");
  };
}

/**
 * Лимиты на заявки: чтобы скрипт не завалил CRM и Telegram.
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

export type OrderDeps = { save: OrderSaver | null; notify: OrderNotifier | null; limiter: OrderLimiter };

export type SubmitResult =
  | { ok: true; saved: boolean; notified: boolean }
  | { ok: false; reason: "not_configured" | "rate_limited" | "failed" };

/** Принимает проверенную заявку: CRM, затем Telegram. Ошибки не бросает — возвращает причину. */
export async function submitOrder(order: Order, source: OrderSource, ip: string, deps: OrderDeps): Promise<SubmitResult> {
  if (!deps.save && !deps.notify) return { ok: false, reason: "not_configured" };
  // IPv6 — по подсети /64: иначе один хост обходит лимит сменой адреса
  if (!deps.limiter.take(limiterIpKey(ip))) return { ok: false, reason: "rate_limited" };

  let saved = false;
  let notified = false;
  if (deps.save) {
    try {
      await deps.save(order, source);
      saved = true;
    } catch (e) {
      console.error("[order] не удалось записать заявку в CRM:", (e as Error).message);
    }
  }
  if (deps.notify) {
    try {
      await deps.notify(formatOrder(order, source));
      notified = true;
    } catch (e) {
      console.error("[order] не удалось отправить заявку в Telegram:", (e as Error).message);
    }
  }
  return saved || notified ? { ok: true, saved, notified } : { ok: false, reason: "failed" };
}
