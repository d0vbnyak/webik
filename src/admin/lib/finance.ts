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
  return round2(receivedTotal * (taxRatePercent / 100));
}

/** Ставки НПД: полная и льготная, пока не израсходован вычет. */
export interface TaxRates {
  /** Полная ставка, % — для юрлиц 6, для физлиц 4. */
  fullRatePercent: number;
  /** Ставка с вычетом, % — для юрлиц 4, для физлиц 3. */
  reducedRatePercent: number;
}

export interface TaxWithDeduction {
  /** Налог к уплате: полная ставка минус то, что покрыл вычет. */
  tax: number;
  /** Сколько вычета израсходовано на этой сумме дохода. */
  deductionUsed: number;
  /** Сколько вычета осталось после. */
  deductionLeft: number;
  /** Фактическая ставка, % — между льготной и полной, если вычет кончился внутри периода. */
  effectiveRatePercent: number;
}

/**
 * Налог с учётом вычета самозанятого.
 *
 * Вычет (10 000 ₽ на всё время, не сбрасывается по годам) не списывается с
 * налога целиком: он покрывает только разницу между полной и льготной
 * ставкой. На доходе от юрлиц (6% и 4%) это 2 п.п., то есть вычета хватает
 * на 500 000 ₽ дохода, дальше ставка становится полной.
 *
 * `deductionLeft` — остаток вычета на начало периода; передавать 0, чтобы
 * считать по полной ставке.
 */
export function taxWithDeduction(
  receivedTotal: number,
  rates: TaxRates,
  deductionLeft: number,
): TaxWithDeduction {
  const received = Math.max(0, receivedTotal);
  const full = Math.max(0, rates.fullRatePercent);
  // Льготная ставка выше полной смысла не имеет — вычет тогда ничего не даёт.
  const reduced = Math.min(Math.max(0, rates.reducedRatePercent), full);

  const fullTax = received * (full / 100);
  const discount = received * ((full - reduced) / 100);
  const used = Math.min(Math.max(0, deductionLeft), discount);
  const tax = round2(fullTax - used);

  return {
    tax,
    deductionUsed: round2(used),
    deductionLeft: round2(Math.max(0, deductionLeft) - used),
    effectiveRatePercent: received > 0 ? round2((tax / received) * 100) : reduced,
  };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
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
