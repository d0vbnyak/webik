/**
 * Единственный источник цен.
 *
 * Читают двое: страница `/prices` (src/pages/Prices.tsx) и база знаний
 * чат-бота (server/kb.ts). Правится только `prices.json` — тогда сайт и бот
 * не могут разойтись.
 *
 * Обоснование каждой цифры и источники по рынку — в docs/прайс.md.
 */
import data from "./prices.json";

export type PriceItem = {
  name: string;
  /** Цена строкой: формат разный — за проект, за месяц, за единицу */
  price: string;
  /** Что входит; показывается под названием */
  note?: string;
};

export type PriceGroup = { title: string; items: PriceItem[] };

export type PriceList = {
  /** Дата последнего пересмотра, ISO */
  updated: string;
  /** Общая оговорка про «от» и НДС */
  note: string;
  /** Про отдельную оплату самой нейросети */
  modelCost: string;
  groups: PriceGroup[];
};

export const PRICES: PriceList = data;

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
