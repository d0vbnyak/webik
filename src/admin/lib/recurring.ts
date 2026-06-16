// Авто-добавление повторяющихся расходов и логика напоминаний.
// Чистые функции, покрыты recurring.test.ts.

import type { RecurringExpense } from "./types";
import { addMonthISO } from "./dates";

export interface DueCharge {
  date: string;
}
export interface ComputedCharges {
  charges: DueCharge[];
  nextChargeDate: string;
}

/**
 * Считает, какие списания нужно добавить, пока next_charge_date <= сегодня.
 * existingDates — даты уже существующих расходов с этим recurring_id (дедуп).
 * Дата всегда двигается вперёд (даже если конкретное списание пропущено по дедупу).
 */
export function computeDueCharges(
  tpl: RecurringExpense,
  todayIso: string,
  existingDates: string[],
): ComputedCharges {
  const existing = new Set(existingDates);
  const charges: DueCharge[] = [];
  let date = tpl.next_charge_date;
  let guard = 0; // защита от бесконечного цикла на некорректных данных
  while (date <= todayIso && guard < 600) {
    if (!existing.has(date)) charges.push({ date });
    date = addMonthISO(date);
    guard++;
  }
  return { charges, nextChargeDate: date };
}

/** Календарных дней от сегодня до целевой даты (может быть отрицательным). */
export function daysUntil(targetIso: string, todayIso: string): number {
  const [ty, tm, td] = targetIso.split("-").map(Number);
  const [ny, nm, nd] = todayIso.split("-").map(Number);
  const a = Date.UTC(ty, tm - 1, td);
  const b = Date.UTC(ny, nm - 1, nd);
  return Math.round((a - b) / 86_400_000);
}

/** Показывать напоминание: активен, и до списания осталось 0..reminder_days_before дней. */
export function shouldRemind(tpl: RecurringExpense, todayIso: string): boolean {
  if (!tpl.active) return false;
  const left = daysUntil(tpl.next_charge_date, todayIso);
  return left >= 0 && left <= tpl.reminder_days_before;
}
