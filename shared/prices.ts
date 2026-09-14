/**
 * Единственный источник цен.
 *
 * Читают двое: страница `/prices` (src/pages/Prices.tsx) и база знаний
 * чат-бота (server/kb.ts). Правится только `prices.json` — тогда сайт и бот
 * не могут разойтись.
 *
 * Обоснование каждой цифры и источники по рынку — в docs/прайс.md.
 *
 * Что не показывается ни на странице, ни боту:
 * - `hidden: true` — услуга снята с продажи; вернуть — убрать флаг;
 * - `section` — позиция принадлежит разделу сайта (см. shared/visibility.ts)
 *   и видна, только пока раздел открыт. Например, лендинг на шаблоне
 *   возвращается вместе с каталогом шаблонов одним флагом.
 */
import data from "./prices.json";
import { isVisible, type Section } from "./visibility";

export type PriceItem = {
  name: string;
  /** Цена строкой: формат разный — за проект, за месяц, за единицу */
  price: string;
  /** Что входит; показывается под названием */
  note?: string;
  /** Снята с продажи: не показывать ни посетителю, ни боту */
  hidden?: boolean;
  /** Видна, только пока открыт этот раздел сайта */
  section?: Section;
};

export type PriceGroup = {
  title: string;
  hidden?: boolean;
  section?: Section;
  items: PriceItem[];
};

export type PriceList = {
  /** Дата последнего пересмотра, ISO */
  updated: string;
  /** Общая оговорка про «от» и НДС */
  note: string;
  /** Про отдельную оплату самой нейросети */
  modelCost: string;
  groups: PriceGroup[];
};

/**
 * Все позиции, включая скрытые. Страница и прайс для бота берут `PRICES`;
 * сырой список нужен боту, чтобы перечислить, чего студия не делает.
 */
export const ALL_PRICES = data as PriceList;

/** Только то, что продаём: без скрытых групп, позиций и опустевших групп. */
export const PRICES: PriceList = {
  ...ALL_PRICES,
  groups: ALL_PRICES.groups
    .filter(isVisible)
    .map((group) => ({ ...group, items: group.items.filter(isVisible) }))
    .filter((group) => group.items.length > 0),
};

/** Продаётся ли группа прайса — есть ли она среди видимых. */
export function isGroupOffered(title: string): boolean {
  return PRICES.groups.some((group) => group.title === title);
}

/** Названия позиций и групп, которых сейчас нет в продаже. */
export function notOfferedNames(): string[] {
  return ALL_PRICES.groups.flatMap((group) =>
    isVisible(group) ? group.items.filter((i) => !isVisible(i)).map((i) => i.name) : [group.title],
  );
}

/** Прайс в виде текста — для промпта бота. */
export function pricesAsText(): string {
  const groups = PRICES.groups
    .map((group) => {
      const lines = group.items
        .map((item) =>
          item.note
            ? `- ${item.name} — ${item.price} (${item.note})`
            : `- ${item.name} — ${item.price}`,
        )
        .join("\n");
      return `## ${group.title}\n\n${lines}`;
    })
    .join("\n\n");

  return `${PRICES.note}\n\n${groups}\n\n## Расход на модель\n\n${PRICES.modelCost}`;
}
