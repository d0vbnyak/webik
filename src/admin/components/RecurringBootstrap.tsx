import { useEffect, useRef } from "react";
import { supabase } from "../lib/supabase";
import { todayISO } from "../lib/dates";
import { computeDueCharges } from "../lib/recurring";
import { emitChange } from "../lib/dataBus";
import { useAuth } from "../hooks/useAuth";
import type { RecurringExpense, NewExpense } from "../lib/types";

/**
 * Авто-добавление повторяющихся расходов при входе в админку.
 * Для каждого активного шаблона: пока next_charge_date <= сегодня и расхода с
 * этим recurring_id на эту дату ещё нет — создаём расход и двигаем дату на месяц.
 * Дедуп по существующим датам + сохранение даты сразу = без дублей.
 *
 * Запускается один раз на пользователя (ref). При смене аккаунта (новый user.id)
 * прогон повторяется. После вставки эмитим "expenses", чтобы списки обновились.
 * Ничего не рендерит; ошибки логируются, UI не блокируется.
 */
export default function RecurringBootstrap() {
  const { user } = useAuth();
  const ranForUser = useRef<string | null>(null);

  useEffect(() => {
    const uid = user?.id;
    if (!uid) return;
    if (ranForUser.current === uid) return; // уже прогоняли для этого пользователя
    ranForUser.current = uid;

    void (async () => {
      const today = todayISO();
      const { data: templates, error } = await supabase
        .from("recurring_expenses")
        .select("*")
        .eq("active", true);
      if (error) {
        console.error("[recurring] не удалось получить шаблоны:", error.message);
        return;
      }

      let inserted = false;
      for (const tpl of (templates ?? []) as RecurringExpense[]) {
        const { data: existing, error: exErr } = await supabase
          .from("expenses")
          .select("date")
          .eq("recurring_id", tpl.id);
        if (exErr) {
          console.error("[recurring] ошибка чтения расходов шаблона:", exErr.message);
          continue;
        }
        const existingDates = ((existing ?? []) as { date: string }[]).map((r) => r.date);
        const { charges, nextChargeDate } = computeDueCharges(tpl, today, existingDates);

        if (charges.length > 0) {
          const rows: NewExpense[] = charges.map((c) => ({
            amount: tpl.amount,
            date: c.date,
            category: tpl.category,
            comment: tpl.name,
            recurring_id: tpl.id,
          }));
          const { error: insErr } = await supabase.from("expenses").insert(rows);
          if (insErr) {
            console.error("[recurring] ошибка добавления авто-расходов:", insErr.message);
            continue;
          }
          inserted = true;
        }
        if (nextChargeDate !== tpl.next_charge_date) {
          const { error: updErr } = await supabase
            .from("recurring_expenses")
            .update({ next_charge_date: nextChargeDate })
            .eq("id", tpl.id);
          if (updErr) console.error("[recurring] ошибка сдвига даты:", updErr.message);
        }
      }

      // Сообщаем спискам расходов/дашборду, что появились новые записи
      if (inserted) emitChange("expenses");
    })();
  }, [user?.id]);

  return null;
}
