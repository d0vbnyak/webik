import { describe, it, expect } from "vitest";
import type { Income } from "./types";
import { remainingToPay, isOverdue, taxWithDeduction, normalizePaidAmount } from "./finance";

const inc = (p: Partial<Income>): Income => ({
  id: "1", user_id: "u", amount: 1000, date: "2026-06-01", category: "Веб",
  client_id: null, payment_status: "unpaid", paid_amount: 0, due_date: null,
  comment: null, project_id: null, created_at: "", ...p,
});

describe("remainingToPay", () => {
  it("amount − paid_amount", () => {
    expect(remainingToPay(inc({ amount: 1000, paid_amount: 300 }))).toBe(700);
  });
  it("не отрицательный", () => {
    expect(remainingToPay(inc({ amount: 1000, paid_amount: 1500 }))).toBe(0);
  });
});

describe("isOverdue", () => {
  it("due_date в прошлом и не оплачено полностью", () => {
    expect(isOverdue(inc({ due_date: "2026-06-01", payment_status: "partial", paid_amount: 100, amount: 1000 }), "2026-06-16")).toBe(true);
  });
  it("оплачено полностью → не просрочено", () => {
    expect(isOverdue(inc({ due_date: "2026-06-01", payment_status: "paid", paid_amount: 1000, amount: 1000 }), "2026-06-16")).toBe(false);
  });
  it("нет due_date → не просрочено", () => {
    expect(isOverdue(inc({ due_date: null }), "2026-06-16")).toBe(false);
  });
  it("due_date сегодня → ещё не просрочено", () => {
    expect(isOverdue(inc({ due_date: "2026-06-16", paid_amount: 0 }), "2026-06-16")).toBe(false);
  });
});

describe("taxWithDeduction", () => {
  const ur = { fullRatePercent: 6, reducedRatePercent: 4 }; // доход от юрлиц
  const fl = { fullRatePercent: 4, reducedRatePercent: 3 }; // доход от физлиц

  it("вычета хватает — платим по льготной ставке", () => {
    const r = taxWithDeduction(100000, ur, 10000);
    expect(r.tax).toBe(4000);
    expect(r.deductionUsed).toBe(2000);
    expect(r.deductionLeft).toBe(8000);
    expect(r.effectiveRatePercent).toBe(4);
  });

  it("вычет исчерпан — полная ставка", () => {
    const r = taxWithDeduction(100000, ur, 0);
    expect(r.tax).toBe(6000);
    expect(r.deductionUsed).toBe(0);
    expect(r.deductionLeft).toBe(0);
    expect(r.effectiveRatePercent).toBe(6);
  });

  it("вычет кончается внутри периода — ставка между льготной и полной", () => {
    // 10 000 вычета хватает на 500 000 дохода; на 600 000 остаток не покрывает всё
    const r = taxWithDeduction(600000, ur, 10000);
    expect(r.tax).toBe(36000 - 10000);
    expect(r.deductionUsed).toBe(10000);
    expect(r.deductionLeft).toBe(0);
    expect(r.effectiveRatePercent).toBeCloseTo(4.33, 2);
  });

  it("ровно 500 000 от юрлиц выбирают вычет полностью", () => {
    const r = taxWithDeduction(500000, ur, 10000);
    expect(r.deductionLeft).toBe(0);
    expect(r.tax).toBe(20000);
  });

  it("доход от физлиц: вычет идёт по 1 п.п.", () => {
    const r = taxWithDeduction(100000, fl, 10000);
    expect(r.tax).toBe(3000);
    expect(r.deductionUsed).toBe(1000);
    expect(r.deductionLeft).toBe(9000);
  });

  it("нулевой доход не тратит вычет", () => {
    const r = taxWithDeduction(0, ur, 10000);
    expect(r.tax).toBe(0);
    expect(r.deductionUsed).toBe(0);
    expect(r.deductionLeft).toBe(10000);
    expect(r.effectiveRatePercent).toBe(4);
  });

  it("нулевой доход без вычета — показываем полную ставку, а не льготную", () => {
    expect(taxWithDeduction(0, ur, 0).effectiveRatePercent).toBe(6);
  });

  it("израсходованное и остаток в сумме дают исходный вычет", () => {
    const r = taxWithDeduction(33333.33, ur, 10000);
    expect(r.deductionUsed + r.deductionLeft).toBe(10000);
  });

  it("льготная ставка выше полной — считаем по полной, вычет не тратится", () => {
    const r = taxWithDeduction(100000, { fullRatePercent: 6, reducedRatePercent: 9 }, 10000);
    expect(r.tax).toBe(6000);
    expect(r.deductionUsed).toBe(0);
    expect(r.deductionLeft).toBe(10000);
  });

  it("отрицательные значения не ломают расчёт", () => {
    expect(taxWithDeduction(-5000, ur, -100).tax).toBe(0);
  });
});

describe("normalizePaidAmount", () => {
  it("статус paid → paid_amount = amount", () => {
    expect(normalizePaidAmount("paid", 1000, 0)).toBe(1000);
  });
  it("статус unpaid → 0", () => {
    expect(normalizePaidAmount("unpaid", 1000, 500)).toBe(0);
  });
  it("статус partial → как введено", () => {
    expect(normalizePaidAmount("partial", 1000, 400)).toBe(400);
  });
});
