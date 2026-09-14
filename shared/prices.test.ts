import { describe, expect, it } from "vitest";

import { ALL_PRICES, PRICES, notOfferedNames, pricesAsText } from "./prices";
import { SECTIONS, isVisible } from "./visibility";

const names = (list: typeof PRICES) => list.groups.flatMap((g) => g.items.map((i) => i.name));

describe("isVisible", () => {
  it("без раздела и флага — видно", () => {
    expect(isVisible({})).toBe(true);
  });

  it("hidden скрывает всегда", () => {
    expect(isVisible({ hidden: true })).toBe(false);
  });

  it("раздел решает по флагу", () => {
    expect(isVisible({ section: "templates" })).toBe(SECTIONS.templates);
  });
});

describe("PRICES", () => {
  it("не содержит скрытых позиций и групп", () => {
    for (const group of PRICES.groups) {
      expect(isVisible(group)).toBe(true);
      for (const item of group.items) expect(isVisible(item)).toBe(true);
    }
  });

  it("не содержит пустых групп", () => {
    for (const group of PRICES.groups) expect(group.items.length).toBeGreaterThan(0);
  });

  it("теряет ровно те позиции, что перечислены как непродаваемые", () => {
    const all = names(ALL_PRICES);
    const visible = names(PRICES);
    const hiddenItems = all.filter((n) => !visible.includes(n));
    const notOffered = notOfferedNames();
    // скрытая группа попадает в список одним названием, её позиции — нет
    for (const n of hiddenItems) {
      const group = ALL_PRICES.groups.find((g) => g.items.some((i) => i.name === n))!;
      expect(notOffered.includes(n) || notOffered.includes(group.title)).toBe(true);
    }
  });

  it("прайс для бота не упоминает скрытое", () => {
    const text = pricesAsText();
    for (const n of notOfferedNames()) expect(text).not.toContain(n);
  });
});
