/**
 * Контакты WebIK — единственное место, где они записаны.
 *
 * Читают: шапка, подвал, герой, прайс, виджет ассистента (src/) и база знаний
 * бота с текстами ошибок чата (server/). Поменял контакт — поменял здесь.
 */

export const CONTACT_EMAIL = "dev.d0vbnyak@gmail.com";

export const TELEGRAM_USERNAME = "d0vbnyak";
export const TELEGRAM_HANDLE = `@${TELEGRAM_USERNAME}`;
export const TELEGRAM_URL = `https://t.me/${TELEGRAM_USERNAME}`;

/** Ссылка mailto: с темой письма. */
export function mailto(subject?: string): string {
  return subject
    ? `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(subject)}`
    : `mailto:${CONTACT_EMAIL}`;
}
