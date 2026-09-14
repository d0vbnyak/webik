/**
 * Какие разделы сайта видны посетителю.
 *
 * С сентября 2026 WebIK продаёт только ИИ-решения и простые лендинги.
 * Остальное скрыто, но не удалено: страницы, компоненты и данные лежат в
 * репозитории, и раздел возвращается одним флагом в `true`.
 *
 * Читают: src/App.tsx (маршруты), Navbar и Footer (ссылки), Home (кнопки),
 * AiCapabilities (каталог), shared/prices.ts (позиции прайса с `section`),
 * server/kb.ts (что бот рассказывает о студии). Раздел возвращается одним
 * флагом — вместе со ссылками, маршрутами, ценами и знаниями бота.
 *
 * Отдельные услуги, снятые с продажи, скрываются полем `hidden` там, где они
 * перечислены: shared/prices.json, Home, Footer, AiCapabilities. Это не разделы,
 * а решения о линейке, поэтому общего флага у них нет.
 */

export type Section = "templates" | "about" | "works";

export const SECTIONS: Record<Section, boolean> = {
  /** Каталог шаблонов /templates и три шаблона-лендинга /templates/* */
  templates: false,
  /** «О нас»: команда из четырёх человек и цифры стажа — не соответствуют действительности */
  about: false,
  /** «Другие работы»: кейсы с цифрами, которых не было */
  works: false,
};

/**
 * Виден ли элемент списка. `section` привязывает элемент к разделу, `hidden`
 * скрывает его отдельно, например услугу, которую больше не продаём.
 */
export function isVisible(item: { section?: Section; hidden?: boolean }): boolean {
  if (item.hidden) return false;
  return item.section ? SECTIONS[item.section] : true;
}
