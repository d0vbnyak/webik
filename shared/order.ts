/**
 * Заявка с сайта: общая проверка для формы в виджете и для сервера.
 *
 * Заявка приходит двумя путями — из формы (POST /api/order) и от ИИ-ассистента,
 * когда модель вызывает инструмент отправки. Оба пути проверяются здесь, чтобы
 * ограничения не разъехались.
 */

export const ORDER_LIMITS = {
  name: 100,
  contact: 200,
  task: 2000,
  details: 1000,
} as const;

export type Order = {
  name: string;
  contact: string;
  task: string;
  /** Бюджет, сроки, ниша — если прозвучали */
  details: string;
};

export type OrderSource = "form" | "assistant";

const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");

/**
 * Однострочное поле: переводы строк, управляющие и bidi-символы → пробел.
 * Иначе в имени можно нарисовать поддельную строку «Контакт: …» в сообщении.
 */
const line = (v: unknown) =>
  str(v)
    .replace(/[\p{Cc}\p{Cf}\u2028\u2029]+/gu, " ")
    .replace(/\s{2,}/g, " ")
    .trim();

/** Проверяет заявку. Возвращает её в нормализованном виде или текст ошибки. */
export function validateOrder(body: unknown): Order | { error: string } {
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    return { error: "Некорректная заявка." };
  }
  const raw = body as Record<string, unknown>;
  const order: Order = {
    name: line(raw.name),
    contact: line(raw.contact),
    task: str(raw.task),
    details: str(raw.details),
  };

  if (!order.contact) return { error: "Укажите, как с вами связаться." };
  if (!order.task) return { error: "Опишите задачу хотя бы парой слов." };
  for (const key of Object.keys(ORDER_LIMITS) as (keyof Order)[]) {
    if (order[key].length > ORDER_LIMITS[key]) {
      return { error: `Слишком длинное поле — до ${ORDER_LIMITS[key]} символов.` };
    }
  }
  // Контакт — это телефон, почта или ник, а не набор знаков препинания
  if (!/[\p{L}\p{N}]/u.test(order.contact)) {
    return { error: "Укажите телефон, почту или Telegram." };
  }
  return order;
}

/** Текст сообщения в Telegram. Без разметки: parse_mode не задаётся, спецсимволы безопасны. */
export function formatOrder(order: Order, source: OrderSource): string {
  const lines = [
    `Новая заявка с сайта WebIK`,
    `Источник: ${source === "assistant" ? "ИИ-ассистент" : "форма на сайте"}`,
    "",
    `Имя: ${order.name || "не назвался"}`,
    `Контакт: ${order.contact}`,
    "",
    `Задача: ${order.task}`,
  ];
  if (order.details) lines.push("", `Детали: ${order.details}`);
  return lines.join("\n");
}
