/**
 * Общее для вызовов Yandex AI Studio на сервере: доступ, клиент, цены, разбор JSON.
 *
 * Ключ читается только на сервере, во фронтенд не попадает. Логирование
 * запросов на стороне Яндекса отключается заголовком — в админку идут чужие
 * сайты и данные воронки, хранить их у провайдера незачем.
 */
import OpenAI from "openai";

/** OpenAI-совместимый адрес Yandex AI Studio. */
export const BASE_URL = "https://ai.api.cloud.yandex.net/v1";

/** Доступ к Yandex AI Studio: API-ключ сервисного аккаунта и каталог. */
export type YandexAccess = { apiKey: string; folderId: string };

/**
 * Доступ из переменных окружения. Нужны обе: без каталога запрос не собрать.
 * Идентификатор каталога начинается с b1g — это не id сервисного аккаунта.
 */
export function yandexFromEnv(env: Record<string, string | undefined>): YandexAccess | null {
  const apiKey = env.YANDEX_API_KEY?.trim();
  const folderId = env.YANDEX_FOLDER_ID?.trim();
  return apiKey && folderId ? { apiKey, folderId } : null;
}

export function createYandexClient(access: YandexAccess, opts: { timeout: number; maxRetries?: number }): OpenAI {
  return new OpenAI({
    apiKey: access.apiKey,
    baseURL: BASE_URL,
    project: access.folderId,
    defaultHeaders: { "x-data-logging-enabled": "false" },
    timeout: opts.timeout,
    maxRetries: opts.maxRetries ?? 1,
  });
}

/** Полный идентификатор модели: gpt://<каталог>/<модель>. */
export function modelUri(access: YandexAccess, model: string): string {
  return `gpt://${access.folderId}/${model}`;
}

/**
 * Рубли с НДС за 1000 токенов: вход, выход, чтение из кэша — рублёвый прайс
 * AI Studio. Долларовый прайс — без НДС и по своему курсу, со счётом не сходится.
 */
export const PRICES_RUB: Record<string, [input: number, output: number, cached: number]> = {
  "yandexgpt-5.1": [0.8, 0.8, 0.8],
  "aliceai-llm": [0.5, 1.2, 0.5],
  "deepseek-v4-flash": [0.3, 0.5, 0.075],
  "qwen3-235b-a22b-fp8": [0.5, 0.5, 0.5],
  "qwen3.6-35b-a3b": [0.2, 0.3, 0.05],
};

/** Один синхронный запрос Yandex Search API днём, ₽ с НДС. Ночью дешевле — считаем по дневной. */
export const WEB_SEARCH_RUB = 0.488;

/** Стоимость вызова по токенам. Неизвестная модель — 0: лучше недосчитать, чем упасть. */
export function tokensCostRub(model: string, input: number, output: number, cached = 0): number {
  const [pin, pout, pcache] = PRICES_RUB[model] ?? [0, 0, 0];
  return ((input - cached) * pin + cached * pcache + output * pout) / 1000;
}

/**
 * JSON из ответа модели. Строгий формат не гарантирован: встречаются рассуждения
 * в <think>, обёртка ```json и текст вокруг объекта.
 */
export function extractJson(content: string | null | undefined): unknown {
  const text = (content ?? "").replace(/<think>[\s\S]*?(<\/think>|$)/g, "").trim();
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try {
    return JSON.parse(text.slice(start, end + 1));
  } catch {
    return null;
  }
}
