import { describe, it, expect } from "vitest";
import type { Income } from "./types";
import { remainingToPay, isOverdue, taxReserve, normalizePaidAmount } from "./finance";

const inc = (p: Partial<Income>): Income => ({
  id: "1", user_id: "u", amount: 1000, date: "2026-06-01", category: "Веб",
  client_id: null, payment_status: "unpaid", paid_amount: 0, due_date: null,
  comment: null, created_at: "", ...p,
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

describe("taxReserve", () => {
  it("ставка% от суммы полученного (paid_amount)", () => {
    expect(taxReserve(50000, 6)).toBe(3000);
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
