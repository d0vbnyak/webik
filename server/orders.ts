/**
 * Заявки с сайта — общие для формы (/api/order) и для ИИ-ассистента
 * (инструмент send_order в server/chat.ts).
 *
 * Куда уходит заявка:
 *   1. **CRM админки** — главный путь. Лид на этапе «Ответили» с шагом «Ответить и
 *      квалифицировать» на сегодня, как входящее обращение, заведённое вручную
 *      (src/admin/pages/Crm.tsx). Текст заявки — касанием «Сообщение».
 *   2. **Уведомления** — письмо на почту и/или Telegram, если заданы переменные.
 *      С прод-сервера Timeweb api.telegram.org недоступен (проверено 15.09.2026),
 *      SMTP Gmail и Яндекса — доступен. Поэтому в проде уведомляет почта.
 *
 * Заявка принята, если сработал хотя бы один путь: CRM или уведомление.
 *
 * Переменные окружения для почты (включается, когда задан SMTP_PASS):
 *   SMTP_HOST       по умолчанию smtp.gmail.com
 *   SMTP_PORT       по умолчанию 465 (TLS); 587 — STARTTLS
 *   SMTP_USER       ящик-отправитель, по умолчанию CONTACT_EMAIL
 *   SMTP_PASS       пароль приложения этого ящика (не основной пароль)
 *   ORDER_EMAIL_TO  куда слать, по умолчанию CONTACT_EMAIL
 *
 * Переменные окружения для Telegram:
 *   TELEGRAM_BOT_TOKEN  токен бота, от имени которого приходят заявки
 *   TELEGRAM_CHAT_ID    куда слать (ваш личный чат с ботом)
 *
 * Бот может писать только тому, кто хоть раз нажал у него «Старт».
 * Имя ADMIN_CHAT_ID от support-bot сознательно не подхватывается: иначе любая
 * проверка формы в `npm run dev` слала бы настоящее сообщение.
 */
import { createTransport } from "nodemailer";
import { formatOrder, type Order, type OrderSource } from "../shared/order";
import { CONTACT_EMAIL, SITE_URL } from "../shared/contacts";
import { limiterIpKey } from "./api/auth";
import type { Db } from "./db/db";

/** Что знает уведомление о заявке. leadId — если заявка уже записана в CRM. */
export type OrderNotice = { order: Order; source: OrderSource; text: string; leadId: string | null };
export type OrderNotifier = (notice: OrderNotice) => Promise<void>;
/** Сохраняет заявку и возвращает id лида. Бросает, если сохранить не удалось. */
export type OrderSaver = (order: Order, source: OrderSource) => Promise<string>;

type Env = Record<string, string | undefined>;

/** Отправитель в Telegram или null, если он не настроен. */
export function telegramNotifierFromEnv(env: Env, fetchImpl: typeof fetch = fetch): OrderNotifier | null {
  const token = env.TELEGRAM_BOT_TOKEN?.trim();
  const chatId = env.TELEGRAM_CHAT_ID?.trim();
  if (!token || !chatId) return null;

  return async ({ text }) => {
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

/** Письмо, которое уходит в SMTP. Отдельный тип — чтобы подменять отправку в тестах. */
export type MailMessage = { from: string; to: string; replyTo?: string; subject: string; text: string };
export type SendMail = (message: MailMessage) => Promise<unknown>;

/** Тема письма: одна строка, без переносов и длинных хвостов. */
export function orderSubject(order: Order): string {
  const who = (order.name || order.contact).replace(/\s+/g, " ").slice(0, 80);
  return `Заявка с сайта WebIK — ${who}`;
}

/** Текст письма: сама заявка и ссылка на карточку лида. */
export function orderEmailText({ text, leadId }: OrderNotice): string {
  const link = leadId ? `Карточка в CRM: ${SITE_URL}/admin/crm/${leadId}` : "В CRM заявка не записалась — ответьте по контакту выше.";
  return `${text}\n\n${link}`;
}

/** Отправитель писем о заявках или null, если не задан SMTP_PASS. */
export function emailNotifierFromEnv(env: Env, send?: SendMail): OrderNotifier | null {
  const pass = env.SMTP_PASS?.trim();
  if (!pass) return null;
  const user = env.SMTP_USER?.trim() || CONTACT_EMAIL;
  const to = env.ORDER_EMAIL_TO?.trim() || CONTACT_EMAIL;
  const port = Number(env.SMTP_PORT ?? 465);

  const deliver: SendMail =
    send ??
    (() => {
      const transport = createTransport({
        host: env.SMTP_HOST?.trim() || "smtp.gmail.com",
        port,
        secure: port === 465,
        auth: { user, pass },
        // Посетитель ждёт ответа формы — долго висеть на почтовом сервере нельзя
        connectionTimeout: 10_000,
        greetingTimeout: 10_000,
        socketTimeout: 15_000,
      });
      return (message) => transport.sendMail(message);
    })();

  return async (notice) => {
    const email = notice.order.contact.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)?.[0];
    await deliver({
      from: `"Сайт WebIK" <${user}>`,
      to,
      // «Ответить» в почте сразу пишет клиенту, если он оставил почту
      ...(email ? { replyTo: email } : {}),
      subject: orderSubject(notice.order),
      text: orderEmailText(notice),
    });
  };
}

/**
 * Все настроенные уведомления разом: почта и Telegram. Успех — если дошло хотя бы
 * одно; упавшие пишутся в лог. null — ни одно не настроено.
 */
export function notifiersFromEnv(env: Env): OrderNotifier | null {
  const channels = [
    { name: "почта", notify: emailNotifierFromEnv(env) },
    { name: "Telegram", notify: telegramNotifierFromEnv(env) },
  ].filter((c): c is { name: string; notify: OrderNotifier } => c.notify !== null);
  if (channels.length === 0) return null;

  return async (notice) => {
    const results = await Promise.allSettled(channels.map((c) => c.notify(notice)));
    let delivered = false;
    results.forEach((r, i) => {
      if (r.status === "fulfilled") delivered = true;
      else console.error(`[order] уведомление (${channels[i].name}) не ушло:`, (r.reason as Error)?.message);
    });
    if (!delivered) throw new Error("ни одно уведомление не ушло");
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
    return rows[0].id;
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

/** Принимает проверенную заявку: CRM, затем уведомления. Ошибки не бросает — возвращает причину. */
export async function submitOrder(order: Order, source: OrderSource, ip: string, deps: OrderDeps): Promise<SubmitResult> {
  if (!deps.save && !deps.notify) return { ok: false, reason: "not_configured" };
  // IPv6 — по подсети /64: иначе один хост обходит лимит сменой адреса
  if (!deps.limiter.take(limiterIpKey(ip))) return { ok: false, reason: "rate_limited" };

  let saved = false;
  let notified = false;
  let leadId: string | null = null;
  if (deps.save) {
    try {
      leadId = await deps.save(order, source);
      saved = true;
    } catch (e) {
      console.error("[order] не удалось записать заявку в CRM:", (e as Error).message);
    }
  }
  if (deps.notify) {
    try {
      await deps.notify({ order, source, text: formatOrder(order, source), leadId });
      notified = true;
    } catch (e) {
      console.error("[order] уведомление о заявке не ушло:", (e as Error).message);
    }
  }
  return saved || notified ? { ok: true, saved, notified } : { ok: false, reason: "failed" };
}
