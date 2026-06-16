import { describe, it, expect } from "vitest";
import { monthRange, addMonthISO, formatMoney, monthLabel } from "./dates";

describe("monthRange", () => {
  it("возвращает первый и следующий-первый день месяца (полуинтервал)", () => {
    expect(monthRange(2026, 2)).toEqual({ start: "2026-02-01", endExclusive: "2026-03-01" });
  });
  it("декабрь → переход через год", () => {
    expect(monthRange(2026, 12)).toEqual({ start: "2026-12-01", endExclusive: "2027-01-01" });
  });
});

describe("addMonthISO", () => {
  it("сдвигает дату на месяц вперёд", () => {
    expect(addMonthISO("2026-01-15")).toBe("2026-02-15");
  });
  it("31 января → 28 февраля (клампинг к концу месяца)", () => {
    expect(addMonthISO("2026-01-31")).toBe("2026-02-28");
  });
  it("декабрь → следующий год", () => {
    expect(addMonthISO("2026-12-10")).toBe("2027-01-10");
  });
});

describe("formatMoney", () => {
  it("форматирует рубли без копеек для целых", () => {
    expect(formatMoney(1500)).toBe("1 500 ₽");
  });
});

describe("monthLabel", () => {
  it("название месяца по-русски", () => {
    expect(monthLabel(2026, 6)).toBe("Июнь 2026");
  });
});
