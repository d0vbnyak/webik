import { describe, it, expect } from "vitest";
import type { RecurringExpense } from "./types";
import { computeDueCharges, daysUntil, shouldRemind } from "./recurring";

const tpl = (p: Partial<RecurringExpense>): RecurringExpense => ({
  id: "r1", user_id: "u", name: "Хостинг", amount: 500, category: "Сервисы и подписки",
  next_charge_date: "2026-06-01", reminder_days_before: 3, active: true, created_at: "", ...p,
});

describe("computeDueCharges", () => {
  it("создаёт по одному списанию за каждый просроченный месяц и двигает дату вперёд", () => {
    const r = computeDueCharges(tpl({ next_charge_date: "2026-04-10" }), "2026-06-16", []);
    expect(r.charges.map((c) => c.date)).toEqual(["2026-04-10", "2026-05-10", "2026-06-10"]);
    expect(r.nextChargeDate).toBe("2026-07-10");
  });
  it("дата в будущем → ничего не создаём", () => {
    const r = computeDueCharges(tpl({ next_charge_date: "2026-07-01" }), "2026-06-16", []);
    expect(r.charges).toEqual([]);
    expect(r.nextChargeDate).toBe("2026-07-01");
  });
  it("дедуп: пропускаем даты, на которые расход с этим recurring_id уже есть", () => {
    const r = computeDueCharges(tpl({ next_charge_date: "2026-04-10" }), "2026-06-16", ["2026-05-10"]);
    expect(r.charges.map((c) => c.date)).toEqual(["2026-04-10", "2026-06-10"]);
    expect(r.nextChargeDate).toBe("2026-07-10");
  });
});

describe("daysUntil / shouldRemind", () => {
  it("дней до даты", () => {
    expect(daysUntil("2026-06-19", "2026-06-16")).toBe(3);
  });
  it("напоминание, если осталось <= reminder_days_before и дата не в прошлом", () => {
    expect(shouldRemind(tpl({ next_charge_date: "2026-06-18", reminder_days_before: 3 }), "2026-06-16")).toBe(true);
    expect(shouldRemind(tpl({ next_charge_date: "2026-06-25", reminder_days_before: 3 }), "2026-06-16")).toBe(false);
    expect(shouldRemind(tpl({ active: false, next_charge_date: "2026-06-18" }), "2026-06-16")).toBe(false);
  });
});
