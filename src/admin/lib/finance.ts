// Денежные расчёты: остаток к оплате, просрочка, резерв на налог.
// Чистые функции, покрыты finance.test.ts.

import type { Income, PaymentStatus } from "./types";

/** Остаток к оплате (amount − paid_amount), не отрицательный. */
export function remainingToPay(i: Pick<Income, "amount" | "paid_amount">): number {
  return Math.max(0, i.amount - i.paid_amount);
}

/** Просрочка: due_date в прошлом (строго < сегодня) И не оплачено полностью. */
export function isOverdue(
  i: Pick<Income, "due_date" | "amount" | "paid_amount">,
  todayIso: string,
): boolean {
  if (!i.due_date) return false;
  if (remainingToPay(i) <= 0) return false;
  return i.due_date < todayIso;
}

/** Резерв на налог: ставка% от полученной суммы (Σ paid_amount). */
export function taxReserve(receivedTotal: number, taxRatePercent: number): number {
  return Math.round(receivedTotal * (taxRatePercent / 100) * 100) / 100;
}

/** Сумма «оплачено» по статусу: paid → amount, unpaid → 0, partial → как введено. */
export function normalizePaidAmount(
  status: PaymentStatus,
  amount: number,
  paidInput: number,
): number {
  if (status === "paid") return amount;
  if (status === "unpaid") return 0;
  return paidInput;
}
