/**
 * Обработчик /api/chat — единственное место, где сайт зовёт модель.
 *
 * Живёт на сервере: ключ от Anthropic в браузер не уходит. Во время
 * разработки подключается как middleware к dev-серверу Vite
 * (см. vite.config.ts). Для продакшена этот же обработчик переносится в
 * Supabase Edge Function — меняется только обёртка req/res, логика ниже та же.
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
import { HISTORY_MAX_MESSAGES, MESSAGE_MAX_CHARS } from "../shared/chat";

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
} as const;

type Role = "user" | "assistant";
type ChatMessage = { role: Role; content: string };
type Session = { messages: ChatMessage[]; touched: number };

/** Состояние в памяти процесса: перезапуск сервера его обнуляет. */
const ipHits = new Map<string, number[]>();
const sessions = new Map<string, Session>();
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
    return "Чат сегодня уже отвечал слишком много раз. Напишите на hello@webik.ru — ответим лично.";
  }

  const now = Date.now();
  const hits = (ipHits.get(ip) ?? []).filter((t) => now - t < LIMITS.windowMs);
  if (hits.length >= LIMITS.perIp) {
    // Обновляем запись, чтобы протухшие отметки не копились в памяти
    ipHits.set(ip, hits);
    return "Слишком много сообщений подряд. Подождите пару минут — или напишите на hello@webik.ru.";
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
 * Спрашивает модель. Ключ читается из окружения сервера (ANTHROPIC_API_KEY),
 * переменная без префикса VITE_ — во фронтенд она не попадает.
 */
async function askModel(
  messages: ChatMessage[],
  apiKey: string,
): Promise<string> {
  const client = new Anthropic({ apiKey });

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: MAX_TOKENS,
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
    messages,
  });

  if (response.stop_reason === "refusal") {
    // Классификатор отказал: content пуст, читать его бессмысленно.
    console.warn("[chat] модель отказалась отвечать:", response.stop_details);
    return "На такой вопрос я ответить не могу. Спросите что-нибудь о наших услугах — или напишите на hello@webik.ru.";
  }

  const text = response.content
    .filter((block) => block.type === "text")
    .map((block) => block.text)
    .join("")
    .trim();

  if (!text) {
    console.warn("[chat] пустой ответ, stop_reason:", response.stop_reason);
    return "Что-то я растерялся. Переспросите, пожалуйста, другими словами.";
  }

  if (response.stop_reason === "max_tokens") {
    // Ответ обрезан лимитом — честнее сказать об этом, чем оборвать на полуслове.
    return `${text}…\n\nОтвет получился длинным и оборвался. Спросите, пожалуйста, поконкретнее.`;
  }

  return text;
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
  apiKey: string | undefined,
): Promise<void> {
  if (req.method !== "POST") {
    send(res, 405, { error: "Только POST." });
    return;
  }

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

  const limited = checkLimits(clientIp(req));
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
  const session = sessions.get(sessionId) ?? { messages: [], touched: 0 };

  const history = [
    ...session.messages,
    { role: "user" as const, content: parsed.message },
  ].slice(-HISTORY_MAX_MESSAGES);

  try {
    const reply = await askModel(history, apiKey);

    sessions.set(sessionId, {
      messages: [
        ...history,
        { role: "assistant" as const, content: reply },
      ].slice(-HISTORY_MAX_MESSAGES),
      touched: Date.now(),
    });
    dayCount += 1;

    send(res, 200, { sessionId, reply });
  } catch (e) {
    // Наружу отдаём свой статус: код провайдера выдал бы посетителю
    // подробности вроде протухшего ключа (401) или чужого лимита (429).
    console.error("[chat] ошибка запроса к модели:", e);
    send(res, 502, {
      error: "Не получилось ответить — сбой на стороне модели. Попробуйте ещё раз.",
    });
  }
}
