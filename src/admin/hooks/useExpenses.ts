import { useCallback, useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import type { Expense, NewExpense } from "../lib/types";
import { monthRange } from "../lib/dates";
import { onChange } from "../lib/dataBus";

/** Расходы за выбранный месяц. Перезагружается при смене периода. */
export function useExpenses(year: number, month: number) {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const { start, endExclusive } = monthRange(year, month);
    const { data, error: selErr } = await supabase
      .from("expenses")
      .select("*")
      .gte("date", start)
      .lt("date", endExclusive)
      .order("date", { ascending: false });
    if (selErr) setError(selErr.message);
    else setExpenses((data ?? []) as Expense[]);
    setLoading(false);
  }, [year, month]);

  useEffect(() => {
    void load();
  }, [load]);

  // Перечитываемся, когда расходы изменились в обход хука (авто-добавление подписок)
  useEffect(() => onChange("expenses", () => void load()), [load]);

  const add = useCallback(async (payload: NewExpense) => {
    const { error: insErr } = await supabase.from("expenses").insert(payload);
    if (insErr) return { error: insErr.message };
    await load();
    return { error: null };
  }, [load]);

  /** Пакетное добавление (авто-списания повторяющихся расходов). */
  const addMany = useCallback(async (rows: NewExpense[]) => {
    if (rows.length === 0) return { error: null };
    const { error: insErr } = await supabase.from("expenses").insert(rows);
    if (insErr) return { error: insErr.message };
    await load();
    return { error: null };
  }, [load]);

  const update = useCallback(async (id: string, patch: Partial<NewExpense>) => {
    const { error: updErr } = await supabase.from("expenses").update(patch).eq("id", id);
    if (updErr) return { error: updErr.message };
    await load();
    return { error: null };
  }, [load]);

  const remove = useCallback(async (id: string) => {
    const { error: delErr } = await supabase.from("expenses").delete().eq("id", id);
    if (delErr) return { error: delErr.message };
    setExpenses((prev) => prev.filter((e) => e.id !== id));
    return { error: null };
  }, []);

  const total = expenses.reduce((s, e) => s + e.amount, 0);

  return { expenses, total, loading, error, add, addMany, update, remove, reload: load };
}
