/**
 * Обработчик /api/chat — единственное место, где сайт зовёт модель.
 *
 * Живёт на сервере: ключ от Anthropic в браузер не уходит. Подключается как
 * middleware к dev-серверу Vite (см. vite.config.ts). В проде выключен —
 * Anthropic API не обслуживает Россию (см. server/main.ts).
 *
 *   GET  /api/chat  → { enabled, orders } — виджет решает: чат, форма заявки или контакты
 *   POST /api/chat  { sessionId, message } → { sessionId, reply, orderSent }
 *
 * Заявки ассистент отправляет сам: у модели есть инструмент send_order, его
 * вызов проверяется и уходит в CRM админки (и в Telegram, если настроен) через
 * server/orders.ts — тем же путём, что и форма. Лимиты и проверка полей — в коде, не в промпте.
 *
 * Два принципа, которые тут важнее красоты кода:
 *
 * 1. **История диалога живёт на сервере.** Клиент присылает только своё новое
 *    сообщение и идентификатор сессии. Если принимать историю целиком, любой
 *    посетитель подделает реплику бота («да, скидка 40%, договорились») и
 *    продолжит диалог так, будто бот это сказал. На сайте, где бот называет
 *    цены, это главный риск.
 * 2. **Лимиты считаются по адресу сокета.** Заголовку X-Forwarded-For верить
 *    нельзя: он подделывается одной строкой, и лимит на посетителя обходится
 *    случайным адресом в каждом запросе.
 */
import Anthropic from "@anthropic-ai/sdk";
import { randomUUID } from "node:crypto";
import type { IncomingMessage, ServerResponse } from "node:http";

import { SYSTEM_PROMPT } from "./kb";
import { OrderLimiter, submitOrder, type OrderNotifier, type OrderSaver } from "./orders";
import { HISTORY_MAX_MESSAGES, MESSAGE_MAX_CHARS } from "../shared/chat";
import { CONTACT_EMAIL, TELEGRAM_HANDLE } from "../shared/contacts";
import { validateOrder } from "../shared/order";

/**
 * Sonnet, а не Opus, как в соседних проектах: вопросы посетителей простые,
 * а чат на публичной странице — самая массовая точка расхода.
 */
const MODEL = "claude-sonnet-5";

/**
 * Запас по токенам. У Sonnet 5 размышления включены по умолчанию и тратят
 * тот же бюджет, что и ответ, поэтому тесного лимита тут быть не должно:
 * иначе ответ обрывается на полуслове, а на «задумчивом» вопросе текста не
 * остаётся вовсе.
 */
const MAX_TOKENS = 2000;

/** Лимиты. Подобраны под демо-сайт: живому человеку хватает, скрипту — нет. */
const LIMITS = {
  /** Сообщений с одного адреса за окно */
  perIp: 15,
  /** Окно лимита посетителя, мс */
  windowMs: 10 * 60 * 1000,
  /** Общий потолок запросов в сутки на весь сайт */
  perDay: 300,
  /** Сколько живёт сессия без новых сообщений, мс */
  sessionTtlMs: 30 * 60 * 1000,
  /** Потолок числа сессий в памяти */
  maxSessions: 500,
  /** Заявок из одного диалога. Одна: заодно отсекает два параллельных вызова в одном ответе */
  ordersPerSession: 1,
  /** Кругов «модель → инструмент → модель» на одно сообщение посетителя */
  toolRounds: 3,
} as const;

/**
 * Инструмент отправки заявки. strict: модель не пришлёт поле не того типа.
 * Все поля — обязательные строки, пустая строка вместо null (см. CLAUDE.md про схемы).
 */
const ORDER_TOOL: Anthropic.Tool = {
  name: "send_order",
  description:
    "Передаёт заявку посетителя владельцу студии. Вызывай, когда посетитель " +
    "хочет заказать услугу или обсудить проект, и в диалоге уже есть контакт для связи " +
    "(телефон, почта или Telegram) и суть задачи. Без контакта не вызывай — сначала спроси его. " +
    "Одну и ту же заявку повторно не отправляй.",
  strict: true,
  input_schema: {
    type: "object",
    properties: {
      name: { type: "string", description: "Как обращаться к посетителю. Пустая строка, если не назвался." },
      contact: { type: "string", description: "Телефон, почта или Telegram — как написал посетитель." },
      task: { type: "string", description: "Суть задачи своими словами, 1–3 предложения." },
      details: {
        type: "string",
        description: "Бюджет, сроки, ниша, сайт компании — если прозвучали. Иначе пустая строка.",
      },
    },
    required: ["name", "contact", "task", "details"],
    additionalProperties: false,
  },
};

type Session = { messages: Anthropic.MessageParam[]; touched: number; ordersSent: number };

export type ChatOptions = {
  apiKey: string | undefined;
  orderSaver: OrderSaver | null;
  orderNotifier: OrderNotifier | null;
};

/** Состояние в памяти процесса: перезапуск сервера его обнуляет. */
const ipHits = new Map<string, number[]>();
const sessions = new Map<string, Session>();
let orderLimiter = new OrderLimiter();

/** Только для тестов: общий лимитер заявок иначе копится между тестами. */
export function resetOrderLimiterForTests(): void {
  orderLimiter = new OrderLimiter();
}
let dayCount = 0;
let dayStamp = new Date().toDateString();

/**
 * Проверяет лимиты. Ничего не увеличивает: счётчик дня растёт только после
 * удачного ответа модели, иначе серия сбоев выжигает дневной потолок и чат
 * замолкает на сутки, никому ничего не ответив.
 */
function checkLimits(ip: string): string | null {
  const today = new Date().toDateString();
  if (today !== dayStamp) {
    dayStamp = today;
    dayCount = 0;
  }
  if (dayCount >= LIMITS.perDay) {
    return `Чат сегодня уже отвечал слишком много раз. Напишите в Telegram ${TELEGRAM_HANDLE} — ответим лично.`;
  }

  const now = Date.now();
  const hits = (ipHits.get(ip) ?? []).filter((t) => now - t < LIMITS.windowMs);
  if (hits.length >= LIMITS.perIp) {
    // Обновляем запись, чтобы протухшие отметки не копились в памяти
    ipHits.set(ip, hits);
    return `Слишком много сообщений подряд. Подождите пару минут — или напишите в Telegram ${TELEGRAM_HANDLE}.`;
  }

  hits.push(now);
  ipHits.set(ip, hits);
  return null;
}

/** Выбрасывает из памяти протухшие сессии и отметки лимитов. */
function sweep(): void {
  const now = Date.now();
  for (const [id, session] of sessions) {
    if (now - session.touched > LIMITS.sessionTtlMs) sessions.delete(id);
  }
  for (const [ip, hits] of ipHits) {
    const fresh = hits.filter((t) => now - t < LIMITS.windowMs);
    if (fresh.length === 0) ipHits.delete(ip);
    else ipHits.set(ip, fresh);
  }
  // Если сессий всё равно слишком много — выкидываем самые старые
  if (sessions.size > LIMITS.maxSessions) {
    const byAge = [...sessions.entries()].sort(
      (a, b) => a[1].touched - b[1].touched,
    );
    for (const [id] of byAge.slice(0, sessions.size - LIMITS.maxSessions)) {
      sessions.delete(id);
    }
  }
}

/**
 * Адрес посетителя. Берём адрес сокета: X-Forwarded-For подделывается, а
 * доверять ему можно только когда точно известно, что запрос пришёл от своего
 * прокси. При переносе за прокси — читать заголовок, но лишь от его адреса.
 */
function clientIp(req: IncomingMessage): string {
  return req.socket.remoteAddress ?? "unknown";
}

type Parsed = { sessionId: string | null; message: string };

/** Разбирает тело запроса. Возвращает либо данные, либо текст ошибки. */
function parseBody(body: unknown): Parsed | { error: string } {
  if (typeof body !== "object" || body === null) {
    return { error: "Тело запроса должно быть объектом." };
  }
  const { sessionId, message } = body as {
    sessionId?: unknown;
    message?: unknown;
  };

  if (typeof message !== "string" || message.trim() === "") {
    return { error: "Пустое сообщение." };
  }
  if (message.length > MESSAGE_MAX_CHARS) {
    return { error: `Сообщение длиннее ${MESSAGE_MAX_CHARS} символов.` };
  }
  // Первое сообщение приходит без сессии: и `null`, и отсутствие поля — норма.
  if (sessionId !== undefined && sessionId !== null) {
    if (typeof sessionId !== "string" || sessionId.length > 64) {
      return { error: "Некорректный идентификатор сессии." };
    }
  }

  return { sessionId: (sessionId as string | null | undefined) ?? null, message };
}

/**
 * Обрезает историю до лимита. Начинаться она должна с обычной реплики
 * посетителя: результат инструмента без своего вызова API отвергнет.
 */
export function trimHistory(messages: Anthropic.MessageParam[]): Anthropic.MessageParam[] {
  let out = messages.slice(-HISTORY_MAX_MESSAGES);
  while (out.length > 0 && !(out[0].role === "user" && typeof out[0].content === "string")) {
    out = out.slice(1);
  }
  return out;
}

type ToolOutcome = { content: string; isError: boolean; sent: boolean };

/**
 * Выполняет вызов send_order и возвращает текст для модели: что получилось и
 * что сказать посетителю. Решение «отправлять ли» принимается здесь, а не в промпте.
 */
async function runOrderTool(
  input: unknown,
  session: Session,
  ip: string,
  deps: { save: OrderSaver | null; notify: OrderNotifier | null },
): Promise<ToolOutcome> {
  if (session.ordersSent >= LIMITS.ordersPerSession) {
    return {
      content:
        "Заявка из этого диалога уже отправлена, повторно не отправляй. Скажи, что с посетителем свяжутся. " +
        `Если он уточняет или меняет данные заявки — предложи написать об этом в Telegram ${TELEGRAM_HANDLE}.`,
      isError: true,
      sent: false,
    };
  }
  const order = validateOrder(input);
  if ("error" in order) {
    return { content: `Заявка не принята: ${order.error} Уточни у посетителя и попробуй снова.`, isError: true, sent: false };
  }
  const result = await submitOrder(order, "assistant", ip, { ...deps, limiter: orderLimiter });
  if (result.ok) {
    session.ordersSent += 1;
    return {
      content: "Заявка отправлена. Коротко поблагодари и скажи, что с посетителем свяжутся по указанному контакту.",
      isError: false,
      sent: true,
    };
  }
  return {
    content: `Отправить заявку не получилось. Предложи написать напрямую в Telegram ${TELEGRAM_HANDLE} или на почту ${CONTACT_EMAIL}.`,
    isError: true,
    sent: false,
  };
}

/** `keep: false` — ход не сохранять в историю (отказ модели) */
type Turn = { reply: string; orderSent: boolean; keep: boolean };

/** Ответ посетителю, когда заявка ушла, а модель не договорила. */
const ORDER_SENT_REPLY = "Заявку передал — с вами свяжутся по указанному контакту.";

/**
 * Один ход диалога: модель отвечает, при необходимости вызывает send_order,
 * получает результат и договаривает. Всё новое дописывается в session.messages
 * по мере продвижения — при сбое после отправки заявки handleChat сохраняет
 * эту рабочую копию, и повторное сообщение не отправит заявку второй раз.
 *
 * Ключ читается из окружения сервера (ANTHROPIC_API_KEY), переменная без
 * префикса VITE_ — во фронтенд она не попадает.
 */
async function runTurn(
  session: Session,
  ip: string,
  opts: { apiKey: string; orderSaver: OrderSaver | null; orderNotifier: OrderNotifier | null },
): Promise<Turn> {
  // Посетитель в окне чата не ждёт по 10 минут (таймаут SDK по умолчанию)
  const client = new Anthropic({ apiKey: opts.apiKey, timeout: 45_000, maxRetries: 1 });
  const texts: string[] = [];
  let orderSent = false;

  for (let round = 0; round < LIMITS.toolRounds; round++) {
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      tools: [ORDER_TOOL],
      // База знаний не меняется от запроса к запросу — держим её в кэше,
      // чтение из кэша стоит 0.1 от обычного входа.
      system: [
        {
          type: "text",
          text: SYSTEM_PROMPT,
          cache_control: { type: "ephemeral" },
        },
      ],
      // Вопросы посетителей простые, глубокие рассуждения тут не окупаются.
      output_config: { effort: "medium" },
      messages: session.messages,
    });

    if (response.stop_reason === "refusal") {
      // Классификатор отказал: content пуст, читать его бессмысленно.
      console.warn("[chat] модель отказалась отвечать:", response.stop_details);
      if (orderSent) {
        session.messages.push({ role: "assistant", content: ORDER_SENT_REPLY });
        return { reply: ORDER_SENT_REPLY, orderSent, keep: true };
      }
      // Реплику, на которую отказали, в историю не пишем: иначе отказ повторится
      return {
        reply: `На такой вопрос я ответить не могу. Спросите что-нибудь о наших услугах — или напишите в Telegram ${TELEGRAM_HANDLE}.`,
        orderSent,
        keep: false,
      };
    }

    const text = response.content
      .filter((block) => block.type === "text")
      .map((block) => block.text)
      .join("")
      .trim();
    if (text) texts.push(text);

    // Ответ модели целиком, с блоками размышлений и вызовов: без них API не
    // примет результат инструмента на следующем круге.
    session.messages.push({ role: "assistant", content: response.content });

    const calls = response.content.filter((b): b is Anthropic.ToolUseBlock => b.type === "tool_use");
    if (calls.length === 0) {
      if (response.stop_reason === "max_tokens") {
        // Ответ обрезан лимитом — честнее сказать об этом, чем оборвать на полуслове.
        texts.push("Ответ получился длинным и оборвался. Спросите, пожалуйста, поконкретнее.");
      }
      break;
    }

    // На каждый вызов — свой результат, все результаты в одном сообщении. Вызов без
    // результата в истории API отвергает, и диалог умер бы до конца сессии
    const truncated = response.stop_reason === "max_tokens";
    const results: Anthropic.ToolResultBlockParam[] = [];
    for (const call of calls) {
      const outcome: ToolOutcome = truncated
        ? // Аргументы обрезанного вызова могут быть неполными — не выполняем
          { content: "Вызов оборвался на лимите длины и не выполнен. Повтори его коротко.", isError: true, sent: false }
        : call.name === ORDER_TOOL.name
          ? await runOrderTool(call.input, session, ip, { save: opts.orderSaver, notify: opts.orderNotifier })
          : { content: "Такого инструмента нет.", isError: true, sent: false };
      orderSent ||= outcome.sent;
      results.push({ type: "tool_result", tool_use_id: call.id, content: outcome.content, is_error: outcome.isError });
    }
    session.messages.push({ role: "user", content: results });
  }

  // Круги кончились на результате инструмента — закрываем ход репликой, чтобы
  // история не обрывалась на полуслове
  const last = session.messages[session.messages.length - 1];
  if (last.role === "user" && Array.isArray(last.content)) {
    const closing = orderSent ? ORDER_SENT_REPLY : "Не получилось оформить заявку. Попробуйте ещё раз.";
    session.messages.push({ role: "assistant", content: closing });
    // Подтверждение отправки посетитель должен увидеть, даже если раньше модель успела написать «сейчас оформлю»
    if (orderSent || !texts.length) texts.push(closing);
  }

  const reply = texts.join("\n\n").trim();
  if (reply) return { reply, orderSent, keep: true };

  console.warn("[chat] пустой ответ модели");
  return {
    reply: orderSent ? ORDER_SENT_REPLY : "Что-то я растерялся. Переспросите, пожалуйста, другими словами.",
    orderSent,
    keep: true,
  };
}

function send(res: ServerResponse, status: number, payload: unknown): void {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(payload));
}

/** Читает тело запроса, обрывая слишком большое, чтобы не набивать память. */
async function readBody(req: IncomingMessage): Promise<string | null> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req) {
    size += (chunk as Buffer).length;
    if (size > 64 * 1024) {
      // Иначе клиент продолжит слать данные и не увидит ответа
      req.destroy();
      return null;
    }
    chunks.push(chunk as Buffer);
  }
  return Buffer.concat(chunks).toString("utf8");
}

/** Точка входа обработчика. */
export async function handleChat(
  req: IncomingMessage,
  res: ServerResponse,
  opts: ChatOptions,
): Promise<void> {
  if (req.method === "GET") {
    send(res, 200, { enabled: Boolean(opts.apiKey), orders: Boolean(opts.orderSaver || opts.orderNotifier) });
    return;
  }
  if (req.method !== "POST") {
    send(res, 405, { error: "Только POST." });
    return;
  }

  const apiKey = opts.apiKey;
  if (!apiKey) {
    // Внятная ошибка вместо падения в недрах SDK.
    send(res, 503, {
      error:
        "На сервере не задан ANTHROPIC_API_KEY — чат отключён. " +
        "Добавьте ключ в .env (без префикса VITE_) и перезапустите dev-сервер.",
    });
    return;
  }

  const rawBody = await readBody(req);
  if (rawBody === null) {
    send(res, 413, { error: "Слишком большой запрос." });
    return;
  }

  let body: unknown;
  try {
    body = JSON.parse(rawBody);
  } catch {
    send(res, 400, { error: "Тело запроса — не JSON." });
    return;
  }

  const parsed = parseBody(body);
  if ("error" in parsed) {
    send(res, 400, { error: parsed.error });
    return;
  }

  const ip = clientIp(req);
  const limited = checkLimits(ip);
  if (limited) {
    send(res, 429, { error: limited });
    return;
  }

  sweep();

  // Неизвестный идентификатор — начинаем новую сессию, а не падаем: она могла
  // протухнуть или не пережить перезапуск сервера.
  const sessionId =
    parsed.sessionId && sessions.has(parsed.sessionId)
      ? parsed.sessionId
      : randomUUID();
  const stored = sessions.get(sessionId);
  // Рабочая копия: при сбое модели сохранённая история остаётся прежней
  const session: Session = {
    messages: trimHistory([...(stored?.messages ?? []), { role: "user", content: parsed.message }]),
    touched: Date.now(),
    ordersSent: stored?.ordersSent ?? 0,
  };

  const save = () => {
    session.touched = Date.now();
    session.messages = trimHistory(session.messages);
    sessions.set(sessionId, session);
  };

  try {
    const turn = await runTurn(session, ip, { apiKey, orderSaver: opts.orderSaver, orderNotifier: opts.orderNotifier });
    if (turn.keep) save();
    dayCount += 1;

    send(res, 200, { sessionId, reply: turn.reply, orderSent: turn.orderSent });
  } catch (e) {
    console.error("[chat] ошибка запроса к модели:", e);

    // Заявка успела уйти, а модель не договорила. Для посетителя это успех, а не
    // сбой: сохраняем рабочую копию (runOrderTool не бросает, так что она кончается
    // результатом инструмента) и закрываем ход своей репликой. Иначе он напишет
    // снова — и заявка уйдёт второй раз.
    if (session.ordersSent > (stored?.ordersSent ?? 0)) {
      session.messages.push({ role: "assistant", content: ORDER_SENT_REPLY });
      save();
      send(res, 200, { sessionId, reply: ORDER_SENT_REPLY, orderSent: true });
      return;
    }

    // История, которую API не принимает, не лечится повтором — начинаем диалог заново
    // Счётчик заявок сохраняем: иначе сброс открыл бы путь ко второй заявке
    if (e instanceof Anthropic.BadRequestError && stored) {
      sessions.set(sessionId, { messages: [], touched: Date.now(), ordersSent: stored.ordersSent });
    }

    // Наружу отдаём свой статус: код провайдера выдал бы посетителю
    // подробности вроде протухшего ключа (401) или чужого лимита (429).
    send(res, 502, {
      error: "Не получилось ответить — сбой на стороне модели. Попробуйте ещё раз.",
    });
  }
}
