// Нормализация телефона и сборка ссылок мессенджеров по строгим правилам.
// Чистые функции, покрыты phone.test.ts.

/** Убрать всё кроме цифр; ведущая 8 (РФ) → 7. Пусто/null → "". */
export function normalizePhone(raw: string | null | undefined): string {
  if (!raw) return "";
  let digits = raw.replace(/\D/g, "");
  if (digits.startsWith("8")) digits = "7" + digits.slice(1);
  return digits;
}

/**
 * Звонок — только при наличии телефона. WhatsApp убран: в РФ заблокирован
 * с февраля 2026.
 */
export function callLink(rawPhone: string | null | undefined): string | null {
  const n = normalizePhone(rawPhone);
  return n ? `tel:+${n}` : null;
}

/** Telegram: по username (приоритет, без @); иначе по телефону (tg://resolve). */
export function telegramLink(
  username: string | null | undefined,
  rawPhone: string | null | undefined,
): string | null {
  const u = username?.trim().replace(/^@/, "");
  if (u) return `https://t.me/${u}`;
  const n = normalizePhone(rawPhone);
  return n ? `tg://resolve?phone=${n}` : null;
}

/** MAX — только при заполненной ссылке. */
export function maxLinkOf(max_link: string | null | undefined): string | null {
  const m = max_link?.trim();
  return m ? m : null;
}

/** Готовый набор ссылок мессенджеров для клиента (null = скрыть кнопку). */
export function messengerLinks(c: {
  phone: string | null;
  telegram_username: string | null;
  max_link: string | null;
}): { call: string | null; telegram: string | null; max: string | null } {
  return {
    call: callLink(c.phone),
    telegram: telegramLink(c.telegram_username, c.phone),
    max: maxLinkOf(c.max_link),
  };
}
